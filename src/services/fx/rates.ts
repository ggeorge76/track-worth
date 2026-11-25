import { formatIsoDate } from '@/domain/dates';
import type { RatesApi } from './frankfurter';
import type { RateStore, StoredRates } from './rateStore';

export interface LoadedRates {
  stored?: StoredRates;
  /** Plain-language note when rates couldn't be refreshed. */
  problem?: string;
}

/**
 * Rates for `base`, refreshed at most once a day (ADR-0018). Uses the device copy when it's from
 * today and covers what's needed; otherwise fetches. If fetching fails, falls back to the device
 * copy and says so: amounts are never silently converted at a made-up rate.
 */
export async function loadRates(options: {
  base: string;
  currencies: readonly string[];
  fromMonth: string;
  today: string;
  now: Date;
  api: RatesApi;
  store: RateStore;
}): Promise<LoadedRates> {
  const { base, currencies, fromMonth, today, api, store } = options;
  const cached = await store.load(base);
  const fresh =
    cached !== undefined &&
    cached.fetchedAt.slice(0, 10) === today &&
    cached.fromMonth <= fromMonth &&
    currencies.every((c) => cached.history.includes(c));
  if (fresh) return { stored: cached };
  try {
    const table = await api.fetchTable(base, currencies, fromMonth);
    const stored: StoredRates = {
      table,
      // The local date, so "fetched today" matches the user's day.
      fetchedAt: `${today}T${options.now.toISOString().slice(11)}`,
      fromMonth,
      history: [...currencies],
    };
    await store.save(stored);
    return { stored };
  } catch {
    return cached
      ? {
          stored: cached,
          problem: `Couldn’t update exchange rates, so rates from ${formatIsoDate(cached.table.latest.date)} are used.`,
        }
      : {
          problem:
            'Couldn’t get exchange rates. Amounts in other currencies are left out until you’re back online.',
        };
  }
}
