import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import type * as driveModule from '@/services/drive/driveClient';
import type { DriveClient } from '@/services/drive/driveClient';
import { makeAccount, makeFile } from '@/test/builders';
import { dataIn, renderWithData } from '@/test/renderWithData';

const drive = vi.hoisted(() => ({
  loadOrCreate: vi.fn<DriveClient['loadOrCreate']>(),
  save: vi.fn<DriveClient['save']>(() => Promise.resolve('2')),
}));
vi.mock('@/services/drive/driveClient', async (importOriginal) => ({
  ...(await importOriginal<typeof driveModule>()),
  createDriveClient: () => drive,
}));

const file = makeFile({
  accounts: [makeAccount({ id: 'old', currency: 'INR', balanceSource: 'HDFC NetBanking' })],
});

beforeEach(() => {
  window.history.replaceState(null, '', '#/accounts/new');
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('NewAccountPage', () => {
  it('asks for a name and a tag before saving', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Give the account a name.')).toBeInTheDocument();
    expect(screen.getByText('Pick a tag, or add a new one.')).toBeInTheDocument();
    expect(drive.save).not.toHaveBeenCalled();
  });

  it('creates an account and opens it', async () => {
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, file);

    await user.type(screen.getByLabelText('Name'), '🏠 Home loan');
    await user.click(screen.getByRole('radio', { name: 'Liability' }));
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Tag' })).getByRole('button', {
        name: 'Real Assets',
      }),
    );
    await user.click(screen.getByRole('radio', { name: 'Liquidity 1: Very low' }));
    expect(screen.getByText('Liquidity: Very low')).toBeInTheDocument();
    // Defaults to the currency already used by other accounts.
    expect(screen.getByLabelText('Currency')).toHaveValue('INR');
    await user.type(screen.getByLabelText('Balance source (optional)'), 'HDFC NetBanking');
    await user.type(screen.getByLabelText('Notes (optional)'), '20-year term');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: '🏠 Home loan' })).toBeInTheDocument();
    expect(drive.save).toHaveBeenCalledOnce();
    const created = dataIn(client)?.accounts.find((a) => a.name === '🏠 Home loan');
    expect(created).toMatchObject({
      kind: 'liability',
      tag: 'Real Assets',
      liquidity: 1,
      currency: 'INR',
      balanceSource: 'HDFC NetBanking',
      note: '20-year term',
    });
    expect(window.location.hash).toBe(`#/accounts/${created?.id ?? ''}`);
  });

  it('adds a custom tag with emoji', async () => {
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, file);
    await user.type(screen.getByLabelText('Name'), 'Gold coins');
    await user.click(screen.getByRole('button', { name: /New tag/ }));
    await user.type(screen.getByLabelText('New tag'), '🪙 Gold{Enter}');
    expect(screen.getByRole('button', { name: '🪙 Gold' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(dataIn(client)?.settings.customTags).toEqual(['🪙 Gold']);
    });
  });

  it('suggests balance sources used before', () => {
    renderWithData(<Routes />, file);
    const input = screen.getByLabelText('Balance source (optional)');
    const list = document.getElementById(input.getAttribute('list') ?? '');
    expect([...(list?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual([
      'HDFC NetBanking',
    ]);
  });

  it('stays on the form if saving fails', async () => {
    drive.save.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.type(screen.getByLabelText('Name'), 'Wallet');
    await user.click(screen.getByRole('button', { name: 'Cash' }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(drive.save).toHaveBeenCalled();
    });
    expect(window.location.hash).toBe('#/accounts/new');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });
});
