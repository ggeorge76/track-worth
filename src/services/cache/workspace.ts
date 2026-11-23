import type { DataFile } from '@/domain/schema';
import type { GoogleUser } from '@/services/auth/desktopAuth';
import type { StoreSnapshot } from '@/services/storage/dataStore';
import { createIndexedDbStore, createMemoryStore, type KeyValueStore } from './fileCache';

/**
 * The on-device workspace (ADR-0015): the data as last synced with Drive (the "base" for merging),
 * changes not uploaded yet, and the signed-in user's display name for an offline start.
 * Cleared on sign-out and on interactive sign-in, like the file cache.
 */
export interface SyncedState {
  data: DataFile;
  snapshot: StoreSnapshot;
}

/** Changes made on this device that aren't uploaded yet (ADR-0015). */
export interface PendingState {
  /** The data including the changes. */
  data: DataFile;
  /** How many changes are waiting, for the status line. */
  count: number;
}

export interface Workspace {
  loadSynced(): Promise<SyncedState | undefined>;
  saveSynced(state: SyncedState): Promise<void>;
  loadPending(): Promise<PendingState | undefined>;
  savePending(state: PendingState): Promise<void>;
  clearPending(): Promise<void>;
  loadUser(): Promise<GoogleUser | undefined>;
  saveUser(user: GoogleUser): Promise<void>;
  clear(): Promise<void>;
}

export function workspaceOn(kv: KeyValueStore): Workspace {
  return {
    loadSynced: async () => (await kv.get('synced')) as SyncedState | undefined,
    saveSynced: (state) => kv.put('synced', state),
    loadPending: async () => (await kv.get('pending')) as PendingState | undefined,
    savePending: (state) => kv.put('pending', state),
    clearPending: () => kv.remove('pending'),
    loadUser: async () => (await kv.get('user')) as GoogleUser | undefined,
    saveUser: (user) => kv.put('user', user),
    clear: () => kv.clear(),
  };
}

export const workspace: Workspace = workspaceOn(
  typeof indexedDB === 'undefined' ? createMemoryStore() : createIndexedDbStore('workspace'),
);
