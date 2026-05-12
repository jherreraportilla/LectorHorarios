import type {
  DaySchedule,
  DayStatus,
  ScheduleFormat,
  WeekSchedule,
} from '../types/schedule';
import type { PositionedText } from './pdfParser';

const DAY_NAMES_ES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

// 0 = Lunes … 6 = Domingo. Tokens habituales de SISQUAL/Tendam.
const DAY_TOKENS: Set<string>[] = [
  new Set(['l', 'lu', 'lun', 'lunes', 'mo', 'mon', 'monday']),
  new Set(['m', 'ma', 'mar', 'martes', 'tu', 'tue', 'tuesday']),
  new Set(['x', 'mi', 'mie', 'mier', 'miercoles', 'we', 'wed', 'wednesday']),
  new Set(['j', 'ju', 'jue', 'jueves', 'th', 'thu', 'thursday']),
  new Set(['v', 'vi', 'vie', 'vier', 'viernes', 'fr', 'fri', 'friday']),
  new Set(['s', 'sa', 'sab', 'sabado', 'sat', 'saturday']),
  new Set(['d', 'do', 'dom', 'domingo', 'su', 'sun', 'sunday']),
];

const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};

const MONTH_ABBR_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const COMBINING_MARKS = /\p{M}/gu;

interface Row {
  y: number;
  page: number;
  items: PositionedText[];
}

interface DayColumn {
  name: string;
  dayOfWeek: number;
  x: number;
  position: number;
}

interface ColumnRange {
  position: number;
  xLeft: number;
  xRight: number;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').trim();
}

function dayIndexFor(text: string): number | null {
  const norm = normalize(text).replace(/[.,;:]+/g, '').trim();
  if (!norm) return null;
  for (let i = 0; i < DAY_TOKENS.length; i++) {
    if (DAY_TOKENS[i].has(norm)) return i;
  }
  const firstToken = norm.split(/[\s/\-]+/)[0];
  if (firstToken && firstToken.length <= 12) {
    for (let i = 0; i < DAY_TOKENS.length; i++) {
      if (DAY_TOKENS[i].has(firstToken)) return i;
    }
  }
  return null;
}

function stripDayPrefix(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  if (dayIndexFor(trimmed) === null) return trimmed;
  const norm = normalize(trimmed).replace(/[.,;:]+/g, '').trim();
  for (const set of DAY_TOKENS) {
    if (set.has(norm)) return '';
  }
  const parts = trimmed.split(/\s+/);
  return parts.slice(1).join(' ').trim();
}

function groupIntoRows(items: PositionedText[], tolerance = 3): Row[] {
  const filtered = items.filter((i) => i.str.trim().length > 0);
  const sorted = [...filtered].sort((a, b) => a.page - b.page || b.y - a.y);
  const rows: Row[] = [];
  for (const item of sorted) {
    let row = rows.find(
      (r) => r.page === item.page && Math.abs(r.y - item.y) <= tolerance
    );
    if (!row) {
      row = { y: item.y, page: item.page, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

function findDayColumnsByName(rows: Row[]): { headerRow: Row; columns: DayColumn[] } | null {
  for (const row of rows) {
    const hits: { dayOfWeek: number; x: number }[] = [];
    for (const item of row.items) {
      const dow = dayIndexFor(item.str);
      if (dow === null) continue;
      hits.push({ dayOfWeek: dow, x: item.x + item.width / 2 });
    }
    if (hits.length >= 7) {
      hits.sort((a, b) => a.x - b.x);
      const columns: DayColumn[] = hits.map((h, i) => ({
        name: DAY_NAMES_ES[h.dayOfWeek],
        dayOfWeek: h.dayOfWeek,
        x: h.x,
        position: i,
      }));
      return { headerRow: row, columns };
    }
  }
  return null;
}

function findDayColumnsByDates(rows: Row[]): { headerRow: Row; columns: DayColumn[] } | null {
  const datePattern = /^\d{1,2}\s*[\/.\-]\s*\d{1,2}(?:\s*[\/.\-]\s*\d{2,4})?$/;
  for (const row of rows) {
    const xs: number[] = [];
    for (const item of row.items) {
      if (datePattern.test(item.str.trim())) {
        xs.push(item.x + item.width / 2);
      }
    }
    if (xs.length >= 7) {
      xs.sort((a, b) => a - b);
      const count = Math.min(8, xs.length);
      const useXs = xs.slice(0, count);
      const dows = count === 8 ? [6, 0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6];
      const columns: DayColumn[] = useXs.map((x, i) => ({
        name: DAY_NAMES_ES[dows[i]],
        dayOfWeek: dows[i],
        x,
        position: i,
      }));
      return { headerRow: row, columns };
    }
  }
  return null;
}

function findDayColumns(rows: Row[]) {
  return findDayColumnsByName(rows) ?? findDayColumnsByDates(rows);
}

function findHorRealX(headerRow: Row, rightmostDayX: number): number | undefined {
  let best: number | undefined;
  for (const item of headerRow.items) {
    const cx = item.x + item.width / 2;
    if (cx <= rightmostDayX + 1) continue;
    if (dayIndexFor(item.str) !== null) continue;
    if (best === undefined || cx < best) best = cx;
  }
  return best;
}

function estimateColumnWidth(columns: DayColumn[]): number {
  if (columns.length < 2) return 60;
  const gaps: number[] = [];
  for (let i = 1; i < columns.length; i++) {
    gaps.push(columns[i].x - columns[i - 1].x);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function buildColumnRanges(
  columns: DayColumn[],
  horRealX?: number
): { ranges: ColumnRange[]; nameRight: number; totalLeft: number } {
  const colWidth = estimateColumnWidth(columns);
  const half = colWidth / 2;
  const ranges: ColumnRange[] = [];
  for (let i = 0; i < columns.length; i++) {
    const xLeft = i === 0 ? columns[0].x - half : (columns[i - 1].x + columns[i].x) / 2;
    let xRight: number;
    if (i < columns.length - 1) {
      xRight = (columns[i].x + columns[i + 1].x) / 2;
    } else if (horRealX !== undefined) {
      xRight = (columns[i].x + horRealX) / 2;
    } else {
      xRight = columns[i].x + half;
    }
    ranges.push({ position: i, xLeft, xRight });
  }
  const nameRight = columns[0].x - half;
  const totalLeft =
    horRealX !== undefined
      ? (columns[columns.length - 1].x + horRealX) / 2
      : columns[columns.length - 1].x + half;
  return { ranges, nameRight, totalLeft };
}

function findEmployeeRows(rows: Row[]): Row[] {
  return rows.filter((row) => {
    const first = row.items[0]?.str?.trim() ?? '';
    return /^\d{6,}/.test(first);
  });
}

function findEmployeeRow(empRows: Row[], query: string): Row | null {
  const q = normalize(query);
  if (!q) return null;
  const tokens = q.split(/\s+/).filter(Boolean);

  let best: { row: Row; score: number } | null = null;
  for (const row of empRows) {
    const rowText = normalize(row.items.map((i) => i.str).join(' '));
    let score = 0;
    if (rowText.includes(q)) score += 100;
    for (const t of tokens) {
      if (rowText.includes(t)) score += 10;
    }
    if (score === 0) continue;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function getEmployeeBand(
  empRow: Row,
  allEmpRows: Row[],
  items: PositionedText[]
): PositionedText[] {
  const samePage = allEmpRows
    .filter((r) => r.page === empRow.page)
    .sort((a, b) => b.y - a.y);
  const idx = samePage.indexOf(empRow);
  const prev = idx > 0 ? samePage[idx - 1] : null;
  const next = idx >= 0 && idx + 1 < samePage.length ? samePage[idx + 1] : null;
  // Banda acotada por el punto medio con los empleados vecinos para evitar
  // arrastrar texto de filas contiguas (p. ej. un VAC de otro empleado).
  const yTop = prev ? (empRow.y + prev.y) / 2 : empRow.y + 8;
  const yBottom = next ? (empRow.y + next.y) / 2 : -Infinity;
  return items.filter(
    (i) => i.page === empRow.page && i.y > yBottom && i.y <= yTop
  );
}

function findColumnForX(ranges: ColumnRange[], x: number): ColumnRange | undefined {
  return ranges.find((r) => x >= r.xLeft && x < r.xRight);
}

function parseCellText(text: string): {
  status: DayStatus;
  timeRange?: string;
  rawCode?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { status: 'off', rawCode: '' };

  const timeMatches = [...trimmed.matchAll(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g)];
  if (timeMatches.length > 0) {
    const formatted = timeMatches.map((m) => `${m[1]} – ${m[2]}`).join(' · ');
    return { status: 'work', timeRange: formatted };
  }

  const upper = trimmed.toUpperCase();
  if (/\bVAC\b/.test(upper)) return { status: 'vacation', rawCode: 'VAC' };
  if (/ENFE/.test(upper)) return { status: 'sick', rawCode: 'Enfe' };
  if (/\bDL\b/.test(upper)) return { status: 'off', rawCode: 'DL' };

  return { status: 'other', rawCode: trimmed };
}

// Detecta el formato a partir del título del PDF:
// - Semanal: "X de mes - Y de mes de YYYY"
// - Mensual: solo "mes de YYYY"
function extractScheduleHeader(rows: Row[]): { weekRange: string; format: ScheduleFormat } {
  const months =
    'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic';
  const rangeRe = new RegExp(
    `(?<!\\d)(?:del\\s+)?\\d{1,2}(?:\\s+de\\s+(?:${months}))?\\s*(?:[-–—]|al)\\s*\\d{1,2}\\s+de\\s+(?:${months})(?:\\s+(?:de\\s+)?\\d{4})?`,
    'i'
  );
  const monthYearRe = new RegExp(`(?<![a-zñáéíóú])(?:${months})\\s+de\\s+\\d{4}`, 'i');

  for (const row of rows) {
    const text = row.items.map((i) => i.str).join(' ');
    const m = text.match(rangeRe);
    if (m) return { weekRange: m[0].trim(), format: 'weekly' };
  }
  for (const row of rows) {
    const text = row.items.map((i) => i.str).join(' ');
    const m = text.match(monthYearRe);
    if (m) return { weekRange: m[0].trim(), format: 'monthly' };
  }
  return { weekRange: '', format: 'weekly' };
}

// Devuelve un Date del mes detectado (día 1 si solo viene "mes de YYYY").
function parseWeekStart(weekRange: string): Date | null {
  if (!weekRange) return null;
  const normRange = normalize(weekRange);
  const monthRe = new RegExp(`\\b(${Object.keys(MONTHS_ES).join('|')})\\b`, 'i');
  const monthMatch = normRange.match(monthRe);
  const yearMatch = normRange.match(/\b(20\d{2})\b/);
  if (!monthMatch) return null;
  const monthIdx = MONTHS_ES[monthMatch[1].toLowerCase()];
  if (monthIdx === undefined) return null;
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const dayMatch = normRange.match(/(?<!\d)(\d{1,2})\b/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
  if (day < 1 || day > 31) return null;
  return new Date(year, monthIdx, day);
}

// Determina la fecha real de la primera columna, ajustando el mes si el primer
// día visible es alto (e.g. "31") y el header dice "junio de 2026".
function resolveFirstColumnDate(
  weekStart: Date | null,
  firstCellRaw: string,
  format: ScheduleFormat
): Date | null {
  if (!weekStart) return null;
  const dayMatch = firstCellRaw.match(/(?<!\d)(\d{1,2})(?!\d)/);
  if (!dayMatch) return weekStart;
  const cellDay = parseInt(dayMatch[1], 10);

  if (format === 'monthly' && cellDay > 20 && weekStart.getDate() <= 7) {
    const prev = new Date(weekStart);
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    prev.setDate(cellDay);
    return prev;
  }

  if (cellDay === weekStart.getDate()) return weekStart;
  const adjusted = new Date(weekStart);
  adjusted.setDate(cellDay);
  return adjusted;
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_ABBR_ES[d.getMonth()]}`;
}

export function debugRowDump(items: PositionedText[], maxRows = 30): string[] {
  const rows = groupIntoRows(items);
  return rows.slice(0, maxRows).map((r) => {
    const text = r.items.map((i) => i.str).join(' | ');
    return `p${r.page} y=${Math.round(r.y)}  ${text}`;
  });
}

export function parseSchedule(items: PositionedText[], query: string): WeekSchedule {
  const rows = groupIntoRows(items);

  const header = findDayColumns(rows);
  if (!header) {
    throw new Error(
      'No se pudo localizar la cabecera de días en el PDF. ' +
        'Pulsa "Mostrar contenido detectado" para revisar el texto extraído.'
    );
  }

  const rightmostDayX = Math.max(...header.columns.map((c) => c.x));
  const horRealX = findHorRealX(header.headerRow, rightmostDayX);
  const { ranges, nameRight, totalLeft } = buildColumnRanges(header.columns, horRealX);

  const headerIdx = rows.indexOf(header.headerRow);
  const dateRowCandidates: Row[] = [header.headerRow];
  const nextRow = rows[headerIdx + 1];
  if (nextRow && nextRow.page === header.headerRow.page) {
    dateRowCandidates.push(nextRow);
  }

  const datesByPos: Record<number, string> = {};
  for (const row of dateRowCandidates) {
    const isHeader = row === header.headerRow;
    for (const item of row.items) {
      let text = item.str.trim();
      if (isHeader) {
        text = stripDayPrefix(text);
      } else if (dayIndexFor(text) !== null) {
        continue;
      }
      text = text.replace(/Hor\.?\s*Real/i, '').trim();
      if (!text) continue;
      const cx = item.x + item.width / 2;
      const range = findColumnForX(ranges, cx);
      if (!range) continue;
      datesByPos[range.position] = ((datesByPos[range.position] ?? '') + ' ' + text).trim();
    }
  }

  const allEmpRows = findEmployeeRows(rows);
  const employeeRow = findEmployeeRow(allEmpRows, query);
  if (!employeeRow) {
    throw new Error(`No se encontró ningún empleado con "${query}".`);
  }

  const band = getEmployeeBand(employeeRow, allEmpRows, items);

  const nameItems = band.filter((i) => i.x + i.width / 2 < nameRight);
  const rawName = nameItems
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const employeeName = rawName.replace(/^\d+\s*/, '').trim() || rawName;

  const tailItems = band.filter((i) => i.x + i.width / 2 >= totalLeft);
  const tailText = tailItems
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str)
    .join(' ');
  const totalMatch = tailText.match(/(\d{1,3}:\d{2})/);
  const totalHours = totalMatch ? totalMatch[1] : tailText.trim();

  const cellsByPos: Record<number, PositionedText[]> = {};
  for (const item of band) {
    const cx = item.x + item.width / 2;
    if (cx < nameRight || cx >= totalLeft) continue;
    const range = findColumnForX(ranges, cx);
    if (!range) continue;
    (cellsByPos[range.position] ??= []).push(item);
  }

  const { weekRange, format: headerFormat } = extractScheduleHeader(rows);
  const format: ScheduleFormat =
    headerFormat === 'monthly' || header.columns.length > 14 ? 'monthly' : 'weekly';

  const baseWeekStart = parseWeekStart(weekRange);
  const firstCellRaw = (datesByPos[0] ?? '').trim();
  const firstDate = resolveFirstColumnDate(baseWeekStart, firstCellRaw, format);

  const days: DaySchedule[] = header.columns.map((col, i) => {
    const cellItems = (cellsByPos[col.position] ?? []).sort(
      (a, b) => b.y - a.y || a.x - b.x
    );
    const cellText = cellItems
      .map((c) => c.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parsed = parseCellText(cellText);

    let date = (datesByPos[col.position] ?? '').trim();
    if (firstDate) {
      const computed = new Date(firstDate);
      computed.setDate(computed.getDate() + i);
      if (!date || /^\d{1,2}$/.test(date)) {
        date = formatShortDate(computed);
      }
    }

    return {
      dayName: col.name,
      date,
      status: parsed.status,
      timeRange: parsed.timeRange,
      rawCode: parsed.rawCode,
    };
  });

  return {
    employeeName,
    weekRange,
    totalHours,
    days,
    format,
  };
}
