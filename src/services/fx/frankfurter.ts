import { z } from 'zod';
import type { RateTable } from '@/domain/fx';
import { httpFetch } from '@/services/platform';

/**
 * Exchange rates from Frankfurter (https://frankfurter.dev, ADR-0018): free, open source, no API
 * key; official central-bank reference rates. The request carries only currency codes and dates,
 * never balances or account details. Allowed in src-tauri/capabilities/default.json.
 */

const API = 'https://api.frankfurter.dev/v2/rates';

const rowsSchema = z.array(
  z.object({
    date: z.iso.date(),
    base: z.string(),
    quote: z.string(),
    rate: z.number().positive(),
  }),
);

export class RatesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RatesError';
  }
}

async function get(fetchFn: typeof fetch, params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  let response: Response;
  try {
    response = await fetchFn(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new RatesError('Couldn’t reach the exchange-rate service.', { cause: err });
  }
  if (!response.ok) {
    throw new RatesError(`The exchange-rate service answered ${String(response.status)}.`);
  }
  const parsed = rowsSchema.safeParse(await response.json());
  if (!parsed.success) throw new RatesError('The exchange-rate service sent unexpected data.');
  return parsed.data;
}

export interface RatesApi {
  /**
   * Rates from `base`: the latest daily rate for every currency the service knows, plus one rate
   * per month from `fromMonth` (`YYYY-MM`) to now for `history` currencies (those it knows; an
   * unknown code would fail the whole request). At most two requests, however long the history.
   */
  fetchTable(base: string, history: readonly string[], fromMonth: string): Promise<RateTable>;
}

export function createRatesApi(fetchFn: typeof fetch = httpFetch): RatesApi {
  return {
    async fetchTable(base, history, fromMonth) {
      const latestRows = await get(fetchFn, { base });
      const latest: Record<string, number> = {};
      let date = '';
      for (const row of latestRows) {
        latest[row.quote] = row.rate;
        if (row.date > date) date = row.date;
      }
      const quotes = [...new Set(history)].filter((c) => c in latest).sort();
      const monthly: Record<string, Record<string, number>> = {};
      if (quotes.length > 0) {
        const rows = await get(fetchFn, {
          base,
          quotes: quotes.join(','),
          from: `${fromMonth}-01`,
          group: 'month',
        });
        for (const row of rows) (monthly[row.date.slice(0, 7)] ??= {})[row.quote] = row.rate;
      }
      return { base, latest: { date, rates: latest }, monthly };
    },
  };
}
