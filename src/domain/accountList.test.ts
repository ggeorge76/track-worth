import { makeAccount, makeEntry } from '@/test/builders';
import {
  buildAccountList,
  DEFAULT_LIST_OPTIONS,
  isFiltered,
  matchesFilter,
  shownLiquidity,
  toggleLiquidity,
  tagsInUse,
  type ListOptions,
} from './accountList';

const accounts = [
  makeAccount({ id: 'hdfc', name: 'HDFC', tag: 'Cash', liquidity: 5 }),
  makeAccount({ id: 'ppf', name: 'PPF', tag: 'Fixed Income', liquidity: 1 }),
  makeAccount({ id: 'axis', name: 'axis card', tag: 'Debt', liquidity: 5, kind: 'liability' }),
  makeAccount({ id: 'mf', name: 'Index fund', tag: 'Equity', liquidity: 4 }),
  makeAccount({ id: 'old', name: 'Closed', tag: 'Cash', liquidity: 5, archived: true }),
];
const balances = [
  makeEntry({ accountId: 'hdfc', date: '2026-11-01', amountMinor: 100 }),
  makeEntry({ accountId: 'hdfc', date: '2026-11-20', amountMinor: 200 }),
  makeEntry({ accountId: 'axis', date: '2026-11-15', amountMinor: -50 }),
];

const ids = (opts: Partial<ListOptions>) =>
  buildAccountList(accounts, balances, { ...DEFAULT_LIST_OPTIONS, ...opts }).groups.flatMap((g) =>
    g.rows.map((r) => r.account.id),
  );

describe('buildAccountList', () => {
  it('lists active accounts by name (case-insensitive) with current balances', () => {
    const { groups, shown, total } = buildAccountList(accounts, balances, DEFAULT_LIST_OPTIONS);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tag).toBeNull();
    expect(groups[0]?.rows.map((r) => r.account.id)).toEqual(['axis', 'hdfc', 'mf', 'ppf']);
    expect(groups[0]?.rows.find((r) => r.account.id === 'hdfc')?.current?.amountMinor).toBe(200);
    expect(groups[0]?.rows.find((r) => r.account.id === 'ppf')?.current).toBeUndefined();
    expect([shown, total]).toEqual([4, 4]);
  });

  it('sorts by liquidity (ties by name) in either direction', () => {
    expect(ids({ sort: { key: 'liquidity', direction: 'desc' } })).toEqual([
      'axis',
      'hdfc',
      'mf',
      'ppf',
    ]);
    expect(ids({ sort: { key: 'liquidity', direction: 'asc' } })).toEqual([
      'ppf',
      'mf',
      'axis',
      'hdfc',
    ]);
  });

  it('sorts by tag', () => {
    expect(ids({ sort: { key: 'tag', direction: 'asc' } })).toEqual(['hdfc', 'axis', 'mf', 'ppf']);
    expect(ids({ sort: { key: 'tag', direction: 'desc' } })).toEqual(['ppf', 'mf', 'axis', 'hdfc']);
  });

  it('sorts by name descending', () => {
    expect(ids({ sort: { key: 'name', direction: 'desc' } })).toEqual([
      'ppf',
      'mf',
      'hdfc',
      'axis',
    ]);
  });

  it('filters by tag (case-insensitive) and liquidity, and counts', () => {
    const result = buildAccountList(accounts, balances, {
      ...DEFAULT_LIST_OPTIONS,
      tags: ['cash', 'Debt'],
      liquidity: [5],
    });
    expect(result.groups[0]?.rows.map((r) => r.account.id)).toEqual(['axis', 'hdfc']);
    expect([result.shown, result.total]).toEqual([2, 4]);
    expect(ids({ liquidity: [1, 4] })).toEqual(['mf', 'ppf']);
  });

  it('groups by tag in tag order, honouring a descending tag sort', () => {
    const grouped = buildAccountList(accounts, balances, {
      ...DEFAULT_LIST_OPTIONS,
      groupByTag: true,
    });
    expect(grouped.groups.map((g) => g.tag)).toEqual(['Cash', 'Debt', 'Equity', 'Fixed Income']);
    const desc = buildAccountList(accounts, balances, {
      ...DEFAULT_LIST_OPTIONS,
      groupByTag: true,
      sort: { key: 'tag', direction: 'desc' },
    });
    expect(desc.groups.map((g) => g.tag)).toEqual(['Fixed Income', 'Equity', 'Debt', 'Cash']);
  });

  it('merges tags that differ only in case into one group', () => {
    const mixed = [makeAccount({ id: '1', tag: 'Gold' }), makeAccount({ id: '2', tag: 'gold' })];
    const grouped = buildAccountList(mixed, [], { ...DEFAULT_LIST_OPTIONS, groupByTag: true });
    expect(grouped.groups).toHaveLength(1);
    expect(grouped.groups[0]?.rows).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('sorts by the full name, emoji included, so same-emoji accounts stay together', () => {
    const names = ['Alpha', '💵 Cash box', '🏦 Bank', 'zeta', '💵 Account', '2nd home'];
    const sorted = buildAccountList(
      names.map((name, i) => makeAccount({ id: String(i), name })),
      [],
      DEFAULT_LIST_OPTIONS,
    ).groups[0]?.rows.map((r) => r.account.name);
    expect(sorted).toEqual(['🏦 Bank', '💵 Account', '💵 Cash box', '2nd home', 'Alpha', 'zeta']);
  });

  it('uses the full name (emoji included) as the second-level sort', () => {
    const accounts = [
      makeAccount({ id: 'a', name: 'Zeta', liquidity: 3, tag: 'Cash' }),
      makeAccount({ id: 'b', name: '💵 Wallet', liquidity: 3, tag: 'Cash' }),
      makeAccount({ id: 'c', name: 'Alpha', liquidity: 3, tag: 'Cash' }),
      makeAccount({ id: 'd', name: 'Fund', liquidity: 5, tag: 'Equity' }),
    ];
    const order = (key: 'liquidity' | 'tag', direction: 'asc' | 'desc') =>
      buildAccountList(accounts, [], {
        ...DEFAULT_LIST_OPTIONS,
        sort: { key, direction },
      }).groups[0]?.rows.map((r) => r.account.name);
    expect(order('liquidity', 'desc')).toEqual(['Fund', '💵 Wallet', 'Alpha', 'Zeta']);
    expect(order('tag', 'asc')).toEqual(['💵 Wallet', 'Alpha', 'Zeta', 'Fund']);
  });

  it('knows when filters are active', () => {
    expect(isFiltered(DEFAULT_LIST_OPTIONS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_LIST_OPTIONS, tags: ['Cash'] })).toBe(true);
    expect(isFiltered({ ...DEFAULT_LIST_OPTIONS, liquidity: [2] })).toBe(true);
  });

  it('lists tags used by active accounts', () => {
    expect(tagsInUse(accounts)).toEqual(['Cash', 'Debt', 'Equity', 'Fixed Income']);
  });
});

describe('archived accounts', () => {
  it('are left out unless showArchived is set', () => {
    const list = [
      makeAccount({ id: 'a', name: 'A', archived: true }),
      makeAccount({ id: 'b', name: 'B' }),
    ];
    const ids = (showArchived: boolean) =>
      buildAccountList(list, [], { ...DEFAULT_LIST_OPTIONS, showArchived }).groups[0]?.rows.map(
        (r) => r.account.id,
      );
    expect(ids(false)).toEqual(['b']);
    expect(ids(true)).toEqual(['a', 'b']);
  });
});

describe('matchesFilter', () => {
  it('matches tags (any case) and liquidity; empty filters match everything', () => {
    const account = makeAccount({ tag: 'Cash', liquidity: 5 });
    expect(matchesFilter(account, DEFAULT_LIST_OPTIONS)).toBe(true);
    expect(matchesFilter(account, { ...DEFAULT_LIST_OPTIONS, tags: ['cash'] })).toBe(true);
    expect(matchesFilter(account, { ...DEFAULT_LIST_OPTIONS, tags: ['Debt'] })).toBe(false);
    expect(matchesFilter(account, { ...DEFAULT_LIST_OPTIONS, liquidity: [5] })).toBe(true);
    expect(matchesFilter(account, { ...DEFAULT_LIST_OPTIONS, liquidity: [1] })).toBe(false);
  });
});

describe('toggleLiquidity', () => {
  const opts = (liquidity: number[]) => ({ ...DEFAULT_LIST_OPTIONS, liquidity });

  it('starts with all levels shown; a click turns one off', () => {
    expect(shownLiquidity(DEFAULT_LIST_OPTIONS)).toEqual([1, 2, 3, 4, 5]);
    expect(toggleLiquidity(DEFAULT_LIST_OPTIONS, 3).liquidity).toEqual([1, 2, 4, 5]);
  });

  it('turns a level back on, in order, and clears the filter when all are on again', () => {
    expect(toggleLiquidity(opts([1, 5]), 3).liquidity).toEqual([1, 3, 5]);
    expect(toggleLiquidity(opts([1, 2, 4, 5]), 3).liquidity).toEqual([]);
  });

  it('keeps the last level on', () => {
    const only = opts([2]);
    expect(toggleLiquidity(only, 2)).toBe(only);
  });
});
