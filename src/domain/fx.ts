import { fractionDigits } from './money';
import type { DataFile } from './schema';

/**
 * Currency conversion (ADR-0018). Balances are always stored in their account's own currency;
 * totals, charts and insights convert them to the base currency (settings) using:
 * - for the current month: the user's own rate if set, else the latest daily rate;
 * - for past months: that month's rate (so history uses the rate of its time), falling back to
 *   the nearest earlier month, then to the current rate.
 * A currency with no rate at all can't be converted; callers leave it out and say so.
 */

/** Rates as fetched: 1 unit of `base` = `rates[currency]` units of that currency. */
export interface RateTable {
  base: string;
  latest: { date: string; rates: Readonly<Record<string, number>> };
  /** By month (`YYYY-MM`), same direction as `latest`. */
  monthly: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** The user's own rates: 1 unit of the currency = `value` units of the base currency. */
export type RateOverrides = Readonly<Record<string, number>>;

export interface Converter {
  base: string;
  /** Base-currency units per 1 unit of `currency` on `date`, or null if unknown. */
  rate(currency: string, date: string): number | null;
  /** `amountMinor` in `currency` as base-currency minor units on `date`, or null if unknown. */
  toBase(amountMinor: number, currency: string, date: string): number | null;
}

const positive = (n: number | undefined): n is number =>
  n !== undefined && Number.isFinite(n) && n > 0;

/**
 * Convert minor units between currencies. Exchange rates are inherently fractional, so this is
 * the one place money meets a float: one multiplication, rounded straight back to integer minor
 * units of the target currency.
 */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  const scale = 10 ** (fractionDigits(to) - fractionDigits(from));
  return Math.round(amountMinor * rate * scale);
}

export function createConverter(
  base: string,
  table: RateTable | undefined,
  overrides: RateOverrides,
  today: string,
): Converter {
  const usable = table?.base === base ? table : undefined;
  const months = usable ? Object.keys(usable.monthly).sort() : [];
  const invert = (perBase: number | undefined) => (positive(perBase) ? 1 / perBase : null);
  const current = (currency: string) => {
    const own = overrides[currency];
    return positive(own) ? own : invert(usable?.latest.rates[currency]);
  };

  const rate = (currency: string, date: string): number | null => {
    if (currency === base) return 1;
    const month = date.slice(0, 7);
    if (month >= today.slice(0, 7)) return current(currency);
    // The nearest month on or before `date` that has this currency.
    for (let i = months.length - 1; i >= 0; i--) {
      const m = months[i] as string;
      if (m > month) continue;
      const r = invert(usable?.monthly[m]?.[currency]);
      if (r !== null) return r;
    }
    return current(currency);
  };

  return {
    base,
    rate,
    toBase(amountMinor, currency, date) {
      const r = rate(currency, date);
      return r === null ? null : convertMinor(amountMinor, currency, base, r);
    },
  };
}

/** A converter for data that is all in one currency (no rates needed). */
export function sameCurrencyConverter(base: string): Converter {
  return createConverter(base, undefined, {}, '9999-12-31');
}

/**
 * What rates the data needs: currencies other than the base that have balances (on active
 * accounts) or earlier history, and the first month any of them appears.
 */
export function rateNeeds(
  data: { baseCurrency: string } & Pick<DataFile, 'accounts' | 'balances' | 'netWorthHistory'>,
): { currencies: string[]; fromMonth: string | null } {
  const currencyOf = new Map(
    data.accounts.filter((a) => !a.archived).map((a) => [a.id, a.currency]),
  );
  const currencies = new Set<string>();
  const dates: string[] = [];
  const note = (currency: string | undefined, date: string) => {
    if (currency === undefined || currency === data.baseCurrency) return;
    currencies.add(currency);
    dates.push(date);
  };
  for (const entry of data.balances) note(currencyOf.get(entry.accountId), entry.date);
  for (const point of data.netWorthHistory) note(point.currency, point.date);
  const first = dates.sort()[0];
  const fromMonth = first === undefined ? null : first.slice(0, 7);
  return { currencies: [...currencies].sort(), fromMonth };
}
