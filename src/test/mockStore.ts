/**
 * Shared fake data store for screen tests. Use with (vi.mock is hoisted, hence the import):
 *   vi.mock('@/services/storage/dataStore', async (importOriginal) =>
 *     (await import('@/test/mockStore')).mockStoreModule(importOriginal));
 */
import type * as storeModule from '@/services/storage/dataStore';
import type { DataStore, StoreSnapshot } from '@/services/storage/dataStore';

export const emptySnapshot: StoreSnapshot = {
  rootId: 'root',
  balancesFolderId: null,
  files: {},
  layout: null,
};

export const fakeStore = {
  load: vi.fn<DataStore['load']>(),
  /** Succeeds by default, returning the snapshot it was given. */
  save: vi.fn<DataStore['save']>((snapshot) => Promise.resolve(snapshot)),
};

export async function mockStoreModule(importOriginal: () => Promise<typeof storeModule>) {
  return { ...(await importOriginal()), createDataStore: () => fakeStore };
}
