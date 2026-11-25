import { createRatesApi, RatesError } from './frankfurter';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('createRatesApi', () => {
  it('fetches latest and monthly rates and builds a table', async () => {
    const urls: string[] = [];
    const fetchFn: typeof fetch = (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      urls.push(url);
      return url.includes('group=month')
        ? json([
            { date: '2019-03-01', base: 'INR', quote: 'USD', rate: 0.0145 },
            { date: '2019-03-01', base: 'INR', quote: 'EUR', rate: 0.0128 },
            { date: '2019-04-01', base: 'INR', quote: 'USD', rate: 0.0144 },
          ])
        : json([
            { date: '2026-11-24', base: 'INR', quote: 'EUR', rate: 0.0098 },
            { date: '2026-11-25', base: 'INR', quote: 'USD', rate: 0.0108 },
          ]);
    };
    const table = await createRatesApi(fetchFn).fetchTable('INR', ['USD', 'EUR'], '2019-03');
    expect(table).toEqual({
      base: 'INR',
      latest: { date: '2026-11-25', rates: { EUR: 0.0098, USD: 0.0108 } },
      monthly: { '2019-03': { USD: 0.0145, EUR: 0.0128 }, '2019-04': { USD: 0.0144 } },
    });
    expect(urls).toContain('https://api.frankfurter.dev/v2/rates?base=INR');
    expect(urls).toContain(
      'https://api.frankfurter.dev/v2/rates?base=INR&quotes=EUR%2CUSD&from=2019-03-01&group=month',
    );
  });

  it('skips the history request when there is no history to convert', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      json([{ date: '2026-11-25', base: 'INR', quote: 'USD', rate: 0.0108 }]),
    );
    const table = await createRatesApi(fetchFn).fetchTable('INR', [], '2026-11');
    expect(table.monthly).toEqual({});
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('explains failures plainly', async () => {
    const offline = createRatesApi(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(offline.fetchTable('INR', ['USD'], '2020-01')).rejects.toEqual(
      new RatesError('Couldn’t reach the exchange-rate service.'),
    );
    const refused = createRatesApi(() => json({ message: 'nope' }, 422));
    await expect(refused.fetchTable('INR', ['XYZ'], '2020-01')).rejects.toThrow('answered 422');
    const garbage = createRatesApi(() => json({ not: 'rows' }));
    await expect(garbage.fetchTable('INR', ['USD'], '2020-01')).rejects.toThrow('unexpected data');
  });
});
