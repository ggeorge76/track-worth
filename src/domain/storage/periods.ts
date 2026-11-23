import { addDays, addYears, financialYearEnd, financialYearStart } from '../dates';

/**
 * Balance-file periods (ADR-0014). Each balance file covers one contiguous period, recorded in
 * settings.json. Periods never overlap and leave no gaps, and every file is named after the year
 * its period starts (`balances/2025.json`).
 */
export interface Period {
  file: string;
  from: string;
  to: string;
}

export const BALANCES_DIR = 'balances';

export function fileNameFor(from: string): string {
  return `${BALANCES_DIR}/${from.slice(0, 4)}.json`;
}

/** The financial year containing `date` under a year starting in `startMonth`. */
export function financialYearOf(date: string, startMonth: number): { from: string; to: string } {
  const from = financialYearStart(date, startMonth);
  return { from, to: financialYearEnd(from) };
}

const byFrom = (a: Period, b: Period) => a.from.localeCompare(b.from);

export function findPeriod(periods: readonly Period[], date: string): Period | undefined {
  return periods.find((p) => p.from <= date && date <= p.to);
}

/** Throws if periods overlap, leave gaps, are inverted, or share a file name (a bug guard). */
export function assertValidPeriods(periods: readonly Period[]): void {
  const sorted = [...periods].sort(byFrom);
  const names = new Set<string>();
  sorted.forEach((p, i) => {
    if (p.from > p.to) throw new Error(`Period ${p.file} ends before it starts`);
    if (p.file !== fileNameFor(p.from)) throw new Error(`Period ${p.file} is misnamed`);
    if (names.has(p.file)) throw new Error(`Two periods named ${p.file}`);
    names.add(p.file);
    const prev = sorted[i - 1];
    if (prev && addDays(prev.to, 1) !== p.from) {
      throw new Error(`Periods ${prev.file} and ${p.file} overlap or leave a gap`);
    }
  });
}

/**
 * Extend `periods` so every date in `dates` is covered.
 * - No periods yet: the financial year containing the date.
 * - Later dates: new files follow on from the last one, one financial year each.
 * - Earlier dates (e.g. an import): files of 12 months, working backwards from the first file.
 */
export function ensureCovered(
  periods: readonly Period[],
  dates: Iterable<string>,
  startMonth: number,
): Period[] {
  const result = [...periods].sort(byFrom).map((p) => ({ ...p }));
  const unique = [...new Set(dates)].sort();
  for (const date of unique) {
    if (findPeriod(result, date)) continue;
    if (result.length === 0) {
      const fy = financialYearOf(date, startMonth);
      result.push({ file: fileNameFor(fy.from), ...fy });
      continue;
    }
    for (let last = result.at(-1); last && date > last.to; last = result.at(-1)) {
      const from = addDays(last.to, 1);
      const to = financialYearOf(from, startMonth).to;
      if (fileNameFor(from) === last.file)
        last.to = to; // same start year: extend instead
      else result.push({ file: fileNameFor(from), from, to });
    }
    for (let first = result[0]; first && date < first.from; first = result[0]) {
      const from = addYears(first.from, -1);
      result.unshift({ file: fileNameFor(from), from, to: addDays(first.from, -1) });
    }
  }
  assertValidPeriods(result);
  return result;
}

/**
 * Apply a new financial-year start (ADR-0014): the current financial year under the new
 * setting (the one containing `today`) gets its own file; the file before it is shortened or
 * lengthened to meet it; all older files stay as they are. If the previous file would share the
 * current file's name, its months join the file before it instead.
 */
export function realign(periods: readonly Period[], today: string, startMonth: number): Period[] {
  if (periods.length === 0) return [];
  const current = financialYearOf(today, startMonth);
  // Files starting on or after the new current year are folded into it (or re-created later
  // for future dates by ensureCovered).
  const kept = [...periods]
    .sort(byFrom)
    .filter((p) => p.from < current.from)
    .map((p) => ({ ...p }));
  let currentFrom = current.from;

  const previous = kept.at(-1);
  if (previous) {
    previous.to = addDays(current.from, -1);
    if (previous.file === fileNameFor(current.from)) {
      kept.pop();
      const before = kept.at(-1);
      if (before) before.to = addDays(current.from, -1);
      else currentFrom = previous.from; // nothing earlier to join: the current file absorbs it
    }
  }

  const result = [...kept, { file: fileNameFor(currentFrom), from: currentFrom, to: current.to }];
  assertValidPeriods(result);
  return result;
}
