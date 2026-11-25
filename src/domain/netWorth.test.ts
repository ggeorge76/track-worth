import { makeAccount, makeEntry } from '@/test/builders';
import { createConverter } from './fx';
import { hasBalances, latestBalance, netWorthInBase } from './netWorth';
import type { BalanceEntry } from './schema';

const entry = (over: Partial<BalanceEntry>): BalanceEntry => ({
  id: crypto.randomUUID(),
  accountId: 'a',
  date: '2026-01-01',
  amountMinor: 0,
  recordedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('latestBalance', () => {
  const balances = [
    entry({ date: '2026-01-01', amountMinor: 100 }),
    entry({ date: '2026-03-01', amountMinor: 300 }),
    entry({ date: '2026-02-01', amountMinor: 200 }),
  ];

  it('returns the most recent entry', () => {
    expect(latestBalance('a', balances)?.amountMinor).toBe(300);
  });

  it('respects asOf', () => {
    expect(latestBalance('a', balances, '2026-02-15')?.amountMinor).toBe(200);
  });

  it('breaks same-day ties by recordedAt', () => {
    const sameDay = [
      entry({ amountMinor: 1, recordedAt: '2026-01-01T10:00:00.000Z' }),
      entry({ amountMinor: 2, recordedAt: '2026-01-01T11:00:00.000Z' }),
    ];
    expect(latestBalance('a', sameDay)?.amountMinor).toBe(2);
  });
});

describe('netWorthInBase', () => {
  const fx = createConverter(
    'INR',
    { base: 'INR', latest: { date: '2026-11-25', rates: { USD: 0.0125 } }, monthly: {} },
    {},
    '2026-11-25',
  );
  const data = {
    accounts: [
      makeAccount({ id: 'inr', currency: 'INR' }),
      makeAccount({ id: 'usd', currency: 'USD' }),
      makeAccount({ id: 'loan', currency: 'USD', kind: 'liability' }),
      makeAccount({ id: 'gbp', currency: 'GBP' }),
      makeAccount({ id: 'old', currency: 'INR', archived: true }),
      makeAccount({ id: 'new', currency: 'INR' }), // no balance yet
    ],
    balances: [
      makeEntry({ accountId: 'inr', amountMinor: 1_000_00 }),
      makeEntry({ accountId: 'usd', amountMinor: 10_00 }),
      makeEntry({ accountId: 'loan', amountMinor: -1_00 }),
      makeEntry({ accountId: 'gbp', amountMinor: 5_00 }),
      makeEntry({ accountId: 'old', amountMinor: 9_00 }),
    ],
  };

  it('converts every active account at the date’s rate and lists what it couldn’t convert', () => {
    expect(netWorthInBase(data, fx, '2026-11-25')).toEqual({
      assetsMinor: 1_800_00,
      liabilitiesMinor: -80_00,
      netMinor: 1_720_00,
      unconverted: ['GBP'],
    });
  });

  it('knows whether there is anything to show', () => {
    expect(hasBalances(data)).toBe(true);
    expect(hasBalances({ accounts: data.accounts, balances: [] })).toBe(false);
  });
});
