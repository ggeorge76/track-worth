import { DEFAULT_FINANCIAL_YEAR_START_MONTH } from '../settings';
import type { DataFileV1 } from './v1';

type V1Category = DataFileV1['accounts'][number]['category'];

/** v1 had a fixed category list; v2 has free-text tags (ADR-0006, docs/data-model.md). */
const TAG_FOR_CATEGORY: Record<V1Category, string> = {
  cash: 'Cash',
  bank: 'Cash',
  investment: 'Equity',
  retirement: 'Equity',
  property: 'Real Assets',
  vehicle: 'Real Assets',
  crypto: 'Alternative Assets',
  other_asset: 'Alternative Assets',
  credit_card: 'Debt',
  loan: 'Debt',
  mortgage: 'Debt',
  other_liability: 'Debt',
};

/** Best-guess liquidity (1 = low, 5 = high) for v1 accounts, editable afterwards. */
const LIQUIDITY_FOR_CATEGORY: Record<V1Category, number> = {
  cash: 5,
  bank: 5,
  investment: 4,
  retirement: 2,
  property: 1,
  vehicle: 2,
  crypto: 4,
  other_asset: 3,
  credit_card: 5,
  loan: 2,
  mortgage: 1,
  other_liability: 3,
};

/**
 * v1 → v2:
 * - `category` (enum) becomes `tag` (free text); `liquidity` is added.
 * - Balances become signed: liability amounts (stored as positive "amount owed") are negated.
 * - At most one entry per account per date: keep the most recently recorded one.
 * - New `settings` block with defaults.
 */
export function migrateV1ToV2(v1: DataFileV1): unknown {
  const liabilityIds = new Set(v1.accounts.filter((a) => a.kind === 'liability').map((a) => a.id));

  const latestPerDay = new Map<string, DataFileV1['balances'][number]>();
  for (const entry of v1.balances) {
    const key = `${entry.accountId}|${entry.date}`;
    const existing = latestPerDay.get(key);
    if (!existing || entry.recordedAt > existing.recordedAt) latestPerDay.set(key, entry);
  }

  return {
    schemaVersion: 2,
    updatedAt: v1.updatedAt,
    baseCurrency: v1.baseCurrency,
    settings: { financialYearStartMonth: DEFAULT_FINANCIAL_YEAR_START_MONTH, customTags: [] },
    accounts: v1.accounts.map(({ category, ...rest }) => ({
      ...rest,
      tag: TAG_FOR_CATEGORY[category],
      liquidity: LIQUIDITY_FOR_CATEGORY[category],
    })),
    balances: [...latestPerDay.values()].map((entry) => ({
      ...entry,
      // `|| 0` avoids writing -0 for a zero balance.
      amountMinor: liabilityIds.has(entry.accountId) ? -entry.amountMinor || 0 : entry.amountMinor,
    })),
  };
}
