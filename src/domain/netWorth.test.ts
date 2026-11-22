import { latestBalance, netWorthByCurrency } from './netWorth';
import type { Account, BalanceEntry } from './schema';

const account = (over: Partial<Account>): Account => ({
  id: 'a',
  name: 'A',
  kind: 'asset',
  tag: 'Cash',
  liquidity: 3,
  currency: 'USD',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

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

describe('netWorthByCurrency', () => {
  it('subtracts liabilities, skips archived accounts and groups by currency', () => {
    const accounts = [
      account({ id: 'bank' }),
      account({ id: 'card', kind: 'liability', tag: 'Debt' }),
      account({ id: 'old', archived: true }),
      account({ id: 'eur', currency: 'EUR' }),
    ];
    const balances = [
      entry({ accountId: 'bank', amountMinor: 10_000 }),
      entry({ accountId: 'card', amountMinor: -2_500 }),
      entry({ accountId: 'old', amountMinor: 99_999 }),
      entry({ accountId: 'eur', amountMinor: 700 }),
    ];
    expect(netWorthByCurrency({ accounts, balances })).toEqual({
      USD: { assetsMinor: 10_000, liabilitiesMinor: -2_500, netMinor: 7_500 },
      EUR: { assetsMinor: 700, liabilitiesMinor: 0, netMinor: 700 },
    });
  });
});
