import v1Fixture from './__fixtures__/data-file-v1.json';
import { createEmptyDataFile, parseDataFile, SCHEMA_VERSION } from './schema';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';

const valid = () =>
  makeFile({
    accounts: [makeAccount({ id: 'a1', name: 'Savings 🏦', tag: '💰 Emergency' })],
    balances: [makeEntry({ accountId: 'a1', date: '2026-01-01', amountMinor: 123456 })],
  });

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe('parseDataFile (current version)', () => {
  it('accepts a valid file, including emoji in names and tags', () => {
    const file = valid();
    expect(parseDataFile(roundTrip(file))).toEqual({ ok: true, data: file });
  });

  it('rejects files written by a newer version instead of stripping unknown data', () => {
    expect(parseDataFile({ ...valid(), schemaVersion: SCHEMA_VERSION + 1 })).toEqual({
      ok: false,
      reason: 'newer-version',
      schemaVersion: SCHEMA_VERSION + 1,
    });
  });

  it.each([
    ['non-integer money', { amountMinor: 12.5 }],
    ['an unknown account', { accountId: 'nope' }],
  ])('rejects a balance with %s', (_label, over) => {
    const file = valid();
    file.balances = [makeEntry({ accountId: 'a1', ...over })];
    expect(parseDataFile(roundTrip(file)).ok).toBe(false);
  });

  it('rejects two balances for the same account on the same day', () => {
    const file = valid();
    file.balances.push(makeEntry({ accountId: 'a1', date: '2026-01-01', amountMinor: 1 }));
    const result = parseDataFile(roundTrip(file));
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it.each([0, 6, 2.5])('rejects liquidity %s', (liquidity) => {
    const file = valid();
    file.accounts = [makeAccount({ id: 'a1', liquidity })];
    expect(parseDataFile(roundTrip(file)).ok).toBe(false);
  });

  it('rejects garbage', () => {
    expect(parseDataFile('nope').ok).toBe(false);
    expect(parseDataFile(null).ok).toBe(false);
    expect(parseDataFile({ schemaVersion: 2 }).ok).toBe(false);
  });
});

describe('migration from v1', () => {
  const result = parseDataFile(v1Fixture);
  if (!result.ok) throw new Error(`fixture failed to migrate: ${JSON.stringify(result)}`);
  const { data } = result;

  it('reports the version it migrated from', () => {
    expect(result.migratedFrom).toBe(1);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('turns categories into tags and adds a liquidity rating', () => {
    expect(data.accounts.map((a) => [a.name, a.tag, a.liquidity])).toEqual([
      ['Everyday Checking 💳', 'Cash', 5],
      ['Car loan', 'Debt', 2],
    ]);
    expect(data.accounts[0]?.note).toBe('Main account');
  });

  it('makes liability balances negative and keeps zero as zero', () => {
    const loan = data.balances.filter((b) => b.accountId === 'acc-loan');
    expect(loan.map((b) => b.amountMinor).sort((a, b) => a - b)).toEqual([-800000, 0]);
    expect(Object.is(loan.find((b) => b.date === '2026-01-31')?.amountMinor, -0)).toBe(false);
  });

  it('keeps only the latest-recorded entry when a day had several', () => {
    const feb = data.balances.filter((b) => b.accountId === 'acc-bank' && b.date === '2026-02-28');
    expect(feb).toHaveLength(1);
    expect(feb[0]?.amountMinor).toBe(120000);
  });

  it('adds default settings with an April financial year', () => {
    expect(data.settings).toEqual({ financialYearStartMonth: 4, customTags: [] });
  });

  it('rejects a v1 file that is itself invalid', () => {
    expect(parseDataFile({ ...v1Fixture, accounts: 'nope' }).ok).toBe(false);
  });
});

describe('migration from v3', () => {
  it('adds an empty net-worth history', () => {
    const current = valid();
    const v3: Record<string, unknown> = { ...current, schemaVersion: 3 };
    delete v3.netWorthHistory;
    expect(parseDataFile(roundTrip(v3))).toEqual({ ok: true, data: current, migratedFrom: 3 });
  });
});

describe('earlier net-worth history', () => {
  it('rejects two totals for the same currency and month', () => {
    const point = { date: '2020-01-31', amountMinor: 1, currency: 'USD' };
    const file = { ...valid(), netWorthHistory: [point, { ...point, amountMinor: 2 }] };
    expect(parseDataFile(roundTrip(file))).toMatchObject({ ok: false, reason: 'invalid' });
    const twoCurrencies = { ...valid(), netWorthHistory: [point, { ...point, currency: 'EUR' }] };
    expect(parseDataFile(roundTrip(twoCurrencies)).ok).toBe(true);
  });
});

describe('createEmptyDataFile', () => {
  it('round-trips through the parser', () => {
    const empty = createEmptyDataFile('EUR', new Date('2026-05-01T00:00:00Z'));
    expect(parseDataFile(roundTrip(empty))).toEqual({ ok: true, data: empty });
  });
});

describe('integrity checks', () => {
  it('rejects duplicate account ids and duplicate balance ids', () => {
    const dupAccounts = valid();
    dupAccounts.accounts.push(makeAccount({ id: 'a1', name: 'Again' }));
    expect(parseDataFile(roundTrip(dupAccounts)).ok).toBe(false);

    const dupEntries = valid();
    const first = dupEntries.balances[0];
    if (!first) throw new Error('fixture');
    dupEntries.balances.push({ ...first, date: '2026-02-01' });
    expect(parseDataFile(roundTrip(dupEntries)).ok).toBe(false);
  });

  it('keeps the latest-recorded entry regardless of order in a v1 file', () => {
    const v1 = structuredClone(v1Fixture);
    v1.balances.reverse(); // the newer same-day entry now comes first
    const result = parseDataFile(v1);
    if (!result.ok) throw new Error('migration failed');
    const feb = result.data.balances.find(
      (b) => b.accountId === 'acc-bank' && b.date === '2026-02-28',
    );
    expect(feb?.amountMinor).toBe(120000);
  });
});
