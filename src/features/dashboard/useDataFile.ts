import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createEmptyDataFile, parseDataFile } from '@/domain/schema';
import { createDriveClient } from '@/services/drive/driveClient';
import { useAuth } from '@/features/auth/authContext';

const DEFAULT_CURRENCY = 'USD';

/** Loads (or creates on first run) the user's data file from Drive. */
export function useDataFile() {
  const { getAccessToken } = useAuth();
  const drive = useMemo(() => createDriveClient({ getAccessToken }), [getAccessToken]);

  return useQuery({
    queryKey: ['data-file'],
    queryFn: async () => {
      const file = await drive.loadOrCreate(() => createEmptyDataFile(DEFAULT_CURRENCY));
      const parsed = parseDataFile(file.content);
      if (!parsed.ok) {
        throw new Error(
          parsed.reason === 'newer-version'
            ? 'Your data was saved by a newer version of TrackWorth. Please update the app.'
            : `Your data file is not valid: ${parsed.message}`,
        );
      }
      return { fileId: file.fileId, version: file.version, data: parsed.data };
    },
  });
}
