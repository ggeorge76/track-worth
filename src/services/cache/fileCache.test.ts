import { createIndexedDbCache, createMemoryCache } from './fileCache';

describe('memory cache', () => {
  it('stores, replaces, removes and clears files by path', async () => {
    const cache = createMemoryCache();
    await cache.put('settings.json', { id: '1', version: '2', content: { a: 1 } });
    expect(await cache.get('settings.json')).toEqual({ id: '1', version: '2', content: { a: 1 } });
    await cache.put('settings.json', { id: '1', version: '3', content: { a: 2 } });
    expect((await cache.get('settings.json'))?.version).toBe('3');
    await cache.put('balances/2026.json', { id: '9', version: '1', content: {} });
    await cache.remove('settings.json');
    expect(await cache.get('settings.json')).toBeUndefined();
    await cache.clear();
    expect(await cache.get('balances/2026.json')).toBeUndefined();
  });
});

describe('IndexedDB cache when IndexedDB is unavailable', () => {
  /** A factory whose open() always fails, like a blocked or broken IndexedDB. */
  const failingFactory = {
    open: () => {
      const request = {
        result: undefined,
        error: new Error('blocked'),
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        request.onerror?.(new Event('error'));
      });
      return request;
    },
  } as unknown as IDBFactory;

  it('degrades to "not cached" without throwing', async () => {
    const cache = createIndexedDbCache(failingFactory);
    await expect(cache.put('a', { id: '1', version: '1', content: 1 })).resolves.toBeUndefined();
    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.remove('a')).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});
