import { z } from 'zod';
import type { RateOverrides, RateTable } from '@/domain/fx';
import {
  createIndexedDbStore,
  createMemoryStore,
  type KeyValueStore,
} from '@/services/cache/fileCache';

/**
 * Exchange rates kept on this device (ADR-0018): the last rates fetched, so charts work offline,
 * and the user's own rates. Neither is personal financial data, so they survive sign-out.
 */

const ratesSchema = z.record(z.string(), z.number().positive());
const storedSchema = z.object({
  table: z.object({
    base: z.string(),
    latest: z.object({ date: z.string(), rates: ratesSchema }),
    monthly: z.record(z.string(), ratesSchema),
  }),
  /** When fetched (ISO-8601), and what it covers. */
  fetchedAt: z.string(),
  fromMonth: z.string(),
  history: z.array(z.string()),
});

export type StoredRates = z.infer<typeof storedSchema> & { table: RateTable };

export interface RateStore {
  load(base: string): Promise<StoredRates | undefined>;
  save(rates: StoredRates): Promise<void>;
  loadOverrides(base: string): Promise<RateOverrides>;
  saveOverrides(base: string, overrides: RateOverrides): Promise<void>;
}

export function rateStoreOn(kv: KeyValueStore): RateStore {
  return {
    async load(base) {
      // Stored data is parsed like any input: an old or damaged entry is just refetched.
      const parsed = storedSchema.safeParse(await kv.get(`rates:${base}`));
      return parsed.success && parsed.data.table.base === base ? parsed.data : undefined;
    },
    save: (rates) => kv.put(`rates:${rates.table.base}`, rates),
    async loadOverrides(base) {
      const parsed = ratesSchema.safeParse(await kv.get(`overrides:${base}`));
      return parsed.success ? parsed.data : {};
    },
    saveOverrides: (base, overrides) => kv.put(`overrides:${base}`, overrides),
  };
}

export const rateStore: RateStore = rateStoreOn(
  typeof indexedDB === 'undefined' ? createMemoryStore() : createIndexedDbStore('fx'),
);
