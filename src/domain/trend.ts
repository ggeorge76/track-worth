import { addMonths, endOfMonth, financialYearStart, startOfMonth } from './dates';
import { percentChange } from './money';
import type { Converter } from './fx';
import type { AccountKind, BalanceEntry, DataFile, HistoryPoint } from './schema';

/**
 * Net worth over time (R-D3) and the change over the shown period (R-D4).
 *
 * Honest-numbers rules (SOUL.md):
 * - An account's balance on a date is its latest entry on or before that date (carried forward).
 *   Nothing is interpolated or projected. Before an account's first entry it counts as nothing.
 * - Everything is shown in the base currency: each balance is valued at the rate for the date
 *   being plotted (ADR-0018). A currency without a rate is left out and reported, never guessed.
 * - Uses the same accounts as the headline net worth (archived accounts are left out), so the
 *   last point always equals the number shown above the chart.
 */

export type TrendRange = '1M' | '6M' | '1Y' | 'All';
export const TREND_RANGES: readonly TrendRange[] = ['1M', '6M', '1Y', 'All'];
export const DEFAULT_TREND_RANGE: TrendRange = '1Y';

export interface TrendPoint {
  date: string;
  /** In the base currency. `null` before any account has a balance (and no earlier history). */
  netMinor: number | null;
  /** From earlier net-worth history (ADR-0017), not from accounts. Drawn lighter. */
  imported?: true;
}

export interface Trend {
  points: TrendPoint[];
  /** Change from the first point with data to the last point. */
  change?: { fromDate: string; deltaMinor: number; percent: number | null };
  /** Start of the current financial year, when it falls inside the range (drawn as a line). */
  financialYearStart?: string;
  /** Currencies left out of some points for lack of an exchange rate (ADR-0018). */
  unconverted?: string[];
}

/** First date shown for a range; `All` starts at the earliest entry. */
export function rangeStart(range: TrendRange, today: string, earliest: string): string {
  switch (range) {
    case '1M':
      return addMonths(today, -1);
    case '6M':
      return addMonths(today, -6);
    case '1Y':
      return addMonths(today, -12);
    case 'All':
      return earliest;
  }
}

/**
 * Dates to sample: the range start, then month-ends (or, for 1M, each day with an entry), then
 * today. Net worth only changes on entry dates, so this shows every change in 1M and the
 * month-end position for longer ranges (most people update monthly).
 */
function sampleDates(start: string, today: string, range: TrendRange, entryDates: string[]) {
  if (start >= today) return [today];
  const inner =
    range === '1M'
      ? [...new Set(entryDates)].filter((d) => d > start && d < today).sort()
      : monthEnds(start, today);
  return [start, ...inner, today];
}

function monthEnds(start: string, today: string): string[] {
  const dates: string[] = [];
  for (let month = startOfMonth(start); ; month = addMonths(month, 1)) {
    const end = endOfMonth(month);
    if (end >= today) return dates;
    if (end > start) dates.push(end);
  }
}

export function netWorthTrend(
  data: Pick<DataFile, 'accounts' | 'balances' | 'settings' | 'netWorthHistory'>,
  options: { fx: Converter; range: TrendRange; today: string },
): Trend {
  const { fx, range, today } = options;
  const currencyOf = new Map(
    data.accounts.filter((a) => !a.archived).map((a) => [a.id, a.currency]),
  );
  // Entries per account, oldest first (one entry per account per day, enforced by the schema).
  const histories = new Map<string, BalanceEntry[]>();
  for (const entry of data.balances) {
    if (!currencyOf.has(entry.accountId) || entry.date > today) continue;
    const list = histories.get(entry.accountId) ?? [];
    list.push(entry);
    histories.set(entry.accountId, list);
  }
  const all = [...histories.values()].flat();
  for (const list of histories.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  // Earlier monthly totals (ADR-0017), per currency, fill only the time before the first entry.
  const imported = new Map<string, HistoryPoint[]>();
  for (const point of data.netWorthHistory) {
    if (point.date > today) continue;
    const list = imported.get(point.currency) ?? [];
    list.push(point);
    imported.set(point.currency, list);
  }
  for (const list of imported.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  const importedDates = [...imported.values()].flat().map((p) => p.date);

  const firstEntry = all.reduce<string | undefined>(
    (min, e) => (min === undefined || e.date < min ? e.date : min),
    undefined,
  );
  const earliest = [...importedDates, firstEntry]
    .filter((d): d is string => d !== undefined)
    .sort()[0];
  if (earliest === undefined) return { points: [] };

  const start = rangeStart(range, today, earliest);
  const dates = sampleDates(start, today, range, [...all.map((e) => e.date), ...importedDates]);

  // Sweep the dates in order, moving each pointer forward (linear in entries). Each balance is
  // valued at the sample date's rate.
  const unconverted = new Set<string>();
  const latestOn = <T extends { date: string }>(
    cursor: Map<string, number>,
    key: string,
    list: readonly T[],
    date: string,
  ): T | undefined => {
    let i = cursor.get(key) ?? -1;
    for (let next = list[i + 1]; next && next.date <= date; next = list[i + 1]) i++;
    cursor.set(key, i);
    return list[i];
  };
  const entryCursor = new Map<string, number>();
  const importedCursor = new Map<string, number>();
  const points = dates.map((date): TrendPoint => {
    let sum = 0;
    for (const [id, list] of histories) {
      const entry = latestOn(entryCursor, id, list, date);
      if (!entry) continue;
      const currency = currencyOf.get(id) as string;
      const amount = fx.toBase(entry.amountMinor, currency, date);
      if (amount === null) unconverted.add(currency);
      else sum += amount;
    }
    if (firstEntry !== undefined && date >= firstEntry) return { date, netMinor: sum };
    // Before the first entry no account has a balance yet, so only imported totals can show.
    let total: number | null = null;
    for (const [currency, list] of imported) {
      const point = latestOn(importedCursor, currency, list, date);
      if (!point) continue;
      const amount = fx.toBase(point.amountMinor, currency, date);
      if (amount === null) unconverted.add(currency);
      else total = (total ?? 0) + amount;
    }
    return total === null ? { date, netMinor: null } : { date, netMinor: total, imported: true };
  });

  const trend: Trend = { points };
  if (unconverted.size > 0) trend.unconverted = [...unconverted].sort();
  const first = points.find((p) => p.netMinor !== null);
  const last = points.at(-1);
  if (first && last && first !== last && first.netMinor !== null && last.netMinor !== null) {
    const deltaMinor = last.netMinor - first.netMinor;
    trend.change = {
      fromDate: first.date,
      deltaMinor,
      percent: percentChange(deltaMinor, first.netMinor),
    };
  }
  const fy = financialYearMarker(range, start, today, data.settings.financialYearStartMonth);
  if (fy) trend.financialYearStart = fy;
  return trend;
}

/** The current financial year's start, when it falls inside the range (never for All). */
function financialYearMarker(range: TrendRange, start: string, today: string, startMonth: number) {
  const fy = financialYearStart(today, startMonth);
  return range !== 'All' && fy > start && fy <= today ? fy : undefined;
}

export interface AccountTrendPoint {
  date: string;
  /** Balance as charted: liabilities as the amount owed (positive). `null` before any entry. */
  valueMinor: number | null;
  /** True where the user entered a balance (drawn as a dot); false for carried-forward edges. */
  entry: boolean;
}

/**
 * One account's balance over time (R-B4): every entry in the range, plus the balance carried in
 * at the range start and carried on to today, so the line spans the range without inventing
 * values. Liabilities are charted as the amount owed, so paying a loan off reads as a fall.
 */
export function accountTrend(
  entries: readonly BalanceEntry[],
  options: { kind: AccountKind; range: TrendRange; today: string; financialYearStartMonth: number },
): { points: AccountTrendPoint[]; financialYearStart?: string } {
  const { kind, range, today } = options;
  const sorted = entries
    .filter((e) => e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (!first) return { points: [] };
  const value = (e: BalanceEntry | undefined) =>
    e ? (kind === 'liability' ? -e.amountMinor : e.amountMinor) : null;

  const start = rangeStart(range, today, first.date);
  const inRange = sorted.filter((e) => e.date >= start);
  const points: AccountTrendPoint[] = inRange.map((e) => ({
    date: e.date,
    valueMinor: value(e),
    entry: true,
  }));
  if (inRange[0]?.date !== start) {
    points.unshift({
      date: start,
      valueMinor: value(sorted.findLast((e) => e.date < start)),
      entry: false,
    });
  }
  const last = points.at(-1);
  if (last && last.date !== today)
    points.push({ date: today, valueMinor: last.valueMinor, entry: false });

  const fy = financialYearMarker(range, start, today, options.financialYearStartMonth);
  return fy ? { points, financialYearStart: fy } : { points };
}
