import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { ChangeOptions } from '@/domain/accounts';
import { newId } from '@/domain/ids';
import { dataFileSchema, type DataFile } from '@/domain/schema';
import type { Choices } from '@/domain/sync/merge';
import { useAuth } from '@/features/auth/authContext';
import { fileCache } from '@/services/cache/fileCache';
import { workspace } from '@/services/cache/workspace';
import { createDriveClient, DriveError } from '@/services/drive/driveClient';
import { createDataStore, StoreError } from '@/services/storage/dataStore';
import { createSyncEngine, type SyncState } from '@/services/sync/syncEngine';

export const DATA_FILE_KEY = ['data-file'] as const;
export const SAVE_MUTATION_KEY = ['save-data-file'] as const;

/**
 * The data as the app shows it, plus its sync status (ADR-0015): changes waiting to upload,
 * offline, a decision needed, or an upload error being retried.
 */
export type LoadedDataFile = SyncState;

/** How often to try again while offline or while changes are waiting. */
export const OFFLINE_RETRY_MS = 30_000;

/** A pure change to the data, e.g. `(data, opts) => upsertBalance(data, input, opts)`. */
export type DataChange = (data: DataFile, options: ChangeOptions) => DataFile;

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

function useSyncEngine() {
  const { getAccessToken } = useAuth();
  return useMemo(
    () =>
      createSyncEngine({
        store: createDataStore({ drive: createDriveClient({ getAccessToken }), cache: fileCache }),
        workspace,
      }),
    [getAccessToken],
  );
}

function loadError(err: unknown): unknown {
  if (err instanceof DriveError && err.code === 'offline') {
    return new Error(
      'You’re offline, and this device doesn’t have a copy of your data yet. Connect to the internet, then reload.',
      { cause: err },
    );
  }
  if (err instanceof StoreError) return new Error(err.message, { cause: err });
  if (err instanceof DriveError && err.code === 'http') {
    return new Error(
      'Couldn’t load your data from Google Drive. Check your internet connection, then reload.',
      {
        cause: err,
      },
    );
  }
  return err;
}

const needsRetry = (state: LoadedDataFile | undefined) =>
  !!state && !state.decision && (state.offline || state.pending > 0 || !!state.uploadError);

/**
 * Loads the data: uploads changes waiting from before, otherwise reads Drive (only changed files
 * are downloaded). Offline it shows this device's copy. Retries when the connection returns and
 * every 30 seconds while offline or while changes are waiting (ADR-0015).
 */
export function useDataFile() {
  const engine = useSyncEngine();
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
    refetchInterval: (query) => (needsRetry(query.state.data) ? OFFLINE_RETRY_MS : false),
    queryFn: async (): Promise<LoadedDataFile> => {
      // A save in progress owns the sync; don't race it.
      const current = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY);
      if (current && queryClient.isMutating({ mutationKey: SAVE_MUTATION_KEY }) > 0) return current;
      try {
        return await engine.load();
      } catch (err) {
        throw loadError(err);
      }
    },
  });
}

/** Run a sync step against the current state, one at a time with other saves. */
async function step(
  queryClient: QueryClient,
  run: (current: LoadedDataFile) => Promise<LoadedDataFile>,
  optimistic?: (current: LoadedDataFile) => LoadedDataFile,
): Promise<LoadedDataFile> {
  // A background load could otherwise overwrite this step's result when it finishes.
  await queryClient.cancelQueries({ queryKey: DATA_FILE_KEY });
  const current = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY);
  if (!current) throw new SaveError('Your data is still loading. Try again in a moment.');
  if (optimistic) queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, optimistic(current));
  try {
    const next = await run(current);
    queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, next);
    return next;
  } catch (err) {
    queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, current);
    throw err instanceof SaveError
      ? err
      : new SaveError("Couldn't save your change on this device. Please try again.");
  }
}

/**
 * Apply a change. It's saved on this device first (so it survives offline use and restarts), then
 * uploaded; if Drive changed meanwhile it's merged, or a decision is requested (ADR-0015).
 */
export function useUpdateDataFile() {
  const queryClient = useQueryClient();
  const engine = useSyncEngine();

  return useMutation({
    mutationKey: SAVE_MUTATION_KEY,
    scope: { id: 'data-file' },
    networkMode: 'always',
    mutationFn: async (change: DataChange): Promise<DataFile> => {
      const current = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY);
      if (!current) throw new SaveError('Your data is still loading. Try again in a moment.');
      const now = new Date();
      // Throws on an invalid change, before anything is shown or saved.
      const next = dataFileSchema.parse({
        ...change(current.data, { now, newId }),
        updatedAt: now.toISOString(),
      });
      await step(
        queryClient,
        (state) => engine.commit(state, next),
        (state) => ({ ...state, data: next, pending: state.pending + 1 }),
      );
      return next;
    },
  });
}

/** Answer the "keep this device's / keep Drive's" questions and upload (ADR-0015). */
export function useResolveSync() {
  const queryClient = useQueryClient();
  const engine = useSyncEngine();
  return useMutation({
    mutationKey: SAVE_MUTATION_KEY,
    scope: { id: 'data-file' },
    networkMode: 'always',
    mutationFn: (choices: Choices) => step(queryClient, (state) => engine.resolve(state, choices)),
  });
}
