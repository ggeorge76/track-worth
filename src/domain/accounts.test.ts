import { idSequence, makeAccount, makeEntry, makeFile, NOW } from '@/test/builders';
import {
  adjacentAccounts,
  balanceSources,
  createAccount,
  orderByBalanceSource,
  updateAccount,
} from './accounts';

const opts = () => ({ now: NOW, newId: idSequence('acc') });

describe('createAccount', () => {
  it('creates an account with trimmed fields and the given properties', () => {
    const { data, account } = createAccount(
      makeFile(),
      {
        name: '  Emergency fund 🛟 ',
        kind: 'asset',
        tag: 'cash',
        liquidity: 5,
        currency: 'inr',
        note: '  Keep 6 months  ',
        balanceSource: ' HDFC NetBanking ',
      },
      opts(),
    );
    expect(account).toEqual({
      id: 'acc-1',
      name: 'Emergency fund 🛟',
      kind: 'asset',
      tag: 'Cash', // matched the default tag's spelling
      liquidity: 5,
      currency: 'INR',
      note: 'Keep 6 months',
      balanceSource: 'HDFC NetBanking',
      archived: false,
      createdAt: NOW.toISOString(),
    });
    expect(data.accounts).toEqual([account]);
    expect(data.settings.customTags).toEqual([]);
  });

  it('remembers a new tag as a custom tag, once', () => {
    const options = opts();
    let file = makeFile();
    file = createAccount(
      file,
      { name: 'A', kind: 'asset', tag: '🪙 Gold', liquidity: 2, currency: 'USD' },
      options,
    ).data;
    file = createAccount(
      file,
      { name: 'B', kind: 'asset', tag: '🪙 gold', liquidity: 2, currency: 'USD' },
      options,
    ).data;
    expect(file.settings.customTags).toEqual(['🪙 Gold']);
    expect(file.accounts.map((a) => a.tag)).toEqual(['🪙 Gold', '🪙 Gold']);
  });

  it('omits empty optional fields', () => {
    const { account } = createAccount(
      makeFile(),
      {
        name: 'A',
        kind: 'liability',
        tag: 'Debt',
        liquidity: 1,
        currency: 'USD',
        note: '  ',
        balanceSource: '',
      },
      opts(),
    );
    expect(account).not.toHaveProperty('note');
    expect(account).not.toHaveProperty('balanceSource');
  });

  it('rejects invalid input', () => {
    const base = { kind: 'asset' as const, tag: 'Cash', liquidity: 3, currency: 'USD' };
    expect(() => createAccount(makeFile(), { ...base, name: '   ' }, opts())).toThrow();
    expect(() => createAccount(makeFile(), { ...base, name: 'A', liquidity: 9 }, opts())).toThrow();
  });
});

describe('updateAccount', () => {
  const file = makeFile({
    accounts: [makeAccount({ id: 'a', currency: 'USD', note: 'old', balanceSource: 'Bank' })],
    balances: [
      makeEntry({ accountId: 'a', date: '2026-01-01', amountMinor: 123450 }),
      makeEntry({ accountId: 'a', date: '2026-02-01', amountMinor: -99 }),
    ],
  });

  it('edits name, tag and liquidity', () => {
    const next = updateAccount(file, 'a', { name: 'Renamed ✨', tag: 'Equity', liquidity: 4 });
    expect(next.accounts[0]).toMatchObject({ name: 'Renamed ✨', tag: 'Equity', liquidity: 4 });
  });

  it('clears optional fields when given empty text, and leaves unmentioned ones alone', () => {
    const next = updateAccount(file, 'a', { note: '' });
    expect(next.accounts[0]).not.toHaveProperty('note');
    expect(next.accounts[0]?.balanceSource).toBe('Bank');
  });

  it('keeps displayed amounts when switching to a currency with the same decimals', () => {
    const next = updateAccount(file, 'a', { currency: 'EUR' });
    expect(next.balances.map((b) => b.amountMinor)).toEqual([123450, -99]);
  });

  it('rescales minor units when the currency has different decimals (USD → JPY → USD)', () => {
    const jpy = updateAccount(file, 'a', { currency: 'JPY' });
    expect(jpy.balances.map((b) => b.amountMinor)).toEqual([1235, -1]);
    const back = updateAccount(jpy, 'a', { currency: 'USD' });
    expect(back.balances.map((b) => b.amountMinor)).toEqual([123500, -100]);
  });

  it('throws for an unknown account', () => {
    expect(() => updateAccount(file, 'missing', { name: 'x' })).toThrow();
  });
});

describe('balance source ordering', () => {
  const accounts = [
    makeAccount({ id: '1', name: 'Zeta', balanceSource: 'hdfc' }),
    makeAccount({ id: '2', name: 'Alpha' }),
    makeAccount({ id: '3', name: 'Beta', balanceSource: 'Zerodha' }),
    makeAccount({ id: '4', name: 'Alpha', balanceSource: 'HDFC' }),
  ];

  it('groups by source alphabetically, no-source last, then by name', () => {
    expect(orderByBalanceSource(accounts).map((a) => a.id)).toEqual(['4', '1', '3', '2']);
  });

  it('lists distinct sources case-insensitively', () => {
    expect(balanceSources(accounts)).toEqual(['hdfc', 'Zerodha']);
  });

  it('finds previous and next accounts', () => {
    const ordered = orderByBalanceSource(accounts);
    expect(adjacentAccounts(ordered, '1')).toEqual({ previous: ordered[0], next: ordered[2] });
    expect(adjacentAccounts(ordered, '4')).toEqual({ next: ordered[1] });
    expect(adjacentAccounts(ordered, '2')).toEqual({ previous: ordered[2] });
    expect(adjacentAccounts(ordered, 'x')).toEqual({});
  });
});

describe('updateAccount: balance source and ordering ties', () => {
  it('sets and clears the balance source', () => {
    const file = makeFile({ accounts: [makeAccount({ id: 'a' })] });
    const set = updateAccount(file, 'a', { balanceSource: ' ICICI ' });
    expect(set.accounts[0]?.balanceSource).toBe('ICICI');
    expect(updateAccount(set, 'a', { balanceSource: '' }).accounts[0]).not.toHaveProperty(
      'balanceSource',
    );
  });

  it('breaks same-name ties by creation time', () => {
    const older = makeAccount({ id: 'old', name: 'Same', createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeAccount({ id: 'new', name: 'Same', createdAt: '2026-02-01T00:00:00.000Z' });
    expect(orderByBalanceSource([newer, older]).map((a) => a.id)).toEqual(['old', 'new']);
  });
});

describe('updateAccount: type', () => {
  const file = makeFile({
    accounts: [makeAccount({ id: 'a', kind: 'asset' }), makeAccount({ id: 'b', name: 'Other' })],
    balances: [
      makeEntry({ accountId: 'a', date: '2026-01-01', amountMinor: 64500 }),
      makeEntry({ accountId: 'a', date: '2026-02-01', amountMinor: 0 }),
      makeEntry({ accountId: 'b', date: '2026-01-01', amountMinor: 100 }),
    ],
  });

  it('changes the type and keeps balances by default', () => {
    const next = updateAccount(file, 'a', { kind: 'liability' });
    expect(next.accounts[0]?.kind).toBe('liability');
    expect(next.balances.map((b) => b.amountMinor)).toEqual([64500, 0, 100]);
  });

  it('can flip this account’s balances, leaving zero and other accounts alone', () => {
    const next = updateAccount(file, 'a', { kind: 'liability' }, { flipSigns: true });
    expect(next.balances.map((b) => b.amountMinor)).toEqual([-64500, 0, 100]);
    expect(Object.is(next.balances[1]?.amountMinor, -0)).toBe(false);
  });

  it('does not flip when the type is unchanged', () => {
    const next = updateAccount(file, 'a', { kind: 'asset' }, { flipSigns: true });
    expect(next.balances.map((b) => b.amountMinor)).toEqual([64500, 0, 100]);
  });
});
