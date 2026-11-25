import type { Converter } from './fx';
import { LIQUIDITY_LABELS, type Liquidity } from './liquidity';
import { latestBalance } from './netWorth';
import type { Account, DataFile } from './schema';

/**
 * Where the money sits (R-D5): current balances of active accounts, in the base currency at
 * today's rates (ADR-0018), grouped by tag or by liquidity, with assets and liabilities kept
 * apart. Same accounts, balances and rates as the headline net worth.
 */

export type GroupBy = 'tag' | 'liquidity';

export interface BreakdownRow {
  /** Stable key: the tag (lower case) or the liquidity level. */
  key: string;
  label: string;
  /** Set when grouping by liquidity (for its colour). */
  level?: Liquidity;
  /** Assets: the balance. Liabilities: the amount owed (positive). */
  amountMinor: number;
  accounts: number;
  /** Fraction of the section total (0–1), or null when the total isn't positive. */
  share: number | null;
}

export interface BreakdownSection {
  totalMinor: number;
  rows: BreakdownRow[];
}

export interface Breakdown {
  assets: BreakdownSection;
  liabilities: BreakdownSection;
  /** Currencies left out because there's no exchange rate for them yet. */
  unconverted: string[];
}

function groupOf(account: Account, groupBy: GroupBy) {
  if (groupBy === 'tag') return { key: account.tag.toLocaleLowerCase(), label: account.tag };
  const level = account.liquidity as Liquidity;
  return { key: String(level), label: `${String(level)} · ${LIQUIDITY_LABELS[level]}`, level };
}

function section(items: { account: Account; amountMinor: number }[], groupBy: GroupBy) {
  const groups = new Map<string, BreakdownRow>();
  for (const { account, amountMinor } of items) {
    const group = groupOf(account, groupBy);
    const row = groups.get(group.key) ?? { ...group, amountMinor: 0, accounts: 0, share: null };
    row.amountMinor += amountMinor;
    row.accounts += 1;
    groups.set(group.key, row);
  }
  const totalMinor = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const rows = [...groups.values()]
    .map((row) => ({ ...row, share: totalMinor > 0 ? row.amountMinor / totalMinor : null }))
    .sort((a, b) =>
      // Liquidity: most liquid first. Tags: largest first, then A–Z.
      groupBy === 'liquidity'
        ? Number(b.key) - Number(a.key)
        : b.amountMinor - a.amountMinor || a.label.localeCompare(b.label),
    );
  return { totalMinor, rows };
}

export function breakdown(
  data: Pick<DataFile, 'accounts' | 'balances'>,
  fx: Converter,
  groupBy: GroupBy,
  today: string,
): Breakdown {
  const assets: { account: Account; amountMinor: number }[] = [];
  const liabilities: { account: Account; amountMinor: number }[] = [];
  const unconverted = new Set<string>();
  for (const account of data.accounts) {
    if (account.archived) continue;
    const entry = latestBalance(account.id, data.balances, today);
    if (!entry) continue;
    const amountMinor = fx.toBase(entry.amountMinor, account.currency, today);
    if (amountMinor === null) unconverted.add(account.currency);
    else if (account.kind === 'asset') assets.push({ account, amountMinor });
    else liabilities.push({ account, amountMinor: -amountMinor });
  }
  return {
    assets: section(assets, groupBy),
    liabilities: section(liabilities, groupBy),
    unconverted: [...unconverted].sort(),
  };
}
