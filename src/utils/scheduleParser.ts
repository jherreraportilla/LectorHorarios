import type {
  DaySchedule,
  DayStatus,
  EmployeeWeek,
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

function autoRowTolerance(items: PositionedText[]): number {
  const heights = items
    .map((i) => i.height)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  if (heights.length === 0) return 3;
  const median = heights[Math.floor(heights.length / 2)];
  return Math.max(3, median * 0.7);
}

function groupIntoRows(items: PositionedText[], tolerance?: number): Row[] {
  const tol = tolerance ?? autoRowTolerance(items);
  const filtered = items.filter((i) => i.str.trim().length > 0);
  const sorted = [...filtered].sort((a, b) => a.page - b.page || b.y - a.y);
  const rows: Row[] = [];
  for (const item of sorted) {
    let row = rows.find(
      (r) => r.page === item.page && Math.abs(r.y - item.y) <= tol
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

function findDayColumnsByName(
  rows: Row[],
  minHits = 7
): { headerRow: Row; columns: DayColumn[] } | null {
  for (const row of rows) {
    const hits: { dayOfWeek: number; x: number }[] = [];
    for (const item of row.items) {
      const dow = dayIndexFor(item.str);
      if (dow === null) continue;
      hits.push({ dayOfWeek: dow, x: item.x + item.width / 2 });
    }
    if (hits.length >= minHits) {
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

function findDayColumnsByDates(
  rows: Row[],
  minHits = 7
): { headerRow: Row; columns: DayColumn[] } | null {
  const datePattern = /^\d{1,2}\s*[\/.\-]\s*\d{1,2}(?:\s*[\/.\-]\s*\d{2,4})?$/;
  const bareDayPattern = /^\d{1,2}$/;
  for (const row of rows) {
    const xs: number[] = [];
    for (const item of row.items) {
      const t = item.str.trim();
      if (datePattern.test(t) || bareDayPattern.test(t)) {
        xs.push(item.x + item.width / 2);
      }
    }
    if (xs.length >= minHits) {
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

interface BodyItem {
  x: number;
  str: string;
}

function clusterIsTotals(items: BodyItem[]): boolean {
  if (items.length === 0) return false;
  let totalLike = 0;
  let dayLike = 0;
  for (const it of items) {
    const s = it.str.trim();
    const m = s.match(/^(\d{1,3})[:.]\d{2}$/);
    if (m) {
      const h = parseInt(m[1], 10);
      if (h >= 24) totalLike++;
      else dayLike++;
    } else if (/^(VAC|DL|ENFE?|FF|FT)$/i.test(s) || /^[+\-–—]$/.test(s)) {
      dayLike++;
    }
  }
  if (dayLike >= 2) return false;
  return totalLike >= 1 && totalLike >= dayLike;
}

function collectCellAnchorsFromBand(bandItems: PositionedText[], nameRight: number): BodyItem[] {
  const CLOCK_TIME_RE = /^([01]?\d|2[0-3])[:.][0-5]\d$/;
  const DASH_RE = /^[-–—]$/;
  const CODE_RE = /^(VAC|DL|ENFE?|FF|FT)$/i;

  const sorted = bandItems
    .filter((it) => it.x + it.width / 2 >= nameRight)
    .sort((a, b) => a.x - b.x);

  const anchors: BodyItem[] = [];
  const used = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const a = sorted[i].str.trim();
    if (!CLOCK_TIME_RE.test(a)) continue;

    let pairedIdx = -1;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const t = sorted[j].str.trim();
      if (!CLOCK_TIME_RE.test(t)) continue;

      let hasDash = false;
      for (let k = i + 1; k < j; k++) {
        if (used.has(k)) continue;
        if (DASH_RE.test(sorted[k].str.trim())) {
          hasDash = true;
          break;
        }
      }
      if (hasDash) pairedIdx = j;
      break;
    }

    if (pairedIdx !== -1) {
      const left = sorted[i].x;
      const right = sorted[pairedIdx].x + sorted[pairedIdx].width;
      anchors.push({ x: (left + right) / 2, str: `${a}-${sorted[pairedIdx].str.trim()}` });
      for (let k = i; k <= pairedIdx; k++) used.add(k);
    } else {
      used.add(i);
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const s = sorted[i].str.trim();
    if (CODE_RE.test(s)) {
      anchors.push({ x: sorted[i].x + sorted[i].width / 2, str: s });
    }
  }

  return anchors;
}

function findDayColumnsByBody(
  rows: Row[],
  items: PositionedText[]
): { headerRow: Row; columns: DayColumn[] } | null {
  const empRows = findEmployeeRows(rows);
  if (empRows.length < 2) return null;

  // Estimamos nameRight de forma aproximada (el primer item de la fila del empleado
  // es el ID, asumimos que los datos empiezan despues del nombre).
  const idEnds = empRows
    .map((r) => r.items[0])
    .filter(Boolean)
    .map((it) => it.x + it.width);
  const minIdEnd = idEnds.length > 0 ? Math.min(...idEnds) : 0;
  const approxNameRight = minIdEnd + 150;

  const bodyItems: BodyItem[] = [];
  for (const empRow of empRows) {
    const band = getEmployeeBand(empRow, empRows, items);
    bodyItems.push(...collectCellAnchorsFromBand(band, approxNameRight));
  }
  if (bodyItems.length < 7) return null;

  bodyItems.sort((a, b) => a.x - b.x);
  const xs = bodyItems.map((b) => b.x);
  const range = xs[xs.length - 1] - xs[0];
  if (range <= 0) return null;
  const gap = range / 40;

  interface Cluster {
    center: number;
    count: number;
    items: BodyItem[];
  }

  const clusters: Cluster[] = [];
  let group: BodyItem[] = [bodyItems[0]];
  const flush = () => {
    const sum = group.reduce((a, b) => a + b.x, 0);
    clusters.push({ center: sum / group.length, count: group.length, items: [...group] });
  };
  for (let i = 1; i < bodyItems.length; i++) {
    if (bodyItems[i].x - bodyItems[i - 1].x <= gap) {
      group.push(bodyItems[i]);
    } else {
      flush();
      group = [bodyItems[i]];
    }
  }
  flush();

  if (clusters.length < 7) return null;

  const byCount = [...clusters].sort((a, b) => b.count - a.count);
  const topN = Math.min(8, byCount.length);
  const sorted = byCount.slice(0, topN).sort((a, b) => a.center - b.center);

  while (sorted.length > 7 && clusterIsTotals(sorted[sorted.length - 1].items)) {
    sorted.pop();
  }

  const columns: DayColumn[] = sorted.map((c, i) => ({
    name: DAY_NAMES_ES[i % 7],
    dayOfWeek: i % 7,
    x: c.center,
    position: i,
  }));

  const datesRow = findDatesRowAbove(rows, empRows[0]);
  return { headerRow: datesRow ?? empRows[0], columns };
}

function findDatesRowAbove(rows: Row[], firstEmpRow: Row): Row | null {
  const bareDate = /^\d{1,2}$/;
  let best: { row: Row; count: number } | null = null;
  for (const row of rows) {
    if (row.page !== firstEmpRow.page) continue;
    if (row.y <= firstEmpRow.y) continue;
    let count = 0;
    for (const item of row.items) {
      if (bareDate.test(item.str.trim())) count++;
    }
    if (count >= 3 && (!best || count > best.count)) best = { row, count };
  }
  return best?.row ?? null;
}

function findDayColumnsByDateRowExtended(
  rows: Row[]
): { headerRow: Row; columns: DayColumn[] } | null {
  const empRows = findEmployeeRows(rows);
  if (empRows.length === 0) return null;
  const dateRow = findDatesRowAbove(rows, empRows[0]);
  if (!dateRow) return null;

  const dateItems = dateRow.items
    .filter((i) => /^\d{1,2}$/.test(i.str.trim()))
    .sort((a, b) => a.x - b.x);
  if (dateItems.length < 3) return null;

  const centers = dateItems.map((d) => d.x + d.width / 2);
  const steps: number[] = [];
  for (let i = 1; i < centers.length; i++) steps.push(centers[i] - centers[i - 1]);
  steps.sort((a, b) => a - b);
  const step = steps[Math.floor(steps.length / 2)];
  if (step <= 0) return null;

  // Asumimos Dom-Dom (8 cols): la primera fecha visible suele estar en col 1.
  // 1 col antes + n fechas + (8 - n - 1) col despues.
  const total = 8;
  const beforeCount = 1;
  const afterCount = Math.max(0, total - dateItems.length - beforeCount);

  const allCenters: number[] = [];
  for (let i = beforeCount; i >= 1; i--) allCenters.push(centers[0] - step * i);
  for (const c of centers) allCenters.push(c);
  for (let i = 1; i <= afterCount; i++) allCenters.push(centers[centers.length - 1] + step * i);

  const columns: DayColumn[] = allCenters.map((c, i) => ({
    name: DAY_NAMES_ES[i % 7],
    dayOfWeek: i % 7,
    x: c,
    position: i,
  }));

  return { headerRow: dateRow, columns };
}

function findDayColumns(rows: Row[], items: PositionedText[]) {
  return (
    findDayColumnsByName(rows) ??
    findDayColumnsByDates(rows) ??
    findDayColumnsByDateRowExtended(rows) ??
    findDayColumnsByBody(rows, items) ??
    findDayColumnsByName(rows, 5) ??
    findDayColumnsByDates(rows, 5)
  );
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

function normalizeTime(t: string): string {
  return t.replace('.', ':');
}

function isValidClock(time: string): boolean {
  const m = time.match(/^(\d{1,3})[:.](\d{2})$/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return h >= 0 && h < 24 && mm >= 0 && mm < 60;
}

function parseCellText(text: string): {
  status: DayStatus;
  timeRange?: string;
  rawCode?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { status: 'off', rawCode: '' };

  if (!/[a-zA-Z0-9]/.test(trimmed)) return { status: 'off', rawCode: '' };

  const strict = [...trimmed.matchAll(/(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/g)];
  const strictValid = strict.filter((m) => isValidClock(m[1]) && isValidClock(m[2]));
  if (strictValid.length > 0) {
    const formatted = strictValid
      .map((m) => `${normalizeTime(m[1])} – ${normalizeTime(m[2])}`)
      .join(' · ');
    return { status: 'work', timeRange: formatted };
  }

  const allTokens = trimmed.match(/\b\d{1,3}[:.]\d{2}\b/g) ?? [];
  const validTimes = allTokens.filter(isValidClock);
  if (validTimes.length >= 2) {
    const ranges: string[] = [];
    for (let i = 0; i + 1 < validTimes.length; i += 2) {
      ranges.push(`${normalizeTime(validTimes[i])} – ${normalizeTime(validTimes[i + 1])}`);
    }
    return { status: 'work', timeRange: ranges.join(' · ') };
  }

  const upper = trimmed.toUpperCase();
  if (/\bVAC\b/.test(upper)) return { status: 'vacation', rawCode: 'VAC' };
  if (/ENFE/.test(upper)) return { status: 'sick', rawCode: 'Enfe' };
  if (/\bDL\b/.test(upper)) return { status: 'off', rawCode: 'DL' };

  if (validTimes.length === 1) {
    return { status: 'other', rawCode: validTimes[0] };
  }

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

// JS getDay(): 0=Domingo .. 6=Sabado. Nuestro indice en DAY_NAMES_ES: 0=Lunes .. 6=Domingo.
function jsDayToSpanishIdx(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// Si no tenemos weekRange (tipico en OCR) construimos firstDate a partir del primer
// numero de la fila de fechas + mes/año actual, ajustando si la fecha cae demasiado
// adelantada (probable mes anterior).
function inferFirstDateFromContext(
  firstDateText: string,
  weekRangeStart: Date | null,
  today: Date
): Date | null {
  const dayMatch = firstDateText.match(/(?<!\d)(\d{1,2})(?!\d)/);
  if (!dayMatch) return weekRangeStart;
  const day = parseInt(dayMatch[1], 10);
  if (!day || day < 1 || day > 31) return weekRangeStart;

  if (weekRangeStart) {
    const adjusted = new Date(weekRangeStart);
    adjusted.setDate(day);
    return adjusted;
  }

  let year = today.getFullYear();
  let month = today.getMonth();
  const candidate = new Date(year, month, day);
  const diff = (candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 14) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    return new Date(year, month, day);
  }
  if (diff < -21) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    return new Date(year, month, day);
  }
  return candidate;
}

function relabelColumnsFromFirstDate(columns: DayColumn[], firstDate: Date | null): void {
  if (!firstDate) return;
  const firstDow = jsDayToSpanishIdx(firstDate.getDay());
  for (let i = 0; i < columns.length; i++) {
    const dow = (firstDow + i) % 7;
    columns[i].dayOfWeek = dow;
    columns[i].name = DAY_NAMES_ES[dow];
  }
}

export function debugRowDump(items: PositionedText[], maxRows = 200): string[] {
  const rows = groupIntoRows(items);
  return rows.slice(0, maxRows).map((r) => {
    const text = r.items
      .map((i) => `${i.str}@${Math.round(i.x)}`)
      .join(' | ');
    return `p${r.page} y=${Math.round(r.y)}  ${text}`;
  });
}

interface ExtractedEmployee {
  name: string;
  totalHours: string;
  days: DaySchedule[];
}

function extractEmployeeFromRow(
  empRow: Row,
  allEmpRows: Row[],
  items: PositionedText[],
  header: { columns: DayColumn[] },
  ranges: ColumnRange[],
  nameRight: number,
  totalLeft: number,
  datesByPos: Record<number, string>,
  firstDate: Date | null
): ExtractedEmployee {
  const band = getEmployeeBand(empRow, allEmpRows, items);

  const nameItems = band.filter((i) => i.x + i.width / 2 < nameRight);
  const rawName = nameItems
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const name = rawName.replace(/^\d+\s*/, '').trim() || rawName;

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

  return { name, totalHours, days };
}

export function parseSchedule(items: PositionedText[], query: string): WeekSchedule {
  const rows = groupIntoRows(items);

  const header = findDayColumns(rows, items);
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

  const { weekRange, format: headerFormat } = extractScheduleHeader(rows);
  const format: ScheduleFormat =
    headerFormat === 'monthly' || header.columns.length > 14 ? 'monthly' : 'weekly';

  const baseWeekStart = parseWeekStart(weekRange);

  // Busca la primera columna con fecha; si la columna 0 no la trae (OCR la perdio)
  // calcula hacia atras a partir de la primera disponible.
  let anchorPos = 0;
  let anchorRaw = (datesByPos[0] ?? '').trim();
  if (!anchorRaw) {
    for (let i = 1; i < header.columns.length; i++) {
      const candidate = (datesByPos[i] ?? '').trim();
      if (candidate) {
        anchorPos = i;
        anchorRaw = candidate;
        break;
      }
    }
  }

  let firstDate = resolveFirstColumnDate(baseWeekStart, anchorRaw, format);
  if (!firstDate && anchorRaw) {
    firstDate = inferFirstDateFromContext(anchorRaw, baseWeekStart, new Date());
  }
  if (firstDate && anchorPos > 0) {
    const shifted = new Date(firstDate);
    shifted.setDate(shifted.getDate() - anchorPos);
    firstDate = shifted;
  }

  relabelColumnsFromFirstDate(header.columns, firstDate);

  const main = extractEmployeeFromRow(
    employeeRow, allEmpRows, items, header, ranges, nameRight, totalLeft, datesByPos, firstDate
  );

  const allEmployees: EmployeeWeek[] = allEmpRows.map((row) => {
    if (row === employeeRow) {
      return {
        name: main.name,
        days: main.days.map((d) => ({
          dayName: d.dayName,
          date: d.date,
          status: d.status,
          timeRange: d.timeRange,
        })),
      };
    }
    const e = extractEmployeeFromRow(
      row, allEmpRows, items, header, ranges, nameRight, totalLeft, datesByPos, firstDate
    );
    return {
      name: e.name,
      days: e.days.map((d) => ({
        dayName: d.dayName,
        date: d.date,
        status: d.status,
        timeRange: d.timeRange,
      })),
    };
  });

  return {
    employeeName: main.name,
    weekRange,
    totalHours: main.totalHours,
    days: main.days,
    format,
    allEmployees,
  };
}
