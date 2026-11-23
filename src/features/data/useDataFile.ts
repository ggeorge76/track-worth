import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { ChangeOptions } from '@/domain/accounts';
import { newId } from '@/domain/ids';
import { dataFileSchema, type DataFile } from '@/domain/schema';
import { useAuth } from '@/features/auth/authContext';
import { fileCache } from '@/services/cache/fileCache';
import { workspace } from '@/services/cache/workspace';
import { createDriveClient, DriveError } from '@/services/drive/driveClient';
import { createDataStore, StoreError, type StoreSnapshot } from '@/services/storage/dataStore';

export const DATA_FILE_KEY = ['data-file'] as const;
export const SAVE_MUTATION_KEY = ['save-data-file'] as const;

export interface LoadedDataFile {
  data: DataFile;
  /** What this device last read from or wrote to Drive (ADR-0014). */
  snapshot: StoreSnapshot;
  /** True when Drive couldn't be reached and this is the copy saved on the device (ADR-0015). */
  offline: boolean;
}

/** How often to try again while offline. */
export const OFFLINE_RETRY_MS = 30_000;

const isOffline = (err: unknown) => err instanceof DriveError && err.code === 'offline';

/** A pure change to the data, e.g. `(data, opts) => upsertBalance(data, input, opts)`. */
export type DataChange = (data: DataFile, options: ChangeOptions) => DataFile;

export class SaveError extends Error {
  constructor(
    message: string,
    readonly code: 'conflict' | 'offline' | 'failed',
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

function useDataStore() {
  const { getAccessToken } = useAuth();
  return useMemo(
    () => createDataStore({ drive: createDriveClient({ getAccessToken }), cache: fileCache }),
    [getAccessToken],
  );
}

/**
 * Loads the data from Drive (only changed files are downloaded), upgrading old formats. Without
 * a connection it shows the copy last synced to this device, and tries again when the
 * connection returns and every 30 seconds (ADR-0015).
 */
export function useDataFile() {
  const store = useDataStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const reconnect = () => {
      void queryClient.invalidateQueries({ queryKey: DATA_FILE_KEY });
    };
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('online', reconnect);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: DATA_FILE_KEY,
    // Always run: our own offline handling falls back to the device copy. (The default pauses
    // queries whenever the OS says it's offline, which would leave the app stuck loading.)
    networkMode: 'always',
    refetchInterval: (query) => (query.state.data?.offline ? OFFLINE_RETRY_MS : false),
    queryFn: async (): Promise<LoadedDataFile> => {
      try {
        const { data, snapshot } = await store.load();
        await workspace.saveSynced({ data, snapshot });
        return { data, snapshot, offline: false };
      } catch (err) {
        if (isOffline(err)) {
          const synced = await workspace.loadSynced();
          if (synced) return { ...synced, offline: true };
          throw new Error(
            'You’re offline, and this device doesn’t have a copy of your data yet. Connect to the internet, then reload.',
            { cause: err },
          );
        }
        if (err instanceof StoreError) throw new Error(err.message, { cause: err });
        if (err instanceof DriveError && err.code === 'http') {
          throw new Error(
            'Couldn’t load your data from Google Drive. Check your internet connection, then reload.',
            { cause: err },
          );
        }
        throw err;
      }
    },
  });
}

function toSaveError(err: unknown): SaveError {
  if (err instanceof StoreError && err.code === 'conflict')
    return new SaveError(err.message, 'conflict');
  if (isOffline(err)) {
    return new SaveError(
      'You’re offline, so this change couldn’t be saved. Try again when you’re back online.',
      'offline',
    );
  }
  return new SaveError(
    "Couldn't save your change. Check your internet connection and try again.",
    'failed',
  );
}

/**
 * Apply a change and save it to Drive.
 *
 * - The change shows immediately (optimistic), and is rolled back if saving fails.
 * - Saves run one at a time (`scope`), each building on what the previous one wrote.
 * - Only the files the change touches are written (ADR-0014); a file another device changed is
 *   never overwritten.
 */
export function useUpdateDataFile() {
  const queryClient = useQueryClient();
  const store = useDataStore();

  return useMutation({
    mutationKey: SAVE_MUTATION_KEY,
    scope: { id: 'data-file' },
    networkMode: 'always',
    mutationFn: async (change: DataChange): Promise<DataFile> => {
      const before = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY);
      if (!before)
        throw new SaveError('Your data is still loading. Try again in a moment.', 'failed');

      const now = new Date();
      // Throws on an invalid change, before anything is shown or saved.
      const next = dataFileSchema.parse({
        ...change(before.data, { now, newId }),
        updatedAt: now.toISOString(),
      });

      queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, { ...before, data: next });
      try {
        const snapshot = await store.save(before.snapshot, next);
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, {
          data: next,
          snapshot,
          offline: false,
        });
        await workspace.saveSynced({ data: next, snapshot });
        return next;
      } catch (err) {
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, before);
        throw toSaveError(err);
      }
    },
  });
}
