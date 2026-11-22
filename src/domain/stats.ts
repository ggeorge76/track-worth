import { accountHistory } from './balances';
import { financialYearStart, startOfMonth } from './dates';
import type { AccountKind, BalanceEntry } from './schema';

export interface BalanceChange {
  /** current − base, in minor units. */
  deltaMinor: number;
  /** The entry the change is measured from. */
  base: BalanceEntry;
}

export interface BalanceStats {
  current?: BalanceEntry;
  /** Change since the entry before the current one. */
  sincePrevious?: BalanceChange;
  /** Change since the last entry dated before the current month. */
  sincePreviousMonth?: BalanceChange;
  /** Change since the last entry dated before the current financial year. */
  sincePreviousFinancialYear?: BalanceChange;
  /**
   * Assets: highest balance. Liabilities: peak debt, i.e. the most negative balance.
   * Ties go to the earliest date (when it was first reached).
   */
  allTimeHigh?: BalanceEntry;
}

/**
 * Figures for the account details page. `today` (YYYY-MM-DD) is the reference for "previous
 * month" and "previous financial year".
 */
export function balanceStats(
  balances: readonly BalanceEntry[],
  accountId: string,
  kind: AccountKind,
  today: string,
  financialYearStartMonth: number,
): BalanceStats {
  const history = accountHistory(balances, accountId);
  const current = history[0];
  if (!current) return {};

  const change = (base: BalanceEntry | undefined): BalanceChange | undefined =>
    base ? { deltaMinor: current.amountMinor - base.amountMinor, base } : undefined;

  const monthStart = startOfMonth(today);
  const yearStart = financialYearStart(today, financialYearStartMonth);

  let allTimeHigh = current;
  for (const entry of history) {
    const better =
      kind === 'asset'
        ? entry.amountMinor >= allTimeHigh.amountMinor
        : entry.amountMinor <= allTimeHigh.amountMinor;
    // History is newest-first, so `>=`/`<=` moves ties towards the earliest date.
    if (better) allTimeHigh = entry;
  }

  const stats: BalanceStats = { current, allTimeHigh };
  const sincePrevious = change(history[1]);
  const sincePreviousMonth = change(history.find((e) => e.date < monthStart));
  const sincePreviousFinancialYear = change(history.find((e) => e.date < yearStart));
  if (sincePrevious) stats.sincePrevious = sincePrevious;
  if (sincePreviousMonth) stats.sincePreviousMonth = sincePreviousMonth;
  if (sincePreviousFinancialYear) stats.sincePreviousFinancialYear = sincePreviousFinancialYear;
  return stats;
}
