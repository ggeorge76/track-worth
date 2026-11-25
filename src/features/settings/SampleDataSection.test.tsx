import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { sampleDataFile } from '@/domain/sampleData';
import type { DataFile } from '@/domain/schema';
import type { BackupInfo } from '@/services/storage/sampleBackup';
import { makeAccount, makeFile } from '@/test/builders';
import { fakeStore } from '@/test/mockStore';
import { dataIn, renderWithData } from '@/test/renderWithData';

vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);
vi.mock('@/services/export/saveExport', () => ({
  saveExport: vi.fn(() => Promise.resolve('saved')),
}));

// The Drive backups, in memory. `steps` records the order, to check that the real data is
// backed up before anything is replaced and removed only after the restore.
const steps: string[] = [];
const stored = new Map<string, { info: BackupInfo; data: DataFile }>();
let seq = 0;
vi.mock('@/services/storage/sampleBackup', () => ({
  SAMPLE_BACKUP_FOLDER: 'sample-backups',
  createSampleBackups: () => ({
    list: () => Promise.resolve([...stored.values()].map((b) => b.info)),
    save: (_root: string, data: DataFile) => {
      seq += 1;
      const info = {
        id: `b${String(seq)}`,
        name: `backup-${String(seq)}.json`,
        takenAt: `2026-11-26T1${String(seq)}:00:00.000Z`,
      };
      stored.set(info.id, { info, data: structuredClone(data) });
      steps.push(`backup ${data.accounts.map((a) => a.name).join(',')}`);
      return Promise.resolve(info);
    },
    load: (id: string) => Promise.resolve(stored.get(id)?.data),
    remove: (id: string) => {
      stored.delete(id);
      steps.push(`remove ${id}`);
      return Promise.resolve();
    },
  }),
}));

const real = makeFile({
  baseCurrency: 'USD',
  accounts: [makeAccount({ id: 'mine', name: 'Mine' })],
});

function open(file: DataFile = real) {
  window.history.replaceState({ idx: 1 }, '', '#/settings');
  const user = userEvent.setup();
  return { user, ...renderWithData(<Routes />, file) };
}

afterEach(() => {
  steps.splice(0);
  stored.clear();
});

describe('SampleDataSection (development builds)', () => {
  it('backs up first, shows the sample, then restores, checks, and removes that backup', async () => {
    const { user, client } = open();
    await user.click(await screen.findByRole('button', { name: 'Load sample data' }));
    await user.click(screen.getByRole('button', { name: 'Back up and show sample data' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts).toHaveLength(10);
    });
    expect(steps).toEqual(['backup Mine']);

    await user.click(await screen.findByRole('button', { name: 'Restore my data' }));
    await waitFor(() => {
      expect(steps).toEqual(['backup Mine', 'remove b1']);
    });
    expect(dataIn(client)?.accounts.map((a) => a.name)).toEqual(['Mine']);
    expect(dataIn(client)?.baseCurrency).toBe('USD');
    expect(await screen.findByRole('status')).toHaveTextContent('Your data is back');
  });

  it('keeps the backup if the restored data couldn’t be uploaded', async () => {
    stored.set('b9', {
      info: { id: 'b9', name: 'backup-9.json', takenAt: '2026-11-26T09:00:00.000Z' },
      data: real,
    });
    const { user } = open(sampleDataFile('2026-11-26', makeFile()));
    fakeStore.save.mockRejectedValueOnce(
      new (await import('@/services/drive/driveClient')).DriveError('offline', 'offline'),
    );
    await user.click(await screen.findByRole('button', { name: 'Restore my data' }));
    expect(await screen.findByRole('status')).toHaveTextContent('backup was kept');
    expect(stored.has('b9')).toBe(true);
  });

  it('never offers a leftover backup over real data; it can be saved or removed', async () => {
    stored.set('b7', {
      info: { id: 'b7', name: 'backup-7.json', takenAt: '2026-11-20T07:00:00.000Z' },
      data: real,
    });
    const { user } = open();
    expect(await screen.findByText(/1 old backup/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore my data' })).not.toBeInTheDocument();
    // Loading again is still possible: backups never block.
    expect(screen.getByRole('button', { name: 'Load sample data' })).toBeEnabled();

    const list = screen.getByText(/1 old backup/).parentElement as HTMLElement;
    await user.click(
      within(list).getByRole('button', { name: /Save backup from .* to this device/ }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Backup saved to this device.');
    await user.click(within(list).getByRole('button', { name: /Remove backup from/ }));
    await waitFor(() => {
      expect(stored.size).toBe(0);
    });
  });

  it('warns when sample data shows but no backup exists', async () => {
    open(sampleDataFile('2026-11-26', makeFile()));
    expect(await screen.findByRole('alert')).toHaveTextContent('no backup was found');
  });

  it('can be cancelled', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Load sample data' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(steps).toEqual([]);
  });
});
