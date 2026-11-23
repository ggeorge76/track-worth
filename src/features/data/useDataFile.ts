import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ChangeOptions } from '@/domain/accounts';
import { newId } from '@/domain/ids';
import { dataFileSchema, type DataFile } from '@/domain/schema';
import { useAuth } from '@/features/auth/authContext';
import { fileCache } from '@/services/cache/fileCache';
import { createDriveClient, DriveError } from '@/services/drive/driveClient';
import { createDataStore, StoreError, type StoreSnapshot } from '@/services/storage/dataStore';

export const DATA_FILE_KEY = ['data-file'] as const;
export const SAVE_MUTATION_KEY = ['save-data-file'] as const;

export interface LoadedDataFile {
  data: DataFile;
  /** What this device last read from or wrote to Drive (ADR-0014). */
  snapshot: StoreSnapshot;
}

/** A pure change to the data, e.g. `(data, opts) => upsertBalance(data, input, opts)`. */
export type DataChange = (data: DataFile, options: ChangeOptions) => DataFile;

export class SaveError extends Error {
  constructor(
    message: string,
    readonly code: 'conflict' | 'failed',
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

/** Loads the data from Drive (only changed files are downloaded), upgrading old formats. */
export function useDataFile() {
  const store = useDataStore();
  return useQuery({
    queryKey: DATA_FILE_KEY,
    queryFn: async (): Promise<LoadedDataFile> => {
      try {
        const { data, snapshot } = await store.load();
        return { data, snapshot };
      } catch (err) {
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
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, { data: next, snapshot });
        return next;
      } catch (err) {
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, before);
        throw toSaveError(err);
      }
    },
  });
}
