import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { DataFile } from '@/domain/schema';
import { AuthContext, type AuthContextValue } from '@/features/auth/authContext';
import { DATA_FILE_KEY, type LoadedDataFile } from '@/features/data/useDataFile';

const signedIn: AuthContextValue = {
  state: { status: 'signed-in', user: { name: 'Test User', email: 'test@example.com' } },
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  getAccessToken: () => Promise.resolve('token'),
};

/**
 * Render signed-in UI with `file` already loaded, as if from Drive. Saving still goes through
 * the Drive client, so tests that save must mock '@/services/drive/driveClient'.
 */
export function renderWithData(ui: ReactElement, file: DataFile) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData<LoadedDataFile>(DATA_FILE_KEY, { fileId: 'f1', version: '1', data: file });
  const utils = render(
    <QueryClientProvider client={client}>
      <AuthContext value={signedIn}>{ui}</AuthContext>
    </QueryClientProvider>,
  );
  return { client, ...utils };
}

export function dataIn(client: QueryClient): DataFile | undefined {
  return client.getQueryData<LoadedDataFile>(DATA_FILE_KEY)?.data;
}
