import { latestBalance } from './netWorth';
import { LIQUIDITY_LEVELS } from './liquidity';
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
  /** Also list archived accounts (they never count towards net worth). */
  showArchived: boolean;
}

export const DEFAULT_LIST_OPTIONS: ListOptions = {
  sort: { key: 'name', direction: 'asc' },
  tags: [],
  liquidity: [],
  groupByTag: false,
  showArchived: false,
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
 * Names sort by their full text, emoji included: many people use a leading emoji as a category
 * icon, so accounts with the same emoji stay together (emoji first, then digits, then A–Z).
 * Also the second-level sort for every other sort key.
 */
const byName = (a: Account, b: Account) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

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

/** Whether an account passes the tag and liquidity filters (archived is handled separately). */
export function matchesFilter(account: Account, options: ListOptions): boolean {
  const tagOk =
    options.tags.length === 0 || options.tags.some((t) => lower(t) === lower(account.tag));
  const liquidityOk =
    options.liquidity.length === 0 || options.liquidity.includes(account.liquidity);
  return tagOk && liquidityOk;
}

/** Liquidity levels currently shown: an empty filter means all of them. */
export function shownLiquidity(options: ListOptions): readonly number[] {
  return options.liquidity.length === 0 ? LIQUIDITY_LEVELS : options.liquidity;
}

/**
 * The liquidity filter starts with every level selected; clicking a level turns it off (or back
 * on). Selecting all five again clears the filter, and the last level can't be turned off (that
 * would hide everything).
 */
export function toggleLiquidity(options: ListOptions, level: number): ListOptions {
  const shown = shownLiquidity(options);
  const next = shown.includes(level)
    ? shown.filter((l) => l !== level)
    : LIQUIDITY_LEVELS.filter((l) => l === level || shown.includes(l));
  if (next.length === 0) return options;
  return { ...options, liquidity: next.length === LIQUIDITY_LEVELS.length ? [] : next };
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
  const active = accounts.filter((a) => options.showArchived || !a.archived);
  const rows: AccountRow[] = active
    .filter((a) => matchesFilter(a, options))
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
