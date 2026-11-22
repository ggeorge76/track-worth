import { makeEntry } from '@/test/builders';
import { balanceStats } from './stats';

const entries = (rows: [string, number][]) =>
  rows.map(([date, amountMinor]) => makeEntry({ accountId: 'a', date, amountMinor }));

describe('balanceStats', () => {
  // Today is 2026-11-22; financial year starts in April → current FY began 2026-04-01.
  const today = '2026-11-22';
  const history = entries([
    ['2025-12-31', 80_000],
    ['2026-03-31', 90_000], // last entry of the previous financial year
    ['2026-06-30', 120_000], // all-time high
    ['2026-10-31', 100_000], // last entry of the previous month
    ['2026-11-10', 105_000],
    ['2026-11-20', 110_000], // current
  ]);

  it('computes current balance and changes', () => {
    const stats = balanceStats(history, 'a', 'asset', today, 4);
    expect(stats.current?.amountMinor).toBe(110_000);
    expect(stats.sincePrevious).toMatchObject({ deltaMinor: 5_000, base: { date: '2026-11-10' } });
    expect(stats.sincePreviousMonth).toMatchObject({
      deltaMinor: 10_000,
      base: { date: '2026-10-31' },
    });
    expect(stats.sincePreviousFinancialYear).toMatchObject({
      deltaMinor: 20_000,
      base: { date: '2026-03-31' },
    });
    expect(stats.allTimeHigh).toMatchObject({ amountMinor: 120_000, date: '2026-06-30' });
  });

  it('uses the configured financial year start', () => {
    const stats = balanceStats(history, 'a', 'asset', today, 1); // calendar year
    expect(stats.sincePreviousFinancialYear?.base.date).toBe('2025-12-31');
  });

  it('treats peak debt as the all-time high for liabilities', () => {
    const loan = entries([
      ['2026-01-01', -500_000],
      ['2026-06-01', -520_000],
      ['2026-11-01', -400_000],
    ]);
    expect(balanceStats(loan, 'a', 'liability', today, 4).allTimeHigh?.amountMinor).toBe(-520_000);
  });

  it('gives ties to the earliest date', () => {
    const flat = entries([
      ['2026-01-01', 100],
      ['2026-02-01', 100],
    ]);
    expect(balanceStats(flat, 'a', 'asset', today, 4).allTimeHigh?.date).toBe('2026-01-01');
  });

  it('omits changes that have no earlier entry', () => {
    const single = entries([['2026-11-20', 100]]);
    const stats = balanceStats(single, 'a', 'asset', today, 4);
    expect(stats.current?.amountMinor).toBe(100);
    expect(stats.sincePrevious).toBeUndefined();
    expect(stats.sincePreviousMonth).toBeUndefined();
    expect(stats.sincePreviousFinancialYear).toBeUndefined();
  });

  it('returns nothing for an account without entries', () => {
    expect(balanceStats([], 'a', 'asset', today, 4)).toEqual({});
  });
});
