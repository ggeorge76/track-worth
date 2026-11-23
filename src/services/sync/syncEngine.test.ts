import { createAccount, updateAccount } from '@/domain/accounts';
import { upsertBalance } from '@/domain/balances';
import type { DataFile } from '@/domain/schema';
import { createMemoryCache, createMemoryStore } from '@/services/cache/fileCache';
import { workspaceOn } from '@/services/cache/workspace';
import { DriveError } from '@/services/drive/driveClient';
import { createDataStore, type DriveApi } from '@/services/storage/dataStore';
import { createFakeDrive } from '@/test/fakeDriveApi';
import { createSyncEngine, type SyncState } from './syncEngine';

const NOW = new Date('2026-11-23T10:00:00.000Z');
let n = 0;
const opts = () => ({ now: new Date(NOW.getTime() + ++n * 1000), newId: () => `id-${String(n)}` });

/** One Drive, any number of devices; each device can lose its connection. */
function world() {
  const drive = createFakeDrive();
  function device() {
    let offline = false;
    const api = new Proxy(drive.api, {
      get(target, prop: keyof DriveApi) {
        const fn = target[prop];
        return (...args: unknown[]) =>
          offline
            ? Promise.reject(new DriveError('Google Drive can’t be reached', 'offline'))
            : (fn as (...a: unknown[]) => unknown)(...args);
      },
    });
    const workspace = workspaceOn(createMemoryStore());
    const store = createDataStore({
      drive: api,
      cache: createMemoryCache(),
      today: () => '2026-11-23',
      now: () => NOW,
    });
    const engine = createSyncEngine({ store, workspace, now: () => NOW });
    return {
      engine,
      workspace,
      goOffline: () => (offline = true),
      goOnline: () => (offline = false),
      /** Make a change the way the app does: commit to the engine. */
      edit: (state: SyncState, change: (d: DataFile) => DataFile) =>
        engine.commit(state, change(state.data)),
      /** A brand-new engine on the same device storage (app restart). */
      restart: () => createSyncEngine({ store, workspace, now: () => NOW }),
    };
  }
  return { drive, device };
}

const addBank = (d: DataFile) =>
  createAccount(
    d,
    { name: 'Bank', kind: 'asset', tag: 'Cash', liquidity: 5, currency: 'USD' },
    { now: NOW, newId: () => 'bank' },
  ).data;
const setBalance = (date: string, amountMinor: number) => (d: DataFile) =>
  upsertBalance(d, { accountId: 'bank', date, amountMinor }, opts());
const rename = (name: string) => (d: DataFile) => updateAccount(d, 'bank', { name });

async function setupWithAccount() {
  const w = world();
  const laptop = w.device();
  let state = await laptop.engine.load();
  state = await laptop.edit(state, addBank);
  expect(state.pending).toBe(0);
  return { ...w, laptop, state };
}

describe('online', () => {
  it('uploads each change straight away', async () => {
    const { laptop, state, drive } = await setupWithAccount();
    const next = await laptop.edit(state, setBalance('2026-11-23', 100));
    expect(next).toMatchObject({ pending: 0, offline: false });
    expect(drive.at('TrackWorth/balances/2026.json')).toBeDefined();
  });
});

describe('offline editing', () => {
  it('keeps changes on the device while offline, across a restart, and uploads them later', async () => {
    const { laptop, state, drive } = await setupWithAccount();
    laptop.goOffline();
    let s = await laptop.edit(state, setBalance('2026-11-20', 100));
    s = await laptop.edit(s, setBalance('2026-11-23', 200));
    expect(s).toMatchObject({ pending: 2, offline: true });
    expect(s.data.balances).toHaveLength(2);
    expect(drive.at('TrackWorth/balances')).toBeUndefined(); // nothing uploaded

    // The app is closed and reopened, still offline: the changes are still there.
    const restarted = laptop.restart();
    s = await restarted.load();
    expect(s).toMatchObject({ pending: 2, offline: true });
    expect(s.data.balances).toHaveLength(2);

    laptop.goOnline();
    s = await restarted.load();
    expect(s).toMatchObject({ pending: 0, offline: false });
    expect(await laptop.workspace.loadPending()).toBeUndefined();
    const phone = createSyncEngine({
      store: createDataStore({ drive: drive.api, cache: createMemoryCache() }),
      workspace: workspaceOn(createMemoryStore()),
    });
    expect((await phone.load()).data.balances.map((b) => b.amountMinor).sort()).toEqual([100, 200]);
  });

  it('merges balances automatically when Drive changed meanwhile', async () => {
    const { laptop, state, device } = await setupWithAccount();
    const phone = device();
    const phoneState = await phone.engine.load();

    laptop.goOffline();
    await laptop.edit(state, setBalance('2026-11-20', 100));
    await phone.edit(phoneState, setBalance('2026-11-21', 999)); // uploaded from the phone

    laptop.goOnline();
    const synced = await laptop.engine.load();
    expect(synced).toMatchObject({ pending: 0, offline: false });
    expect(synced.decision).toBeUndefined();
    expect(synced.data.balances.map((b) => b.amountMinor).sort((a, b) => a - b)).toEqual([
      100, 999,
    ]);
  });

  it('asks when the same account was changed on both sides, then applies the answer', async () => {
    const { laptop, state, device } = await setupWithAccount();
    const phone = device();
    const phoneState = await phone.engine.load();

    laptop.goOffline();
    await laptop.edit(state, rename('Bank (laptop)'));
    await phone.edit(phoneState, rename('Bank (phone)'));

    laptop.goOnline();
    let s = await laptop.engine.load();
    expect(s.decision?.questions).toEqual([
      expect.objectContaining({
        kind: 'account',
        id: 'bank',
        local: expect.objectContaining({ name: 'Bank (laptop)' }) as unknown,
      }),
    ]);
    expect(s.pending).toBe(1);

    s = await laptop.engine.resolve(s, { bank: 'remote' });
    expect(s).toMatchObject({ pending: 0 });
    expect(s.decision).toBeUndefined();
    expect(s.data.accounts[0]?.name).toBe('Bank (phone)');
  });

  it('keeps editing while a decision is open, without losing the question', async () => {
    const { laptop, state, device } = await setupWithAccount();
    const phone = device();
    const phoneState = await phone.engine.load();
    laptop.goOffline();
    await laptop.edit(state, rename('Laptop'));
    await phone.edit(phoneState, rename('Phone'));
    laptop.goOnline();
    let s = await laptop.engine.load();
    s = await laptop.edit(s, setBalance('2026-11-23', 5));
    expect(s.decision?.questions).toHaveLength(1);
    expect(s.pending).toBe(2);
    s = await laptop.engine.resolve(s, { bank: 'local' });
    expect(s.pending).toBe(0);
    expect(s.data.accounts[0]?.name).toBe('Laptop');
    expect(s.data.balances).toHaveLength(1);
  });
});

describe('opening the app', () => {
  it('shows the device copy when offline, and needs a copy to exist', async () => {
    const { laptop } = await setupWithAccount();
    laptop.goOffline();
    const s = await laptop.restart().load();
    expect(s).toMatchObject({ offline: true, pending: 0 });
    expect(s.data.accounts[0]?.name).toBe('Bank');

    const fresh = world().device();
    fresh.goOffline();
    await expect(fresh.engine.load()).rejects.toMatchObject({ code: 'offline' });
  });
});
