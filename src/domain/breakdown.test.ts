import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { breakdown } from './breakdown';

const data = makeFile({
  accounts: [
    makeAccount({ id: 'cash1', tag: 'Cash', liquidity: 5 }),
    makeAccount({ id: 'cash2', tag: 'cash', liquidity: 5 }),
    makeAccount({ id: 'fd', tag: 'Fixed Income', liquidity: 2 }),
    makeAccount({ id: 'home', kind: 'liability', tag: 'Loan', liquidity: 1 }),
    makeAccount({ id: 'card', kind: 'liability', tag: 'Credit card', liquidity: 4 }),
    makeAccount({ id: 'none', tag: 'Stocks' }), // no balance yet
    makeAccount({ id: 'old', tag: 'Cash', archived: true }),
    makeAccount({ id: 'eur', tag: 'Cash', currency: 'EUR' }),
  ],
  balances: [
    makeEntry({ accountId: 'cash1', date: '2026-01-01', amountMinor: 999 }),
    makeEntry({ accountId: 'cash1', date: '2026-02-01', amountMinor: 100 }),
    makeEntry({ accountId: 'cash2', amountMinor: 200 }),
    makeEntry({ accountId: 'fd', amountMinor: 700 }),
    makeEntry({ accountId: 'home', amountMinor: -800 }),
    makeEntry({ accountId: 'card', amountMinor: -200 }),
    makeEntry({ accountId: 'old', amountMinor: 5000 }),
    makeEntry({ accountId: 'eur', amountMinor: 5000 }),
  ],
});

describe('breakdown', () => {
  it('groups current asset balances by tag (any case), largest first, with shares', () => {
    expect(breakdown(data, 'USD').assetsByTag).toEqual({
      totalMinor: 1000,
      rows: [
        { label: 'Fixed Income', amountMinor: 700, accounts: 1, share: 0.7 },
        { label: 'Cash', amountMinor: 300, accounts: 2, share: 0.3 },
      ],
    });
  });

  it('groups assets by liquidity, most liquid first', () => {
    expect(
      breakdown(data, 'USD').assetsByLiquidity.rows.map((r) => [r.label, r.amountMinor]),
    ).toEqual([
      ['5 · Very high', 300],
      ['2 · Low', 700],
    ]);
  });

  it('shows liabilities as amounts owed', () => {
    expect(breakdown(data, 'USD').liabilitiesByTag).toEqual({
      totalMinor: 1000,
      rows: [
        { label: 'Loan', amountMinor: 800, accounts: 1, share: 0.8 },
        { label: 'Credit card', amountMinor: 200, accounts: 1, share: 0.2 },
      ],
    });
  });

  it('gives no shares when a total isn’t positive, and breaks ties by name', () => {
    const odd = makeFile({
      accounts: [makeAccount({ id: 'b', tag: 'B' }), makeAccount({ id: 'a', tag: 'A' })],
      balances: [
        makeEntry({ accountId: 'b', amountMinor: 0 }),
        makeEntry({ accountId: 'a', amountMinor: 0 }),
      ],
    });
    expect(breakdown(odd, 'USD').assetsByTag.rows).toEqual([
      { label: 'A', amountMinor: 0, accounts: 1, share: null },
      { label: 'B', amountMinor: 0, accounts: 1, share: null },
    ]);
    expect(breakdown(odd, 'EUR').assetsByTag).toEqual({ totalMinor: 0, rows: [] });
  });
});
