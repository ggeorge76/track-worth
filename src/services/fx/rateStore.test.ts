import { createMemoryStore } from '@/services/cache/fileCache';
import { rateStoreOn } from './rateStore';

const stored = {
  table: { base: 'INR', latest: { date: '2026-11-25', rates: { USD: 0.012 } }, monthly: {} },
  fetchedAt: '2026-11-25T08:00:00.000Z',
  fromMonth: '2026-11',
  history: [],
};

describe('rateStore', () => {
  it('keeps rates and the user’s own rates per base currency', async () => {
    const store = rateStoreOn(createMemoryStore());
    expect(await store.load('INR')).toBeUndefined();
    await store.save(stored);
    expect(await store.load('INR')).toEqual(stored);
    expect(await store.load('USD')).toBeUndefined();

    expect(await store.loadOverrides('INR')).toEqual({});
    await store.saveOverrides('INR', { USD: 84 });
    expect(await store.loadOverrides('INR')).toEqual({ USD: 84 });
  });

  it('ignores damaged entries', async () => {
    const kv = createMemoryStore();
    await kv.put('rates:INR', { table: 'nope' });
    await kv.put('overrides:INR', { USD: -3 });
    const store = rateStoreOn(kv);
    expect(await store.load('INR')).toBeUndefined();
    expect(await store.loadOverrides('INR')).toEqual({});
  });
});
