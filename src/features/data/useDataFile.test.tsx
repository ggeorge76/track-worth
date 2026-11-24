import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createAccount, updateAccount } from '@/domain/accounts';
import type { DataFile } from '@/domain/schema';
import { AuthContext, type AuthContextValue } from '@/features/auth/authContext';
import { UserMenu } from '@/features/auth/UserMenu';
import { workspace } from '@/services/cache/workspace';
import { DriveError } from '@/services/drive/driveClient';
import { StoreError, type StoreSnapshot } from '@/services/storage/dataStore';
import { makeAccount, makeFile } from '@/test/builders';
import { emptySnapshot, fakeStore } from '@/test/mockStore';
import { SaveStatus } from './SaveStatus';
import { SyncStatus } from './SyncStatus';
import { useDataFile, useUpdateDataFile, type DataChange } from './useDataFile';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

const signOut = vi.fn(() => Promise.resolve());
const auth: AuthContextValue = {
  state: { status: 'signed-in', user: { name: 'Test', email: 't@example.com' } },
  signIn: vi.fn(),
  signOut,
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
const offlineError = () => new DriveError('Google Drive can’t be reached', 'offline');
const conflictError = () => new StoreError('Changed elsewhere', 'conflict');
const withBank = makeFile({ accounts: [makeAccount({ id: 'bank', name: 'Bank' })] });

const addAccount =
  (name: string): DataChange =>
  (data, opts) =>
    createAccount(data, { name, kind: 'asset', tag: 'Cash', liquidity: 3, currency: 'USD' }, opts)
      .data;
const rename =
  (name: string): DataChange =>
  (data) =>
    updateAccount(data, 'bank', { name });

async function loaded(file: DataFile = makeFile()) {
  fakeStore.load.mockResolvedValue({ data: file, snapshot: snapshot('s0') });
  const env = setup();
  await waitFor(() => {
    expect(env.hook.result.current.file.data).toBeDefined();
  });
  return env;
}

beforeEach(() => {
  fakeStore.save.mockImplementation((snap) => Promise.resolve(snap));
});
afterEach(async () => {
  vi.clearAllMocks();
  fakeStore.load.mockReset();
  fakeStore.save.mockReset();
  await workspace.clear();
});

describe('loading', () => {
  it('loads data from the store and remembers it as synced', async () => {
    const { hook } = await loaded();
    expect(hook.result.current.file.data).toMatchObject({ pending: 0, offline: false });
    expect(hook.result.current.file.data?.synced.snapshot.rootId).toBe('s0');
    expect((await workspace.loadSynced())?.snapshot.rootId).toBe('s0');
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

  it('shows the device copy when offline, and goes back online by itself', async () => {
    (await loaded()).hook.unmount();
    fakeStore.load.mockRejectedValue(offlineError());
    const { hook, wrapper } = setup();
    render(<SyncStatus />, { wrapper });
    await waitFor(() => {
      expect(hook.result.current.file.data?.offline).toBe(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Offline');

    fakeStore.load.mockResolvedValue({ data: makeFile(), snapshot: snapshot('s1') });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.offline).toBe(false);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains when there is no copy on this device yet', async () => {
    fakeStore.load.mockRejectedValue(offlineError());
    const { hook } = setup();
    await waitFor(() => {
      expect(hook.result.current.file.error?.message).toMatch(
        /doesn’t have a copy of your data yet/,
      );
    });
  });
});

describe('saving online', () => {
  it('shows the change immediately and uploads it from the synced snapshot', async () => {
    fakeStore.save.mockResolvedValue(snapshot('s1'));
    const { hook } = await loaded();
    await act(async () => {
      await hook.result.current.update.mutateAsync(addAccount('Savings'));
    });
    expect(fakeStore.save).toHaveBeenCalledWith(
      snapshot('s0'),
      expect.objectContaining({ schemaVersion: 4 }),
    );
    await waitFor(() => {
      expect(hook.result.current.file.data?.synced.snapshot.rootId).toBe('s1');
    });
    expect(hook.result.current.file.data).toMatchObject({ pending: 0 });
    expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual(['Savings']);
  });

  it('runs saves one at a time, each from the snapshot the previous one returned', async () => {
    fakeStore.save.mockResolvedValueOnce(snapshot('s1')).mockResolvedValueOnce(snapshot('s2'));
    const { hook } = await loaded();
    await act(async () => {
      await Promise.all([
        hook.result.current.update.mutateAsync(addAccount('A')),
        hook.result.current.update.mutateAsync(addAccount('B')),
      ]);
    });
    expect(fakeStore.save.mock.calls.map((c) => c[0].rootId)).toEqual(['s0', 's1']);
    await waitFor(() => {
      expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual(['A', 'B']);
    });
  });

  it('rejects an invalid change without saving or showing it', async () => {
    const { hook } = await loaded();
    await act(async () => {
      await expect(hook.result.current.update.mutateAsync(addAccount('   '))).rejects.toThrow();
    });
    expect(fakeStore.save).not.toHaveBeenCalled();
    expect(hook.result.current.file.data?.data.accounts).toEqual([]);
  });
});

describe('editing offline (ADR-0015)', () => {
  it('keeps the change on the device, says it’s waiting, and uploads when back online', async () => {
    const { hook, wrapper } = await loaded();
    render(
      <>
        <SyncStatus />
        <SaveStatus />
      </>,
      { wrapper },
    );
    fakeStore.save.mockRejectedValue(offlineError());
    await act(async () => {
      await hook.result.current.update.mutateAsync(addAccount('Offline account'));
    });
    // Cache updates reach React asynchronously.
    await waitFor(() => {
      expect(hook.result.current.file.data).toMatchObject({ pending: 1, offline: true });
    });
    expect(hook.result.current.file.data?.data.accounts.map((a) => a.name)).toEqual([
      'Offline account',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 change saved on this device, waiting to upload',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // not an error
    expect((await workspace.loadPending())?.count).toBe(1);

    fakeStore.save.mockResolvedValue(snapshot('s1'));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data).toMatchObject({ pending: 0, offline: false });
    });
    expect(fakeStore.save).toHaveBeenLastCalledWith(
      snapshot('s0'),
      expect.objectContaining({ accounts: [expect.objectContaining({ name: 'Offline account' })] }),
    );
    expect(await workspace.loadPending()).toBeUndefined();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('asks which version to keep when an account changed on both sides', async () => {
    const user = userEvent.setup();
    const { hook, wrapper } = await loaded(withBank);
    render(<SyncStatus />, { wrapper });

    // This device renames the account while Drive has it renamed differently.
    fakeStore.save.mockRejectedValueOnce(conflictError());
    fakeStore.load.mockResolvedValue({
      data: updateAccount(withBank, 'bank', { name: 'Bank (phone)' }),
      snapshot: snapshot('s9'),
    });
    await act(async () => {
      await hook.result.current.update.mutateAsync(rename('Bank (laptop)'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.decision?.questions).toHaveLength(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Needs your decision');

    await user.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose what to keep' });
    expect(
      within(dialog).getByRole('row', { name: /Name Bank \(laptop\) Bank \(phone\)/ }),
    ).toBeInTheDocument();
    const apply = within(dialog).getByRole('button', { name: 'Apply and upload' });
    expect(apply).toBeDisabled();

    fakeStore.save.mockResolvedValue(snapshot('s10'));
    await user.click(within(dialog).getByRole('radio', { name: 'Keep Google Drive’s' }));
    await user.click(apply);
    await waitFor(() => {
      expect(hook.result.current.file.data?.decision).toBeUndefined();
    });
    expect(fakeStore.save).toHaveBeenLastCalledWith(
      snapshot('s9'),
      expect.objectContaining({ accounts: [expect.objectContaining({ name: 'Bank (phone)' })] }),
    );
    expect(hook.result.current.file.data?.pending).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('warns before signing out with changes still waiting', async () => {
    const user = userEvent.setup();
    const { hook, wrapper } = await loaded();
    render(<UserMenu user={{ name: 'Test User', email: 't@example.com' }} />, { wrapper });
    fakeStore.save.mockRejectedValue(offlineError());
    await act(async () => {
      await hook.result.current.update.mutateAsync(addAccount('Unsent'));
    });
    await waitFor(() => {
      expect(hook.result.current.file.data?.pending).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: /Test User/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out and lose changes?' });
    expect(dialog).toHaveTextContent('1 change hasn’t been uploaded');
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    expect(signOut).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Test User/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await user.click(screen.getByRole('button', { name: 'Sign out anyway' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('signs out straight away when everything is uploaded', async () => {
    const user = userEvent.setup();
    const { wrapper } = await loaded();
    render(<UserMenu user={{ name: 'Test User', email: 't@example.com' }} />, { wrapper });
    await user.click(screen.getByRole('button', { name: /Test User/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
