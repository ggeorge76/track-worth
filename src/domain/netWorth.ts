import type { BalanceEntry, DataFile } from './schema';

/** Latest balance entry for an account on or before `asOf` (YYYY-MM-DD), if any. */
export function latestBalance(
  accountId: string,
  balances: readonly BalanceEntry[],
  asOf?: string,
): BalanceEntry | undefined {
  let latest: BalanceEntry | undefined;
  for (const entry of balances) {
    if (entry.accountId !== accountId) continue;
    if (asOf !== undefined && entry.date > asOf) continue;
    if (
      !latest ||
      entry.date > latest.date ||
      (entry.date === latest.date && entry.recordedAt > latest.recordedAt)
    ) {
      latest = entry;
    }
  }
  return latest;
}

export interface CurrencyTotals {
  /** Sum of asset accounts' current balances. */
  assetsMinor: number;
  /** Sum of liability accounts' current balances (normally negative). */
  liabilitiesMinor: number;
  /** assets + liabilities. */
  netMinor: number;
}

/**
 * Net worth grouped by currency, from each active account's latest balance. Balances are signed
 * (liabilities negative), so net worth is a plain sum. No FX conversion yet: mixing currencies
 * needs exchange rates, which is a separate, deliberate decision (see roadmap).
 */
export function netWorthByCurrency(
  data: Pick<DataFile, 'accounts' | 'balances'>,
  asOf?: string,
): Record<string, CurrencyTotals> {
  const totals: Record<string, CurrencyTotals> = {};
  for (const account of data.accounts) {
    if (account.archived) continue;
    const entry = latestBalance(account.id, data.balances, asOf);
    if (!entry) continue;
    const t = (totals[account.currency] ??= { assetsMinor: 0, liabilitiesMinor: 0, netMinor: 0 });
    if (account.kind === 'asset') t.assetsMinor += entry.amountMinor;
    else t.liabilitiesMinor += entry.amountMinor;
    t.netMinor += entry.amountMinor;
  }
  return totals;
}
