import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createAccount } from '@/domain/accounts';
import { AuthContext, type AuthContextValue } from '@/features/auth/authContext';
import { StoreError, type StoreSnapshot } from '@/services/storage/dataStore';
import { makeFile } from '@/test/builders';
import { emptySnapshot, fakeStore } from '@/test/mockStore';
import { SaveStatus } from './SaveStatus';
import { useDataFile, useUpdateDataFile, type DataChange } from './useDataFile';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

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

const snapshot = (tag: string): StoreSnapshot => ({ ...emptySnapshot, rootId: tag });

const addAccount =
  (name: string): DataChange =>
  (data, opts) =>
    createAccount(data, { name, kind: 'asset', tag: 'Cash', liquidity: 3, currency: 'USD' }, opts)
      .data;

beforeEach(() => {
  fakeStore.load.mockResolvedValue({ data: makeFile(), snapshot: snapshot('s0') });
  fakeStore.save.mockImplementation((snap) => Promise.resolve(snap));
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useDataFile', () => {
  it('loads data from the store', async () => {
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data?.snapshot.rootId).toBe('s0');
    });
  });

  it('shows the store’s plain-language message when loading fails', async () => {
    fakeStore.load.mockRejectedValue(
      new StoreError('Your data was saved by a newer version of TrackWorth.', 'newer-version'),
    );
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.error?.message).toMatch(/newer version/);
    });
  });
});

describe('useUpdateDataFile', () => {
  it('shows the change immediately and keeps the snapshot the store returns', async () => {
    let finish: (s: StoreSnapshot) => void = () => undefined;
    fakeStore.save.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
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
    expect(fakeStore.save).toHaveBeenCalledWith(
      snapshot('s0'),
      expect.objectContaining({ schemaVersion: 3 }),
    );

    act(() => {
      finish(snapshot('s1'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.snapshot.rootId).toBe('s1');
    });
  });

  it('runs saves one at a time, each from the snapshot the previous one returned', async () => {
    fakeStore.save.mockResolvedValueOnce(snapshot('s1')).mockResolvedValueOnce(snapshot('s2'));
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

    expect(fakeStore.save.mock.calls.map((c) => c[0].rootId)).toEqual(['s0', 's1']);
    await waitFor(() => {
      expect(hook.result.current.file.data?.snapshot.rootId).toBe('s2');
    });
    expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual(['A', 'B']);
  });

  it('rolls back and offers a reload when another device changed the data', async () => {
    fakeStore.save.mockRejectedValue(
      new StoreError(
        'Couldn’t save. Your data was changed on another device. Reload to see the latest.',
        'conflict',
      ),
    );
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

    fakeStore.load.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(fakeStore.load).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains other save failures without offering a reload', async () => {
    fakeStore.save.mockRejectedValue(new Error('network down'));
    const { hook, wrapper } = setup();
    render(<SaveStatus />, { wrapper });
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });
    await act(async () => {
      await hook.result.current.update.mutateAsync(addAccount('A')).catch(() => undefined);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your internet connection');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('rejects an invalid change without saving or showing it', async () => {
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.data).toBeDefined();
    });
    await act(async () => {
      await expect(hook.result.current.update.mutateAsync(addAccount('   '))).rejects.toThrow();
    });
    expect(fakeStore.save).not.toHaveBeenCalled();
    expect(hook.result.current.file.data?.data.accounts).toEqual([]);
  });
});
