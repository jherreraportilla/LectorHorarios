import type { DaySchedule, EmployeeDay, EmployeeWeek } from '../types/schedule';

export interface ShiftSegment {
  start: string;
  end: string;
}

export type MatchKind = 'sameShift' | 'sameEnd' | 'overlap';

export interface CoworkerHit {
  name: string;
  segments: ShiftSegment[];
  match: MatchKind;
}

export interface CoworkersByDay {
  dayName: string;
  date: string;
  mySegments: ShiftSegment[];
  hits: CoworkerHit[];
}

export function parseSegments(timeRange: string | undefined): ShiftSegment[] {
  if (!timeRange) return [];
  const re = /(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/g;
  const out: ShiftSegment[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(timeRange)) !== null) {
    out.push({ start: m[1], end: m[2] });
  }
  return out;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function segmentsOverlap(a: ShiftSegment, b: ShiftSegment): boolean {
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

function anyOverlap(mine: ShiftSegment[], theirs: ShiftSegment[]): boolean {
  return mine.some((m) => theirs.some((t) => segmentsOverlap(m, t)));
}

function shareAnyEnd(mine: ShiftSegment[], theirs: ShiftSegment[]): boolean {
  const myEnds = new Set(mine.map((s) => s.end));
  return theirs.some((t) => myEnds.has(t.end));
}

function shareAnyStart(mine: ShiftSegment[], theirs: ShiftSegment[]): boolean {
  const myStarts = new Set(mine.map((s) => s.start));
  return theirs.some((t) => myStarts.has(t.start));
}

function findDayForName(emp: EmployeeWeek, dayName: string, date: string): EmployeeDay | undefined {
  if (date) {
    const sameDate = emp.days.find((d) => d.date && d.date === date);
    if (sameDate) return sameDate;
  }
  return emp.days.find((d) => d.dayName === dayName);
}

export function buildCoworkers(
  myDays: DaySchedule[],
  allEmployees: EmployeeWeek[] | undefined,
  myName: string
): CoworkersByDay[] {
  if (!allEmployees || allEmployees.length === 0) return [];
  return myDays.map((day) => {
    const mySegments = parseSegments(day.timeRange);
    if (day.status !== 'work' || mySegments.length === 0) {
      return { dayName: day.dayName, date: day.date, mySegments, hits: [] };
    }

    const hits: CoworkerHit[] = [];
    for (const other of allEmployees) {
      if (other.name === myName) continue;
      const theirDay = findDayForName(other, day.dayName, day.date);
      if (!theirDay || theirDay.status !== 'work') continue;
      const theirSegments = parseSegments(theirDay.timeRange);
      if (theirSegments.length === 0) continue;

      const sameEnd = shareAnyEnd(mySegments, theirSegments);
      const sameStart = shareAnyStart(mySegments, theirSegments);
      const overlaps = anyOverlap(mySegments, theirSegments);
      if (!sameEnd && !overlaps) continue;

      let match: MatchKind;
      if (sameEnd && sameStart) match = 'sameShift';
      else if (sameEnd) match = 'sameEnd';
      else match = 'overlap';

      hits.push({ name: other.name, segments: theirSegments, match });
    }

    const order: Record<MatchKind, number> = { sameShift: 0, sameEnd: 1, overlap: 2 };
    hits.sort((a, b) => order[a.match] - order[b.match] || a.name.localeCompare(b.name));

    return { dayName: day.dayName, date: day.date, mySegments, hits };
  });
}