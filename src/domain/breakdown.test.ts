import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { breakdown } from './breakdown';
import { sameCurrencyConverter } from './fx';

const TODAY = '2026-11-25';
const usd = sameCurrencyConverter('USD');

const data = makeFile({
  accounts: [
    makeAccount({ id: 'cash1', tag: 'Cash', liquidity: 5 }),
    makeAccount({ id: 'cash2', tag: 'cash', liquidity: 4 }),
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
  it('groups current balances by tag (any case), largest first; liabilities as owed', () => {
    expect(breakdown(data, usd, 'tag', TODAY)).toEqual({
      assets: {
        totalMinor: 1000,
        rows: [
          { key: 'fixed income', label: 'Fixed Income', amountMinor: 700, accounts: 1, share: 0.7 },
          { key: 'cash', label: 'Cash', amountMinor: 300, accounts: 2, share: 0.3 },
        ],
      },
      liabilities: {
        totalMinor: 1000,
        rows: [
          { key: 'loan', label: 'Loan', amountMinor: 800, accounts: 1, share: 0.8 },
          { key: 'credit card', label: 'Credit card', amountMinor: 200, accounts: 1, share: 0.2 },
        ],
      },
      unconverted: ['EUR'], // no EUR rate: left out and reported
    });
  });

  it('groups by liquidity, most liquid first', () => {
    const { assets, liabilities } = breakdown(data, usd, 'liquidity', TODAY);
    expect(assets.rows.map((r) => [r.label, r.level, r.amountMinor])).toEqual([
      ['5 · Very high', 5, 100],
      ['4 · High', 4, 200],
      ['2 · Low', 2, 700],
    ]);
    expect(liabilities.rows.map((r) => r.label)).toEqual(['4 · High', '1 · Very low']);
  });

  it('gives no shares when a total isn’t positive, breaks ties by name, and can be empty', () => {
    const odd = makeFile({
      accounts: [makeAccount({ id: 'b', tag: 'B' }), makeAccount({ id: 'a', tag: 'A' })],
      balances: [
        makeEntry({ accountId: 'b', amountMinor: 0 }),
        makeEntry({ accountId: 'a', amountMinor: 0 }),
      ],
    });
    expect(breakdown(odd, usd, 'tag', TODAY).assets.rows.map((r) => [r.label, r.share])).toEqual([
      ['A', null],
      ['B', null],
    ]);
    expect(breakdown(odd, sameCurrencyConverter('EUR'), 'tag', TODAY)).toEqual({
      assets: { totalMinor: 0, rows: [] },
      liabilities: { totalMinor: 0, rows: [] },
      unconverted: ['USD'],
    });
  });
});
