import { addMonths, endOfMonth, monthNames } from './dates';
import { parseMoneyInput } from './money';
import { dataFileSchema, type DataFile, type HistoryPoint } from './schema';

/**
 * Earlier net-worth history (ADR-0017): monthly totals from before the user had accounts in
 * TrackWorth, read from a spreadsheet export.
 */

export type HistoryCsvResult =
  { ok: true; points: HistoryPoint[]; notes: string[] } | { ok: false; error: string };

/** RFC 4180-style rows: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src.charAt(i);
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS = monthNames('en').map((m) => m.toLowerCase());

/** "April-2011", "Apr 2011", "apr/2011" or "2011-04" → "2011-04". */
export function parseMonth(text: string): string | null {
  const value = text.trim().toLowerCase();
  const iso = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (iso) {
    const [, year = '', monthText = ''] = iso;
    const month = Number(monthText);
    return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, '0')}` : null;
  }
  const named = /^([a-z]+)[\s\-/.,]+(\d{4})$/.exec(value);
  if (!named) return null;
  const [, name = '', year = ''] = named;
  const index = MONTHS.findIndex((m) => name.length >= 3 && m.startsWith(name));
  return index < 0 ? null : `${year}-${String(index + 1).padStart(2, '0')}`;
}

/** A cell, or empty when the row is shorter than the header. */
const cell = (row: readonly string[], index: number) => row[index] ?? '';

function columnIndex(header: string[], words: string[]): number {
  return header.findIndex((h) => words.every((w) => h.toLowerCase().includes(w)));
}

/**
 * Monthly totals from a CSV with a month column ("Month/Year") and a "Closing Worth" column.
 * Each month's closing worth becomes the total on its last day. The first month's "Opening
 * Worth" (if present) becomes the total at the end of the month before it. Other columns are
 * ignored. A month repeated with the same value is used once; with different values it's an
 * error, as is any value we can't read.
 */
export function parseHistoryCsv(text: string, currency: string): HistoryCsvResult {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ''));
  const [header, ...body] = rows;
  if (!header) return { ok: false, error: 'The file is empty.' };
  const monthCol = columnIndex(header, ['month']);
  const closingCol = columnIndex(header, ['closing']);
  const openingCol = columnIndex(header, ['opening']);
  if (monthCol < 0 || closingCol < 0) {
    return {
      ok: false,
      error: 'Couldn’t find the columns. The first row needs a “Month” and a “Closing” column.',
    };
  }

  const byDate = new Map<string, number>();
  const notes: string[] = [];
  let firstMonth: { month: string; opening: string } | undefined;
  for (const [i, row] of body.entries()) {
    const line = i + 2; // 1-based, after the header
    const monthText = cell(row, monthCol);
    const month = parseMonth(monthText);
    if (!month) return { ok: false, error: `Row ${String(line)}: “${monthText}” isn’t a month.` };
    const closingText = cell(row, closingCol);
    const amount = parseMoneyInput(closingText, currency);
    if (amount === null) {
      return { ok: false, error: `Row ${String(line)}: “${closingText}” isn’t an amount.` };
    }
    const date = endOfMonth(`${month}-01`);
    const seen = byDate.get(date);
    if (seen !== undefined) {
      if (seen !== amount) {
        return {
          ok: false,
          error: `Row ${String(line)}: ${monthText.trim()} appears twice with different values.`,
        };
      }
      notes.push(`${monthText.trim()} appears twice with the same value; used once.`);
      continue;
    }
    byDate.set(date, amount);
    if (!firstMonth || month < firstMonth.month) {
      firstMonth = { month, opening: openingCol < 0 ? '' : cell(row, openingCol) };
    }
  }

  if (firstMonth && firstMonth.opening.trim() !== '') {
    const opening = parseMoneyInput(firstMonth.opening, currency);
    const before = endOfMonth(addMonths(`${firstMonth.month}-01`, -1));
    if (opening !== null && !byDate.has(before)) byDate.set(before, opening);
  }

  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amountMinor]) => ({ date, amountMinor, currency }));
  if (points.length === 0) return { ok: false, error: 'No months found below the header row.' };
  return { ok: true, points, notes };
}

/** Replace the earlier history for the points' currency (other currencies are kept). */
export function replaceNetWorthHistory(
  data: DataFile,
  currency: string,
  points: readonly HistoryPoint[],
): DataFile {
  return dataFileSchema.parse({
    ...data,
    netWorthHistory: [
      ...data.netWorthHistory.filter((p) => p.currency !== currency),
      ...points.map((p) => ({ ...p, currency })),
    ],
  });
}
