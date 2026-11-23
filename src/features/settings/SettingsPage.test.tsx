import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import type * as exportModule from '@/services/export/saveExport';
import { ExportError, saveExport } from '@/services/export/saveExport';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);
vi.mock('@/services/export/saveExport', async (importOriginal) => ({
  ...(await importOriginal<typeof exportModule>()),
  saveExport: vi.fn(),
}));

describe('SettingsPage', () => {
  it('changes the financial year start month', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/settings');
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, makeFile());
    const select = screen.getByLabelText('Financial year starts in');
    expect(select).toHaveValue('4');
    await user.selectOptions(select, '1');
    await waitFor(() => {
      expect(dataIn(client)?.settings.financialYearStartMonth).toBe(1);
    });
    expect(screen.getByText(/Current financial year: .*Jan.*Dec/)).toBeInTheDocument();
  });
});

describe('Export', () => {
  const data = makeFile({
    accounts: [makeAccount({ id: 'a', name: 'Bank' })],
    balances: [makeEntry({ accountId: 'a', date: '2026-03-01', amountMinor: 1050 })],
  });

  function open() {
    window.history.replaceState({ idx: 1 }, '', '#/settings');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    return user;
  }

  afterEach(() => {
    vi.mocked(saveExport).mockReset();
  });

  it('saves the balances as CSV and says so', async () => {
    vi.mocked(saveExport).mockResolvedValue('saved');
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Balances for a spreadsheet (CSV)' }));
    const [fileName, contents] = vi.mocked(saveExport).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^trackworth-balances-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(contents).toContain('2026-03-01,Bank,Asset,Cash,USD,10.50,');
    expect(await screen.findByRole('status')).toHaveTextContent(`Saved ${fileName ?? ''}.`);
  });

  it('saves everything as JSON', async () => {
    vi.mocked(saveExport).mockResolvedValue('saved');
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Everything (JSON)' }));
    const [fileName, contents = ''] = vi.mocked(saveExport).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^trackworth-backup-.*\.json$/);
    expect(JSON.parse(contents)).toMatchObject({ schemaVersion: 3, accounts: [{ name: 'Bank' }] });
  });

  it('says nothing when the save dialog is cancelled', async () => {
    vi.mocked(saveExport).mockResolvedValue('cancelled');
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Everything (JSON)' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Everything (JSON)' })).toBeEnabled();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error when saving fails', async () => {
    vi.mocked(saveExport).mockRejectedValue(new ExportError('Couldn’t save the file there.'));
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Everything (JSON)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save the file there.');
  });
});
