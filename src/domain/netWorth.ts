import type { Converter } from './fx';
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

export interface BaseTotals extends CurrencyTotals {
  /** Currencies left out because there's no exchange rate for them yet. */
  unconverted: string[];
}

/**
 * Net worth in the base currency on `date` (ADR-0018): each active account's latest balance on or
 * before that date, valued at that date's rate (what the money was worth then, not when it was
 * entered). Accounts whose currency has no rate are left out and listed.
 */
export function netWorthInBase(
  data: Pick<DataFile, 'accounts' | 'balances'>,
  fx: Converter,
  date: string,
): BaseTotals {
  const totals: BaseTotals = { assetsMinor: 0, liabilitiesMinor: 0, netMinor: 0, unconverted: [] };
  const missing = new Set<string>();
  for (const account of data.accounts) {
    if (account.archived) continue;
    const entry = latestBalance(account.id, data.balances, date);
    if (!entry) continue;
    const amount = fx.toBase(entry.amountMinor, account.currency, date);
    if (amount === null) {
      missing.add(account.currency);
      continue;
    }
    if (account.kind === 'asset') totals.assetsMinor += amount;
    else totals.liabilitiesMinor += amount;
    totals.netMinor += amount;
  }
  totals.unconverted = [...missing].sort();
  return totals;
}

/** Whether any active account has a balance (so there is a net worth to show). */
export function hasBalances(data: Pick<DataFile, 'accounts' | 'balances'>): boolean {
  const active = new Set(data.accounts.filter((a) => !a.archived).map((a) => a.id));
  return data.balances.some((e) => active.has(e.accountId));
}
