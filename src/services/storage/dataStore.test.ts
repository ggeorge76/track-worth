import v1Fixture from '@/domain/__fixtures__/data-file-v1.json';
import { createAccount } from '@/domain/accounts';
import { upsertBalance } from '@/domain/balances';
import type { DataFile } from '@/domain/schema';
import { updateSettings } from '@/domain/settingsOps';
import { createMemoryCache } from '@/services/cache/fileCache';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { createFakeDrive } from '@/test/fakeDriveApi';
import { createDataStore, StoreError } from './dataStore';

const NOW = new Date('2026-11-22T10:00:00.000Z');
let n = 0;
const opts = () => ({ now: NOW, newId: () => `new-${String(++n)}` });

function setup() {
  const drive = createFakeDrive();
  const cache = createMemoryCache();
  const store = createDataStore({
    drive: drive.api,
    cache,
    today: () => '2026-11-22',
    now: () => NOW,
  });
  return { drive, cache, store };
}

/** A v2 single file with balances across three April financial years. */
const v2File = {
  ...makeFile({
    accounts: [makeAccount({ id: 'a' }), makeAccount({ id: 'b', name: 'B', kind: 'liability' })],
    balances: [
      makeEntry({ id: 'e1', accountId: 'a', date: '2024-06-30', amountMinor: 100 }),
      makeEntry({ id: 'e2', accountId: 'a', date: '2026-01-31', amountMinor: 200 }),
      makeEntry({ id: 'e3', accountId: 'b', date: '2026-02-28', amountMinor: -300 }),
      makeEntry({ id: 'e4', accountId: 'a', date: '2026-10-31', amountMinor: 400 }),
    ],
  }),
  schemaVersion: 2,
};

const ids = (data: DataFile) => data.balances.map((b) => b.id).sort();

describe('first run', () => {
  it('creates the folder, accounts.json and settings.json', async () => {
    const { drive, store } = setup();
    const { data } = await store.load();
    expect(data.accounts).toEqual([]);
    expect(drive.at('TrackWorth/accounts.json')).toBeDefined();
    expect(drive.at('TrackWorth/settings.json')).toBeDefined();
    expect(drive.at('TrackWorth/balances')).toBeUndefined(); // created when the first balance is saved
  });
});

describe('upgrading the old single file', () => {
  it('splits it into financial-year files, verifies, then trashes the old file', async () => {
    const { drive, store } = setup();
    const legacy = drive.seed('TrackWorth/trackworth-data.json', v2File);
    const loaded = await store.load();

    expect(loaded.migratedFrom).toBe(2);
    expect(ids(loaded.data)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(loaded.data.accounts.map((a) => a.id)).toEqual(['a', 'b']);
    expect(drive.at('TrackWorth/balances/2024.json')).toBeDefined();
    expect(drive.at('TrackWorth/balances/2025.json')).toBeDefined();
    expect(drive.at('TrackWorth/balances/2026.json')).toBeDefined();
    expect(drive.isTrashed(legacy.id)).toBe(true);

    // Order: balances, then accounts, then settings; the old file is trashed last.
    const writes = drive.log.filter((l) => l.startsWith('create') || l.startsWith('trash'));
    expect(writes).toEqual([
      'create 2024.json',
      'create 2025.json',
      'create 2026.json',
      'create accounts.json',
      'create settings.json',
      'trash trackworth-data.json',
    ]);
  });

  it('upgrades a v1 file too', async () => {
    const { drive, store } = setup();
    drive.seed('TrackWorth/trackworth-data.json', v1Fixture);
    const loaded = await store.load();
    expect(loaded.migratedFrom).toBe(1);
    expect(
      loaded.data.balances.find((b) => b.accountId === 'acc-loan' && b.amountMinor !== 0)
        ?.amountMinor,
    ).toBe(-800000);
  });

  it('keeps the old file when the upgraded data doesn’t read back the same', async () => {
    const { drive, store, cache } = setup();
    const legacy = drive.seed('TrackWorth/trackworth-data.json', v2File);
    const realPut = cache.put.bind(cache);
    // Simulate corruption: the copy cached while writing settings.json loses the 2026 file period.
    cache.put = (path, file) =>
      path === 'settings.json'
        ? realPut(path, {
            ...file,
            content: {
              ...(file.content as object),
              balanceFiles: (file.content as { balanceFiles: unknown[] }).balanceFiles.slice(0, 2),
            },
          })
        : realPut(path, file);
    await expect(store.load()).rejects.toMatchObject({ code: 'invalid' });
    expect(drive.isTrashed(legacy.id)).toBe(false);
  });

  it('refuses a file from a newer app version', async () => {
    const { drive, store } = setup();
    drive.seed('TrackWorth/trackworth-data.json', { schemaVersion: 99 });
    await expect(store.load()).rejects.toMatchObject({ code: 'newer-version' });
  });
});

describe('loading v3', () => {
  async function migrated() {
    const env = setup();
    env.drive.seed('TrackWorth/trackworth-data.json', v2File);
    await env.store.load();
    env.drive.clearLog();
    return env;
  }

  it('reads unchanged files from the local copy instead of downloading them', async () => {
    const { drive, store } = await migrated();
    const again = await store.load();
    expect(ids(again.data)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(drive.log.filter((l) => l.startsWith('read'))).toEqual([]);
  });

  it('downloads only the file another device changed', async () => {
    const { drive, store } = await migrated();
    drive.touch('TrackWorth/balances/2026.json', (c) => c);
    await store.load();
    expect(drive.log.filter((l) => l.startsWith('read'))).toEqual(['read 2026.json']);
  });

  it('downloads everything on a device without a local copy', async () => {
    const { drive } = await migrated();
    const fresh = createDataStore({
      drive: drive.api,
      cache: createMemoryCache(),
      today: () => '2026-11-22',
      now: () => NOW,
    });
    await fresh.load();
    expect(drive.log.filter((l) => l.startsWith('read')).sort()).toEqual([
      'read 2024.json',
      'read 2025.json',
      'read 2026.json',
      'read accounts.json',
      'read settings.json',
    ]);
  });

  it('explains a missing year file', async () => {
    const { drive, store } = await migrated();
    drive.remove('TrackWorth/balances/2025.json');
    const error = await store.load().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoreError);
    expect(error).toMatchObject({
      code: 'missing-file',
      message: expect.stringContaining('balances/2025.json') as string,
    });
  });
});

describe('saving', () => {
  async function loaded() {
    const env = setup();
    env.drive.seed('TrackWorth/trackworth-data.json', v2File);
    const result = await env.store.load();
    env.drive.clearLog();
    return { ...env, ...result };
  }
  const writes = (log: string[]) => log.filter((l) => /^(create|update|trash|mkdir)/.test(l));

  it('writes only the year file for a balance change', async () => {
    const { drive, store, data, snapshot } = await loaded();
    const next = upsertBalance(
      data,
      { accountId: 'a', date: '2026-11-22', amountMinor: 999 },
      opts(),
    );
    await store.save(snapshot, next);
    expect(writes(drive.log)).toEqual(['update 2026.json']);
  });

  it('writes the balance file before accounts.json for a new account with an opening balance', async () => {
    const { drive, store, data, snapshot } = await loaded();
    const { data: withAccount, account } = createAccount(
      data,
      { name: 'New', kind: 'asset', tag: 'Cash', liquidity: 3, currency: 'USD' },
      opts(),
    );
    const next = upsertBalance(
      withAccount,
      { accountId: account.id, date: '2026-11-22', amountMinor: 1 },
      opts(),
    );
    await store.save(snapshot, next);
    expect(writes(drive.log)).toEqual(['update 2026.json', 'update accounts.json']);
  });

  it('changes the financial year from the current year (example A), in the safe order', async () => {
    const { drive, store, data, snapshot } = await loaded();
    const next = updateSettings(data, { financialYearStartMonth: 1 });
    const after = await store.save(snapshot, next);
    expect(writes(drive.log)).toEqual([
      'update 2026.json',
      'update settings.json',
      'update 2025.json',
    ]);
    expect(after.layout?.settings.balanceFiles.map((p) => `${p.file} ${p.from}..${p.to}`)).toEqual([
      'balances/2024.json 2024-04-01..2025-03-31',
      'balances/2025.json 2025-04-01..2025-12-31',
      'balances/2026.json 2026-01-01..2026-12-31',
    ]);
    const reloaded = await store.load();
    expect(ids(reloaded.data)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('refuses to overwrite a file another device changed', async () => {
    const { drive, store, data, snapshot } = await loaded();
    drive.touch('TrackWorth/balances/2026.json', (c) => c);
    const next = upsertBalance(
      data,
      { accountId: 'a', date: '2026-11-22', amountMinor: 5 },
      opts(),
    );
    await expect(store.save(snapshot, next)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('does not duplicate a year file left behind by an interrupted save', async () => {
    const { drive, store } = await loaded();
    // A previous save created 2027.json but stopped before listing it in settings.json.
    drive.seed('TrackWorth/balances/2027.json', { leftover: true });
    const reloaded = await store.load();
    const next = upsertBalance(
      reloaded.data,
      { accountId: 'a', date: '2027-05-01', amountMinor: 5 },
      opts(),
    );
    await store.save(reloaded.snapshot, next);
    expect(writes(drive.log)).toEqual(['update 2027.json', 'update settings.json']);
    expect(ids((await store.load()).data)).toContain(next.balances.at(-1)?.id);
  });
});
