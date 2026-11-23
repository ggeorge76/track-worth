import type { DataFile } from '@/domain/schema';
import { threeWayMerge, type Choices, type MergeQuestion } from '@/domain/sync/merge';
import type { PendingState, SyncedState, Workspace } from '@/services/cache/workspace';
import { DriveError } from '@/services/drive/driveClient';
import { StoreError, type DataStore } from '@/services/storage/dataStore';

/**
 * Offline-first sync (ADR-0015). Every change is saved on the device first, then uploaded. If
 * Drive changed meanwhile, the change is merged three-way (base = last synced, local = this
 * device, remote = Drive now); accounts or settings changed differently on both sides become
 * questions for the user.
 */
export interface SyncState {
  /** What the user sees: the synced data plus this device's changes. */
  data: DataFile;
  /** The data and files as last synced with Drive (the merge base). */
  synced: SyncedState;
  /** Changes saved on this device and not uploaded yet. */
  pending: number;
  /** Drive couldn't be reached. */
  offline: boolean;
  /** Both sides changed the same account(s) or settings: the user must choose. */
  decision?: { questions: MergeQuestion[]; remote: SyncedState };
  /** The last upload failed for another reason; it is retried automatically. */
  uploadError?: string;
}

const isOffline = (err: unknown) => err instanceof DriveError && err.code === 'offline';
const isConflict = (err: unknown) => err instanceof StoreError && err.code === 'conflict';

const UPLOAD_FAILED =
  'Couldn’t upload your changes. They’re saved on this device and will be retried.';

export interface SyncEngineOptions {
  store: Pick<DataStore, 'load' | 'save'>;
  workspace: Workspace;
  now?: () => Date;
}

export function createSyncEngine({ store, workspace, now = () => new Date() }: SyncEngineOptions) {
  async function finish(synced: SyncedState): Promise<SyncState> {
    await workspace.saveSynced(synced);
    await workspace.clearPending();
    return { data: synced.data, synced, pending: 0, offline: false };
  }

  function waiting(
    synced: SyncedState,
    pending: PendingState,
    extra: Partial<SyncState> = {},
  ): SyncState {
    return { data: pending.data, synced, pending: pending.count, offline: false, ...extra };
  }

  async function mergeAndUpload(
    synced: SyncedState,
    pending: PendingState,
    remote: SyncedState,
    choices: Choices,
  ): Promise<SyncState> {
    const { data, questions } = threeWayMerge(
      synced.data,
      pending.data,
      remote.data,
      choices,
      now(),
    );
    if (questions.length > 0) return waiting(synced, pending, { decision: { questions, remote } });
    try {
      return await finish({ data, snapshot: await store.save(remote.snapshot, data) });
    } catch (err) {
      if (isOffline(err)) return waiting(synced, pending, { offline: true });
      // Drive changed yet again while merging: keep everything and retry on the next round.
      return waiting(synced, pending, { uploadError: UPLOAD_FAILED });
    }
  }

  /** Upload this device's changes, merging with Drive if it changed since the last sync. */
  async function upload(synced: SyncedState, pending: PendingState): Promise<SyncState> {
    try {
      return await finish({
        data: pending.data,
        snapshot: await store.save(synced.snapshot, pending.data),
      });
    } catch (err) {
      if (isOffline(err)) return waiting(synced, pending, { offline: true });
      if (!isConflict(err)) return waiting(synced, pending, { uploadError: UPLOAD_FAILED });
    }
    let remote: SyncedState;
    try {
      const loaded = await store.load();
      remote = { data: loaded.data, snapshot: loaded.snapshot };
    } catch (err) {
      return waiting(
        synced,
        pending,
        isOffline(err) ? { offline: true } : { uploadError: UPLOAD_FAILED },
      );
    }
    return mergeAndUpload(synced, pending, remote, {});
  }

  return {
    /**
     * Open the data: upload any changes waiting from before, otherwise load from Drive. Without a
     * connection, show this device's copy (throws only if there is none).
     */
    async load(): Promise<SyncState> {
      const [synced, pending] = await Promise.all([
        workspace.loadSynced(),
        workspace.loadPending(),
      ]);
      if (synced && pending) return upload(synced, pending);
      try {
        const loaded = await store.load();
        const fresh = { data: loaded.data, snapshot: loaded.snapshot };
        await workspace.saveSynced(fresh);
        return { data: fresh.data, synced: fresh, pending: 0, offline: false };
      } catch (err) {
        if (isOffline(err) && synced)
          return { data: synced.data, synced, pending: 0, offline: true };
        throw err;
      }
    },

    /** Record a change on the device, then try to upload it. */
    async commit(current: SyncState, next: DataFile): Promise<SyncState> {
      const pending: PendingState = { data: next, count: current.pending + 1 };
      await workspace.savePending(pending);
      if (current.decision)
        return mergeAndUpload(current.synced, pending, current.decision.remote, {});
      return upload(current.synced, pending);
    },

    /** Apply the user's answers to the open questions and upload. */
    async resolve(current: SyncState, choices: Choices): Promise<SyncState> {
      if (!current.decision) return current;
      const pending: PendingState = { data: current.data, count: current.pending };
      return mergeAndUpload(current.synced, pending, current.decision.remote, choices);
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
