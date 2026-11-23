import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { netWorthByCurrency } from './netWorth';
import { netWorthTrend, trendCurrencies } from './trend';

const TODAY = '2026-11-23';

const bank = makeAccount({ id: 'bank', currency: 'USD' });
const loan = makeAccount({ id: 'loan', kind: 'liability', currency: 'USD' });

describe('netWorthTrend', () => {
  it('is empty with no balances in that currency', () => {
    expect(netWorthTrend(makeFile(), { currency: 'USD', range: '1Y', today: TODAY })).toEqual({
      points: [],
    });
  });

  it('samples range start, month-ends and today, carrying balances forward', () => {
    const data = makeFile({
      accounts: [bank, loan],
      balances: [
        makeEntry({ accountId: 'bank', date: '2026-04-15', amountMinor: 1000 }),
        makeEntry({ accountId: 'bank', date: '2026-07-01', amountMinor: 3000 }),
        makeEntry({ accountId: 'loan', date: '2026-06-10', amountMinor: -500 }),
      ],
    });
    const { points } = netWorthTrend(data, { currency: 'USD', range: '6M', today: TODAY });
    expect(points).toEqual([
      { date: '2026-05-23', netMinor: 1000 },
      { date: '2026-05-31', netMinor: 1000 },
      { date: '2026-06-30', netMinor: 500 },
      { date: '2026-07-31', netMinor: 2500 },
      { date: '2026-08-31', netMinor: 2500 },
      { date: '2026-09-30', netMinor: 2500 },
      { date: '2026-10-31', netMinor: 2500 },
      { date: TODAY, netMinor: 2500 },
    ]);
  });

  it('ends at the headline net worth (archived and other currencies left out)', () => {
    const data = makeFile({
      accounts: [
        bank,
        makeAccount({ id: 'old', archived: true }),
        makeAccount({ id: 'eur', currency: 'EUR' }),
      ],
      balances: [
        makeEntry({ accountId: 'bank', date: '2026-01-01', amountMinor: 700 }),
        makeEntry({ accountId: 'old', date: '2026-01-01', amountMinor: 99 }),
        makeEntry({ accountId: 'eur', date: '2026-01-01', amountMinor: 55 }),
      ],
    });
    const trend = netWorthTrend(data, { currency: 'USD', range: '1Y', today: TODAY });
    expect(trend.points.at(-1)?.netMinor).toBe(netWorthByCurrency(data, TODAY).USD?.netMinor);
  });

  it('shows nothing before the first balance and measures change from the first one', () => {
    const data = makeFile({
      accounts: [bank],
      balances: [
        makeEntry({ accountId: 'bank', date: '2026-09-05', amountMinor: 2000 }),
        makeEntry({ accountId: 'bank', date: '2026-11-01', amountMinor: 2500 }),
      ],
    });
    const trend = netWorthTrend(data, { currency: 'USD', range: '1Y', today: TODAY });
    expect(trend.points[0]).toEqual({ date: '2025-11-23', netMinor: null });
    expect(trend.change).toEqual({ fromDate: '2026-09-30', deltaMinor: 500, percent: 25 });
  });

  it('ignores entries dated after today', () => {
    const data = makeFile({
      accounts: [bank],
      balances: [
        makeEntry({ accountId: 'bank', date: '2026-11-01', amountMinor: 1 }),
        makeEntry({ accountId: 'bank', date: '2026-12-01', amountMinor: 999 }),
      ],
    });
    const trend = netWorthTrend(data, { currency: 'USD', range: '1M', today: TODAY });
    expect(trend.points.at(-1)?.netMinor).toBe(1);
  });

  it('uses every entry date for 1M', () => {
    const data = makeFile({
      accounts: [bank, loan],
      balances: [
        makeEntry({ accountId: 'bank', date: '2026-10-01', amountMinor: 100 }),
        makeEntry({ accountId: 'bank', date: '2026-11-05', amountMinor: 200 }),
        makeEntry({ accountId: 'loan', date: '2026-11-05', amountMinor: -50 }),
        makeEntry({ accountId: 'bank', date: '2026-11-20', amountMinor: 300 }),
      ],
    });
    const { points, change } = netWorthTrend(data, { currency: 'USD', range: '1M', today: TODAY });
    expect(points.map((p) => [p.date, p.netMinor])).toEqual([
      ['2026-10-23', 100],
      ['2026-11-05', 150],
      ['2026-11-20', 250],
      [TODAY, 250],
    ]);
    expect(change).toEqual({ fromDate: '2026-10-23', deltaMinor: 150, percent: 150 });
  });

  it('starts All at the first entry and has no change with a single point', () => {
    const one = makeFile({
      accounts: [bank],
      balances: [makeEntry({ accountId: 'bank', date: TODAY, amountMinor: 5 })],
    });
    const trend = netWorthTrend(one, { currency: 'USD', range: 'All', today: TODAY });
    expect(trend).toEqual({ points: [{ date: TODAY, netMinor: 5 }] });

    const longer = makeFile({
      accounts: [bank],
      balances: [makeEntry({ accountId: 'bank', date: '2010-03-31', amountMinor: 5 })],
    });
    const all = netWorthTrend(longer, { currency: 'USD', range: 'All', today: TODAY });
    expect(all.points[0]?.date).toBe('2010-03-31');
    expect(all.points[1]?.date).toBe('2010-04-30');
    expect(all.points).toHaveLength(2 + 199);
    expect(all.change?.percent).toBe(0);
  });

  it('marks the financial-year start when it falls inside the range (never for All)', () => {
    const data = makeFile({
      accounts: [bank],
      balances: [makeEntry({ accountId: 'bank', date: '2020-01-01', amountMinor: 5 })],
    });
    const at = (range: '1M' | '6M' | '1Y' | 'All', month = 4) =>
      netWorthTrend(
        { ...data, settings: { ...data.settings, financialYearStartMonth: month } },
        { currency: 'USD', range, today: TODAY },
      ).financialYearStart;
    expect(at('1Y')).toBe('2026-04-01');
    expect(at('6M')).toBeUndefined(); // 2026-05-23 onwards
    expect(at('6M', 7)).toBe('2026-07-01');
    expect(at('1M', 11)).toBe('2026-11-01');
    expect(at('All')).toBeUndefined();
  });
});

describe('trendCurrencies', () => {
  it('lists currencies with balances on active accounts, base currency first', () => {
    const data = makeFile({
      baseCurrency: 'USD',
      accounts: [
        makeAccount({ id: 'g', currency: 'GBP' }),
        makeAccount({ id: 'u', currency: 'USD' }),
        makeAccount({ id: 'e', currency: 'EUR' }),
        makeAccount({ id: 'j', currency: 'JPY' }),
        makeAccount({ id: 'x', currency: 'CHF', archived: true }),
      ],
      balances: ['g', 'u', 'e', 'x'].map((accountId) => makeEntry({ accountId })),
    });
    expect(trendCurrencies(data)).toEqual(['USD', 'EUR', 'GBP']);
  });
});
