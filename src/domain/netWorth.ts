import type { Account, BalanceEntry, DataFile } from './schema';

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
  assetsMinor: number;
  liabilitiesMinor: number;
  netMinor: number;
}

/**
 * Net worth grouped by currency. No FX conversion yet: mixing currencies into one
 * number needs exchange rates, which is a separate, deliberate decision (see roadmap).
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
    applyEntry(t, account, entry.amountMinor);
  }
  return totals;
}

function applyEntry(t: CurrencyTotals, account: Account, amountMinor: number): void {
  if (account.kind === 'asset') {
    t.assetsMinor += amountMinor;
    t.netMinor += amountMinor;
  } else {
    t.liabilitiesMinor += amountMinor;
    t.netMinor -= amountMinor;
  }
}
