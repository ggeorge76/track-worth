import { latestBalance } from './netWorth';
import type { Account, BalanceEntry } from './schema';

/** Start page view options (sort, filter, group). UI state, not stored in the data file. */
export type SortKey = 'name' | 'liquidity' | 'tag';
export type SortDirection = 'asc' | 'desc';

export interface ListOptions {
  sort: { key: SortKey; direction: SortDirection };
  /** Show only these tags (empty = all). */
  tags: readonly string[];
  /** Show only these liquidity levels (empty = all). */
  liquidity: readonly number[];
  groupByTag: boolean;
}

export const DEFAULT_LIST_OPTIONS: ListOptions = {
  sort: { key: 'name', direction: 'asc' },
  tags: [],
  liquidity: [],
  groupByTag: false,
};

/** Natural first direction for each sort: A→Z, and most liquid first. */
export const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  name: 'asc',
  tag: 'asc',
  liquidity: 'desc',
};

export interface AccountRow {
  account: Account;
  /** Latest balance entry, if any. */
  current?: BalanceEntry;
}

export interface AccountGroup {
  /** Tag name when grouped, otherwise null (a single ungrouped list). */
  tag: string | null;
  rows: AccountRow[];
}

const lower = (s: string) => s.toLocaleLowerCase();
/**
 * Sort key for names: ignores leading emoji and symbols, so "💵 HDFC" sorts under H. Many users
 * prefix names with an emoji as an icon.
 */
export function nameSortKey(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '') || name;
}

const byName = (a: Account, b: Account) =>
  nameSortKey(a.name).localeCompare(nameSortKey(b.name), undefined, { sensitivity: 'base' });

function compare(key: SortKey, a: Account, b: Account): number {
  switch (key) {
    case 'name':
      return byName(a, b);
    case 'liquidity':
      return a.liquidity - b.liquidity;
    case 'tag':
      return a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' });
  }
}

export function isFiltered(options: ListOptions): boolean {
  return options.tags.length > 0 || options.liquidity.length > 0;
}

/**
 * Accounts for the start page: active only, filtered, sorted (ties broken by name, always A→Z)
 * and optionally grouped by tag (groups in tag order, honouring the sort direction for tag).
 */
export function buildAccountList(
  accounts: readonly Account[],
  balances: readonly BalanceEntry[],
  options: ListOptions,
): { groups: AccountGroup[]; shown: number; total: number } {
  const active = accounts.filter((a) => !a.archived);
  const tagSet = new Set(options.tags.map(lower));
  const liquiditySet = new Set(options.liquidity);

  const rows: AccountRow[] = active
    .filter((a) => tagSet.size === 0 || tagSet.has(lower(a.tag)))
    .filter((a) => liquiditySet.size === 0 || liquiditySet.has(a.liquidity))
    .sort((a, b) => {
      const primary = compare(options.sort.key, a, b);
      const directed = options.sort.direction === 'asc' ? primary : -primary;
      return directed || byName(a, b);
    })
    .map((account) => {
      const current = latestBalance(account.id, balances);
      return current ? { account, current } : { account };
    });

  if (!options.groupByTag) {
    return { groups: [{ tag: null, rows }], shown: rows.length, total: active.length };
  }

  const groups = new Map<string, AccountGroup>();
  for (const row of rows) {
    const k = lower(row.account.tag);
    const group = groups.get(k) ?? { tag: row.account.tag, rows: [] };
    group.rows.push(row);
    groups.set(k, group);
  }
  const tagDirection = options.sort.key === 'tag' && options.sort.direction === 'desc' ? -1 : 1;
  const ordered = [...groups.values()].sort(
    (a, b) =>
      tagDirection * (a.tag ?? '').localeCompare(b.tag ?? '', undefined, { sensitivity: 'base' }),
  );
  return { groups: ordered, shown: rows.length, total: active.length };
}

/** Tags used by active accounts, for the filter popup. */
export function tagsInUse(accounts: readonly Account[]): string[] {
  const seen = new Map<string, string>();
  for (const a of accounts)
    if (!a.archived && !seen.has(lower(a.tag))) seen.set(lower(a.tag), a.tag);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
