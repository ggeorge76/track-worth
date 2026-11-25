import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import {
  convertMinor,
  createConverter,
  rateNeeds,
  sameCurrencyConverter,
  type RateTable,
} from './fx';

const TODAY = '2026-11-25';
// 1 INR = 0.012 USD now; 0.0145 USD in March 2019; EUR only known now.
const table: RateTable = {
  base: 'INR',
  latest: { date: '2026-11-25', rates: { USD: 0.0125, EUR: 0.01, JPY: 1.8 } },
  monthly: {
    '2019-03': { USD: 0.0145 },
    '2019-05': { USD: 0.0143, BAD: 0 },
    '2026-11': { USD: 0.012 },
  },
};

describe('convertMinor', () => {
  it('converts between currencies with different minor units, rounding once', () => {
    expect(convertMinor(100_00, 'USD', 'INR', 80)).toBe(8_000_00);
    expect(convertMinor(1_000, 'JPY', 'INR', 0.5555)).toBe(555_50);
    expect(convertMinor(1_23, 'INR', 'JPY', 1.8)).toBe(2);
    expect(convertMinor(-1, 'USD', 'INR', 80)).toBe(-80);
  });
});

describe('createConverter', () => {
  const fx = createConverter('INR', table, {}, TODAY);

  it('is 1 for the base currency', () => {
    expect(fx.rate('INR', '2001-01-01')).toBe(1);
    expect(fx.toBase(5, 'INR', TODAY)).toBe(5);
  });

  it('uses the latest rate for this month', () => {
    expect(fx.rate('USD', TODAY)).toBe(80);
    expect(fx.toBase(10_00, 'USD', '2026-11-02')).toBe(800_00);
  });

  it('uses the month’s rate for the past, or the nearest earlier month', () => {
    expect(fx.toBase(1_00, 'USD', '2019-03-31')).toBe(Math.round(100 / 0.0145));
    expect(fx.rate('USD', '2019-04-30')).toBeCloseTo(1 / 0.0145); // April missing → March
    expect(fx.rate('USD', '2019-05-31')).toBeCloseTo(1 / 0.0143);
  });

  it('falls back to the current rate when no earlier month has the currency', () => {
    expect(fx.rate('EUR', '2018-01-31')).toBe(100);
    expect(fx.rate('USD', '2010-01-31')).toBe(80);
  });

  it('returns null when a currency has no rate', () => {
    expect(fx.rate('GBP', TODAY)).toBeNull();
    expect(fx.toBase(1, 'GBP', '2019-03-31')).toBeNull();
    expect(fx.rate('BAD', '2019-05-31')).toBeNull(); // zero rates are ignored
  });

  it('prefers the user’s own rate for the current value', () => {
    const own = createConverter('INR', table, { USD: 84, GBP: 105, EUR: -1 }, TODAY);
    expect(own.rate('USD', TODAY)).toBe(84);
    expect(own.rate('USD', '2019-03-31')).toBeCloseTo(1 / 0.0145); // history unchanged
    expect(own.rate('GBP', '2015-01-31')).toBe(105); // no history → own rate
    expect(own.rate('EUR', TODAY)).toBe(100); // invalid own rate ignored
  });

  it('ignores rates fetched for another base currency', () => {
    expect(createConverter('USD', table, {}, TODAY).rate('INR', TODAY)).toBeNull();
  });
});

describe('sameCurrencyConverter', () => {
  it('converts only its own currency', () => {
    const fx = sameCurrencyConverter('USD');
    expect(fx.toBase(7, 'USD', TODAY)).toBe(7);
    expect(fx.toBase(7, 'EUR', TODAY)).toBeNull();
  });
});

describe('rateNeeds', () => {
  it('lists foreign currencies with balances or history, and the first month needed', () => {
    const data = makeFile({
      baseCurrency: 'INR',
      accounts: [
        makeAccount({ id: 'inr', currency: 'INR' }),
        makeAccount({ id: 'usd', currency: 'USD' }),
        makeAccount({ id: 'old', currency: 'GBP', archived: true }),
        makeAccount({ id: 'new', currency: 'JPY' }), // no balance yet
      ],
      balances: [
        makeEntry({ accountId: 'inr', date: '2001-01-01' }),
        makeEntry({ accountId: 'usd', date: '2020-05-10' }),
        makeEntry({ accountId: 'usd', date: '2019-02-10' }),
        makeEntry({ accountId: 'old', date: '2000-01-01' }),
      ],
      netWorthHistory: [
        { date: '2018-12-31', amountMinor: 1, currency: 'EUR' },
        { date: '2010-12-31', amountMinor: 1, currency: 'INR' },
      ],
    });
    expect(rateNeeds(data)).toEqual({ currencies: ['EUR', 'USD'], fromMonth: '2018-12' });
    expect(rateNeeds(makeFile())).toEqual({ currencies: [], fromMonth: null });
  });
});
