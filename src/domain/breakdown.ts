import { LIQUIDITY_LABELS, LIQUIDITY_LEVELS } from './liquidity';
import { latestBalance } from './netWorth';
import type { DataFile } from './schema';

/**
 * Where the money sits (R-D5): current balances of active accounts in one currency, grouped by
 * tag (assets and liabilities separately) and by liquidity (assets only: how easily they turn
 * into cash). Same accounts and balances as the headline net worth; currencies are never mixed.
 */

export interface BreakdownRow {
  label: string;
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
  assetsByTag: BreakdownSection;
  assetsByLiquidity: BreakdownSection;
  liabilitiesByTag: BreakdownSection;
}

interface Item {
  label: string;
  amountMinor: number;
}

function section(items: Item[], order?: readonly string[]): BreakdownSection {
  const groups = new Map<string, { label: string; amountMinor: number; accounts: number }>();
  for (const item of items) {
    const key = item.label.toLocaleLowerCase();
    const group = groups.get(key) ?? { label: item.label, amountMinor: 0, accounts: 0 };
    group.amountMinor += item.amountMinor;
    group.accounts += 1;
    groups.set(key, group);
  }
  const totalMinor = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const rows = [...groups.values()]
    .map((g) => ({ ...g, share: totalMinor > 0 ? g.amountMinor / totalMinor : null }))
    .sort((a, b) =>
      order
        ? order.indexOf(a.label) - order.indexOf(b.label)
        : b.amountMinor - a.amountMinor || a.label.localeCompare(b.label),
    );
  return { totalMinor, rows };
}

export function breakdown(
  data: Pick<DataFile, 'accounts' | 'balances'>,
  currency: string,
): Breakdown {
  const assets: { tag: Item; liquidity: Item }[] = [];
  const liabilities: Item[] = [];
  for (const account of data.accounts) {
    if (account.archived || account.currency !== currency) continue;
    const entry = latestBalance(account.id, data.balances);
    if (!entry) continue;
    if (account.kind === 'asset') {
      assets.push({
        tag: { label: account.tag, amountMinor: entry.amountMinor },
        liquidity: {
          label: liquidityLabel(account.liquidity),
          amountMinor: entry.amountMinor,
        },
      });
    } else {
      liabilities.push({ label: account.tag, amountMinor: -entry.amountMinor });
    }
  }
  return {
    assetsByTag: section(assets.map((a) => a.tag)),
    // Most liquid first, the way people think about "what could I use now".
    assetsByLiquidity: section(
      assets.map((a) => a.liquidity),
      [...LIQUIDITY_LEVELS].reverse().map(liquidityLabel),
    ),
    liabilitiesByTag: section(liabilities),
  };
}

function liquidityLabel(level: number): string {
  return `${String(level)} · ${LIQUIDITY_LABELS[level as keyof typeof LIQUIDITY_LABELS]}`;
}
