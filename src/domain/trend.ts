import { addMonths, endOfMonth, financialYearStart, startOfMonth } from './dates';
import { percentChange } from './money';
import type { AccountKind, BalanceEntry, DataFile } from './schema';

/**
 * Net worth over time (R-D3) and the change over the shown period (R-D4).
 *
 * Honest-numbers rules (SOUL.md):
 * - An account's balance on a date is its latest entry on or before that date (carried forward).
 *   Nothing is interpolated or projected. Before an account's first entry it counts as nothing.
 * - One currency per series; currencies are never mixed.
 * - Uses the same accounts as the headline net worth (archived accounts are left out), so the
 *   last point always equals the number shown above the chart.
 */

export type TrendRange = '1M' | '6M' | '1Y' | 'All';
export const TREND_RANGES: readonly TrendRange[] = ['1M', '6M', '1Y', 'All'];
export const DEFAULT_TREND_RANGE: TrendRange = '1Y';

export interface TrendPoint {
  date: string;
  /** `null` before any account in this currency has a balance. */
  netMinor: number | null;
}

export interface Trend {
  points: TrendPoint[];
  /** Change from the first point with data to the last point. */
  change?: { fromDate: string; deltaMinor: number; percent: number | null };
  /** Start of the current financial year, when it falls inside the range (drawn as a line). */
  financialYearStart?: string;
}

/** Currencies that have a net worth to chart: the base currency first, then A–Z. */
export function trendCurrencies(data: Pick<DataFile, 'accounts' | 'balances' | 'baseCurrency'>) {
  const withEntries = new Set(data.balances.map((e) => e.accountId));
  const currencies = new Set(
    data.accounts.filter((a) => !a.archived && withEntries.has(a.id)).map((a) => a.currency),
  );
  return [...currencies].sort((a, b) =>
    a === data.baseCurrency ? -1 : b === data.baseCurrency ? 1 : a.localeCompare(b),
  );
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
  data: Pick<DataFile, 'accounts' | 'balances' | 'settings'>,
  options: { currency: string; range: TrendRange; today: string },
): Trend {
  const { currency, range, today } = options;
  const accountIds = new Set(
    data.accounts.filter((a) => !a.archived && a.currency === currency).map((a) => a.id),
  );
  // Entries per account, oldest first (one entry per account per day, enforced by the schema).
  const histories = new Map<string, BalanceEntry[]>();
  for (const entry of data.balances) {
    if (!accountIds.has(entry.accountId) || entry.date > today) continue;
    const list = histories.get(entry.accountId) ?? [];
    list.push(entry);
    histories.set(entry.accountId, list);
  }
  const all = [...histories.values()].flat();
  if (all.length === 0) return { points: [] };
  for (const list of histories.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const earliest = all.reduce((min, e) => (e.date < min ? e.date : min), today);
  const start = rangeStart(range, today, earliest);
  const dates = sampleDates(
    start,
    today,
    range,
    all.map((e) => e.date),
  );

  // Sweep the dates in order, moving each account's pointer forward (linear in entries).
  const cursor = new Map<string, number>();
  const points = dates.map((date): TrendPoint => {
    let sum = 0;
    let any = false;
    for (const [id, list] of histories) {
      let i = cursor.get(id) ?? -1;
      for (let next = list[i + 1]; next && next.date <= date; next = list[i + 1]) i++;
      cursor.set(id, i);
      const entry = list[i];
      if (entry) {
        sum += entry.amountMinor;
        any = true;
      }
    }
    return { date, netMinor: any ? sum : null };
  });

  const trend: Trend = { points };
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
