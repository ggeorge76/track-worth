import { createMemoryStore } from '@/services/cache/fileCache';
import type { RatesApi } from './frankfurter';
import { rateStoreOn } from './rateStore';
import { loadRates } from './rates';

const table = {
  base: 'INR',
  latest: { date: '2026-11-25', rates: { USD: 0.012 } },
  monthly: { '2020-01': { USD: 0.014 } },
};
const NOW = new Date('2026-11-25T08:00:00.000Z');

function setup(fetchTable: RatesApi['fetchTable'] = () => Promise.resolve(table)) {
  const store = rateStoreOn(createMemoryStore());
  const api = { fetchTable: vi.fn(fetchTable) };
  const load = (over: { today?: string; currencies?: string[]; fromMonth?: string } = {}) =>
    loadRates({
      base: 'INR',
      currencies: over.currencies ?? ['USD'],
      fromMonth: over.fromMonth ?? '2020-01',
      today: over.today ?? '2026-11-25',
      now: NOW,
      api,
      store,
    });
  return { store, api, load };
}

describe('loadRates', () => {
  it('fetches once a day and reuses the device copy meanwhile', async () => {
    const { api, load } = setup();
    expect((await load()).stored?.table).toEqual(table);
    expect((await load()).stored?.table).toEqual(table);
    expect(api.fetchTable).toHaveBeenCalledOnce();

    await load({ today: '2026-11-26' });
    await load({ today: '2026-11-26', currencies: ['USD', 'EUR'] });
    await load({ today: '2026-11-26', currencies: ['USD', 'EUR'], fromMonth: '2010-01' });
    expect(api.fetchTable).toHaveBeenCalledTimes(4);
  });

  it('falls back to the device copy, or says rates are missing, when offline', async () => {
    let online = true;
    const { load } = setup(() =>
      online ? Promise.resolve(table) : Promise.reject(new Error('offline')),
    );
    online = false;
    expect(await load()).toEqual({
      problem: expect.stringContaining('Couldn’t get exchange rates') as string,
    });
    online = true;
    await load();
    online = false;
    const stale = await load({ today: '2026-11-26' });
    expect(stale.stored?.table).toEqual(table);
    expect(stale.problem).toMatch(/Couldn’t update exchange rates, so rates from .* are used\./);
  });
});
