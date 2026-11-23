import type { DataFile } from '@/domain/schema';
import type { GoogleUser } from '@/services/auth/desktopAuth';
import type { StoreSnapshot } from '@/services/storage/dataStore';
import { createIndexedDbStore, createMemoryStore, type KeyValueStore } from './fileCache';

/**
 * The on-device workspace (ADR-0015): the data as last synced with Drive, so the app can open and
 * show it without a connection, and the signed-in user's display name for an offline start.
 * Cleared on sign-out and on interactive sign-in, like the file cache.
 */
export interface SyncedState {
  data: DataFile;
  snapshot: StoreSnapshot;
}

export interface Workspace {
  loadSynced(): Promise<SyncedState | undefined>;
  saveSynced(state: SyncedState): Promise<void>;
  loadUser(): Promise<GoogleUser | undefined>;
  saveUser(user: GoogleUser): Promise<void>;
  clear(): Promise<void>;
}

export function workspaceOn(kv: KeyValueStore): Workspace {
  return {
    loadSynced: async () => (await kv.get('synced')) as SyncedState | undefined,
    saveSynced: (state) => kv.put('synced', state),
    loadUser: async () => (await kv.get('user')) as GoogleUser | undefined,
    saveUser: (user) => kv.put('user', user),
    clear: () => kv.clear(),
  };
}

export const workspace: Workspace = workspaceOn(
  typeof indexedDB === 'undefined' ? createMemoryStore() : createIndexedDbStore('workspace'),
);
