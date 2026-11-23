import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { upsertBalance } from '../balances';
import { createAccount } from '../accounts';
import { settingsFileSchema, parseStoredFile, type BalanceFile } from './files';
import {
  assembleDataset,
  MissingBalanceFileError,
  planWrites,
  splitDataset,
  type Layout,
} from './layout';
import { realign } from './periods';

const NOW = new Date('2026-11-22T10:00:00.000Z');
let n = 0;
const opts = () => ({ now: NOW, newId: () => `id-${String(++n)}` });

/** Two accounts, balances across three April financial years. */
const data = makeFile({
  accounts: [makeAccount({ id: 'a' }), makeAccount({ id: 'b', name: 'B' })],
  balances: [
    makeEntry({ id: 'e1', accountId: 'a', date: '2024-06-30', amountMinor: 100 }),
    makeEntry({ id: 'e2', accountId: 'a', date: '2026-01-31', amountMinor: 200 }),
    makeEntry({ id: 'e3', accountId: 'b', date: '2026-02-28', amountMinor: 300 }),
    makeEntry({ id: 'e4', accountId: 'a', date: '2026-10-31', amountMinor: 400 }),
  ],
});

const assemble = (layout: Layout) =>
  assembleDataset(layout.settings, layout.accounts, layout.balances);
const steps = (before: Layout | null, after: Layout) =>
  planWrites(before, after).map((s) => `${s.kind} ${s.path}`);

describe('splitDataset / assembleDataset', () => {
  const layout = splitDataset(data, []);

  it('puts each balance in its financial-year file, named by start year', () => {
    expect(layout.settings.balanceFiles.map((p) => `${p.file} ${p.from}..${p.to}`)).toEqual([
      'balances/2024.json 2024-04-01..2025-03-31',
      'balances/2025.json 2025-04-01..2026-03-31',
      'balances/2026.json 2026-04-01..2027-03-31',
    ]);
    expect(layout.balances['balances/2025.json']?.balances.map((b) => b.id)).toEqual(['e2', 'e3']);
    expect(layout.accounts.accounts).toHaveLength(2);
    expect(
      parseStoredFile(settingsFileSchema, JSON.parse(JSON.stringify(layout.settings))).ok,
    ).toBe(true);
  });

  it('round-trips through the files', () => {
    expect(assemble(layout)).toEqual({
      ...data,
      balances: [...data.balances].sort((x, y) => x.date.localeCompare(y.date)),
    });
  });

  it('only takes entries within each file’s recorded period, and skips entries without an account', () => {
    const stray: BalanceFile = {
      ...(layout.balances['balances/2026.json'] as BalanceFile),
      balances: [
        makeEntry({ id: 'out', accountId: 'a', date: '2025-05-01' }), // belongs to 2025's period
        makeEntry({ id: 'orphan', accountId: 'zzz', date: '2026-05-01' }),
        makeEntry({ id: 'ok', accountId: 'b', date: '2026-05-01', amountMinor: 7 }),
      ],
    };
    const result = assembleDataset(layout.settings, layout.accounts, {
      ...layout.balances,
      'balances/2026.json': stray,
    });
    expect(result.balances.map((b) => b.id)).toEqual(['e1', 'e2', 'e3', 'ok']);
  });

  it('refuses to load when a listed file is missing', () => {
    const rest = { ...layout.balances, 'balances/2025.json': undefined };
    expect(() => assembleDataset(layout.settings, layout.accounts, rest)).toThrow(
      MissingBalanceFileError,
    );
  });
});

describe('planWrites', () => {
  const before = splitDataset(data, []);
  const periods = before.settings.balanceFiles;

  it('writes everything for a new store: balances, then accounts, then settings', () => {
    expect(steps(null, before)).toEqual([
      'write balances/2024.json',
      'write balances/2025.json',
      'write balances/2026.json',
      'write accounts.json',
      'write settings.json',
    ]);
  });

  it('writes nothing when only the timestamp changed', () => {
    const after = splitDataset({ ...data, updatedAt: NOW.toISOString() }, periods);
    expect(steps(before, after)).toEqual([]);
  });

  it('writes only the year file when a balance changes', () => {
    const next = upsertBalance(
      data,
      { accountId: 'a', date: '2026-11-22', amountMinor: 5 },
      opts(),
    );
    expect(steps(before, splitDataset(next, periods))).toEqual(['write balances/2026.json']);
  });

  it('writes only accounts.json when an account changes', () => {
    const next = {
      ...data,
      accounts: data.accounts.map((a) => (a.id === 'b' ? { ...a, name: 'Renamed' } : a)),
    };
    expect(steps(before, splitDataset(next, periods))).toEqual(['write accounts.json']);
  });

  it('writes the balance before the account for a new account with an opening balance', () => {
    const { data: withAccount, account } = createAccount(
      data,
      { name: 'New', kind: 'asset', tag: 'Cash', liquidity: 3, currency: 'USD' },
      opts(),
    );
    const next = upsertBalance(
      withAccount,
      { accountId: account.id, date: '2026-11-22', amountMinor: 1 },
      opts(),
    );
    expect(steps(before, splitDataset(next, periods))).toEqual([
      'write balances/2026.json',
      'write accounts.json',
    ]);
  });

  it('writes new year files before listing them in settings.json, leaving no gaps', () => {
    // 15 Jan 2023 is in FY 2022 (Apr 2022 – Mar 2023); FY 2023 is created empty to keep periods contiguous.
    const next = upsertBalance(
      data,
      { accountId: 'a', date: '2023-01-15', amountMinor: 1 },
      opts(),
    );
    expect(steps(before, splitDataset(next, periods))).toEqual([
      'write balances/2022.json',
      'write balances/2023.json',
      'write settings.json',
    ]);
  });

  it('example A (Apr–Mar → Jan–Dec): the receiving file, then settings, then the giving file', () => {
    const next = { ...data, settings: { ...data.settings, financialYearStartMonth: 1 } };
    const after = splitDataset(next, realign(periods, '2026-11-22', 1));
    expect(after.balances['balances/2026.json']?.balances.map((b) => b.id)).toEqual([
      'e2',
      'e3',
      'e4',
    ]);
    expect(steps(before, after)).toEqual([
      'write balances/2026.json', // gains Jan–Mar 2026 (e2, e3)
      'write settings.json', // new periods take effect
      'write balances/2025.json', // drops them
    ]);
  });

  it('shows the data unchanged at every point of an interrupted financial-year change', () => {
    const next = { ...data, settings: { ...data.settings, financialYearStartMonth: 1 } };
    const after = splitDataset(next, realign(periods, '2026-11-22', 1));
    const stored: Layout = structuredClone(before);
    const expectedIds = ['e1', 'e2', 'e3', 'e4'];
    for (const step of planWrites(before, after)) {
      if (step.kind !== 'write') continue;
      if (step.path === 'settings.json') stored.settings = after.settings;
      else if (step.path === 'accounts.json') stored.accounts = after.accounts;
      else stored.balances[step.path] = after.balances[step.path] as BalanceFile;
      // After each individual write, the data reads back complete, with no duplicates.
      expect(
        assemble(stored)
          .balances.map((b) => b.id)
          .sort(),
      ).toEqual(expectedIds);
    }
  });

  it('trashes files that are no longer listed, after settings.json', () => {
    // Jan-year files 2025 and 2026; switching to April folds 2026's Jan–Mar into 2025 and keeps
    // 2026 as the current year, so make a store with an extra future file that disappears.
    const janData = { ...data, settings: { ...data.settings, financialYearStartMonth: 1 } };
    const janBefore = splitDataset(janData, []);
    const withFuture: Layout = {
      ...janBefore,
      settings: {
        ...janBefore.settings,
        balanceFiles: [
          ...janBefore.settings.balanceFiles,
          { file: 'balances/2027.json', from: '2027-01-01', to: '2027-12-31' },
        ],
      },
      balances: {
        ...janBefore.balances,
        'balances/2027.json': {
          ...(janBefore.balances['balances/2026.json'] as BalanceFile),
          from: '2027-01-01',
          to: '2027-12-31',
          balances: [],
        },
      },
    };
    const next = { ...janData, settings: { ...janData.settings, financialYearStartMonth: 4 } };
    const after = splitDataset(next, realign(withFuture.settings.balanceFiles, '2026-11-22', 4));
    const plan = steps(withFuture, after);
    expect(plan.at(-1)).toBe('trash balances/2027.json');
    expect(plan.indexOf('write settings.json')).toBeLessThan(
      plan.indexOf('trash balances/2027.json'),
    );
  });
});

describe('parseStoredFile', () => {
  it('refuses files from a newer app version', () => {
    expect(parseStoredFile(settingsFileSchema, { schemaVersion: 99 })).toEqual({
      ok: false,
      reason: 'newer-version',
      schemaVersion: 99,
    });
    expect(parseStoredFile(settingsFileSchema, { schemaVersion: 3 }).ok).toBe(false);
  });
});

describe('performance with decades of data', () => {
  it('splits and reassembles 30 years × 50 accounts of weekly balances quickly', () => {
    const accounts = Array.from({ length: 50 }, (_, i) =>
      makeAccount({ id: `acc${String(i)}`, name: `Account ${String(i)}` }),
    );
    const balances = [];
    let day = Date.UTC(1996, 0, 1);
    const end = Date.UTC(2026, 0, 1);
    let id = 0;
    for (; day < end; day += 7 * 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      for (const account of accounts) {
        balances.push(
          makeEntry({ id: `b${String(++id)}`, accountId: account.id, date, amountMinor: id }),
        );
      }
    }
    const big = makeFile({ accounts, balances });

    const started = performance.now();
    const layout = splitDataset(big, []);
    const restored = assemble(layout);
    const elapsed = performance.now() - started;

    expect(restored.balances).toHaveLength(balances.length); // ~78,000 entries
    expect(Object.keys(layout.balances)).toHaveLength(31);
    expect(elapsed).toBeLessThan(5000); // generous for CI; typically a few hundred ms
  });
});
