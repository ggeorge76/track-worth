import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ChangeOptions } from '@/domain/accounts';
import { newId } from '@/domain/ids';
import { createEmptyDataFile, dataFileSchema, parseDataFile, type DataFile } from '@/domain/schema';
import { useAuth } from '@/features/auth/authContext';
import { createDriveClient, DriveError } from '@/services/drive/driveClient';

export const DATA_FILE_KEY = ['data-file'] as const;
export const SAVE_MUTATION_KEY = ['save-data-file'] as const;

const DEFAULT_CURRENCY = 'USD';

export interface LoadedDataFile {
  fileId: string;
  /** Drive `version` of the file as last read or written (ADR-0005 optimistic concurrency). */
  version: string;
  data: DataFile;
}

/** A pure change to the data file, e.g. `(data, opts) => upsertBalance(data, input, opts)`. */
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

function useDriveClient() {
  const { getAccessToken } = useAuth();
  return useMemo(() => createDriveClient({ getAccessToken }), [getAccessToken]);
}

/** Loads (or creates on first run) the user's data file from Drive, migrating old versions. */
export function useDataFile() {
  const drive = useDriveClient();
  return useQuery({
    queryKey: DATA_FILE_KEY,
    queryFn: async (): Promise<LoadedDataFile> => {
      const file = await drive.loadOrCreate(() => createEmptyDataFile(DEFAULT_CURRENCY));
      const parsed = parseDataFile(file.content);
      if (!parsed.ok) {
        throw new Error(
          parsed.reason === 'newer-version'
            ? 'Your data was saved by a newer version of TrackWorth. Please update the app.'
            : `Your data file couldn't be read: ${parsed.message}`,
        );
      }
      // A migrated file is written in the new format on the next save.
      return { fileId: file.fileId, version: file.version, data: parsed.data };
    },
  });
}

function toSaveError(err: unknown): SaveError {
  if (err instanceof DriveError && err.code === 'conflict') {
    return new SaveError(
      "Couldn't save. Your data was changed on another device. Reload to see the latest.",
      'conflict',
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
 * - Saves run one at a time (`scope`), so each uses the version written by the previous one.
 * - If another device saved first, Drive's version no longer matches and the save is refused
 *   with a `conflict` error. We never overwrite (ADR-0005).
 */
export function useUpdateDataFile() {
  const queryClient = useQueryClient();
  const drive = useDriveClient();

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
        const version = await drive.save(before.fileId, next, before.version);
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, { ...before, data: next, version });
        return next;
      } catch (err) {
        queryClient.setQueryData<LoadedDataFile>(DATA_FILE_KEY, before);
        throw toSaveError(err);
      }
    },
  });
}
