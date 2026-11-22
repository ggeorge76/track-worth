import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import v1Fixture from '@/domain/__fixtures__/data-file-v1.json';
import { createAccount } from '@/domain/accounts';
import { AuthContext, type AuthContextValue } from '@/features/auth/authContext';
import type * as driveModule from '@/services/drive/driveClient';
import { DriveError, type DriveClient } from '@/services/drive/driveClient';
import { makeFile } from '@/test/builders';
import { SaveStatus } from './SaveStatus';
import { useDataFile, useUpdateDataFile, type DataChange } from './useDataFile';

const drive = vi.hoisted(() => ({
  loadOrCreate: vi.fn<DriveClient['loadOrCreate']>(),
  save: vi.fn<DriveClient['save']>(),
}));
vi.mock('@/services/drive/driveClient', async (importOriginal) => ({
  ...(await importOriginal<typeof driveModule>()),
  createDriveClient: () => drive,
}));

const auth: AuthContextValue = {
  state: { status: 'signed-in', user: { name: 'Test', email: 't@example.com' } },
  signIn: vi.fn(),
  signOut: vi.fn(),
  getAccessToken: () => Promise.resolve('token'),
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext value={auth}>{children}</AuthContext>
    </QueryClientProvider>
  );
  const hook = renderHook(() => ({ file: useDataFile(), update: useUpdateDataFile() }), {
    wrapper,
  });
  return { client, wrapper, hook };
}

const addAccount =
  (name: string): DataChange =>
  (data, opts) =>
    createAccount(data, { name, kind: 'asset', tag: 'Cash', liquidity: 3, currency: 'USD' }, opts)
      .data;

beforeEach(() => {
  drive.loadOrCreate.mockResolvedValue({ fileId: 'f1', version: '1', content: makeFile() });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useDataFile', () => {
  it('loads and migrates an old file', async () => {
    drive.loadOrCreate.mockResolvedValue({ fileId: 'f1', version: '3', content: v1Fixture });
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data?.data.schemaVersion).toBe(2);
    });
    expect(hook.result.current.file.data?.data.accounts[1]?.tag).toBe('Debt');
  });

  it('refuses files from a newer app version', async () => {
    drive.loadOrCreate.mockResolvedValue({
      fileId: 'f1',
      version: '1',
      content: { schemaVersion: 99 },
    });
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.error?.message).toMatch(/newer version/);
    });
  });
});

describe('useUpdateDataFile', () => {
  it('shows the change immediately and saves it with the version it was based on', async () => {
    let finishSave: (version: string) => void = () => undefined;
    drive.save.mockImplementation(() => new Promise((resolve) => (finishSave = resolve)));
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });

    act(() => {
      hook.result.current.update.mutate(addAccount('Savings'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual(['Savings']);
    });
    expect(drive.save).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({ schemaVersion: 2 }),
      '1',
    );

    act(() => {
      finishSave('2');
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.version).toBe('2');
    });
  });

  it('runs saves one at a time, each on top of the previous version', async () => {
    drive.save.mockResolvedValueOnce('2').mockResolvedValueOnce('3');
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });

    await act(async () => {
      await Promise.all([
        hook.result.current.update.mutateAsync(addAccount('A')),
        hook.result.current.update.mutateAsync(addAccount('B')),
      ]);
    });

    expect(drive.save.mock.calls.map((c) => c[2])).toEqual(['1', '2']);
    // Cache updates reach React asynchronously.
    await waitFor(() => {
      expect(hook.result.current.file.data?.version).toBe('3');
    });
    expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual(['A', 'B']);
  });

  it('rolls back and offers a reload when another device saved first', async () => {
    drive.save.mockRejectedValue(new DriveError('changed elsewhere', 'conflict'));
    const { hook, wrapper } = setup();
    render(<SaveStatus />, { wrapper });
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });

    await act(async () => {
      await hook.result.current.update.mutateAsync(addAccount('A')).catch(() => undefined);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('changed on another device');
    expect(hook.result.current.file.data?.data.accounts).toEqual([]);

    drive.loadOrCreate.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(drive.loadOrCreate).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects an invalid change without saving or showing it', async () => {
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });
    await act(async () => {
      await expect(hook.result.current.update.mutateAsync(addAccount('   '))).rejects.toThrow();
    });
    expect(drive.save).not.toHaveBeenCalled();
    expect(hook.result.current.file.data?.data.accounts).toEqual([]);
    expect(hook.result.current.file.data?.version).toBe('1');
  });
});
