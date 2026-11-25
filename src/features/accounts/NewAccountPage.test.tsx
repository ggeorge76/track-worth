import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { localIsoDate } from '@/domain/dates';
import { makeAccount, makeFile } from '@/test/builders';
import { DATA_FILE_KEY, type LoadedDataFile } from '@/features/data/useDataFile';
import { DriveError } from '@/services/drive/driveClient';
import { fakeStore } from '@/test/mockStore';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

const file = makeFile({
  accounts: [makeAccount({ id: 'old', currency: 'INR', balanceSource: 'HDFC NetBanking' })],
});

beforeEach(() => {
  window.history.replaceState(null, '', '#/accounts/new');
});
afterEach(async () => {
  vi.clearAllMocks();
  fakeStore.save.mockImplementation((snapshot) => Promise.resolve(snapshot));
  await (await import('@/services/cache/workspace')).workspace.clear();
});

describe('NewAccountPage', () => {
  it('asks for a name and a tag before saving', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Give the account a name.')).toBeInTheDocument();
    expect(screen.getByText('Pick a tag, or add a new one.')).toBeInTheDocument();
    expect(fakeStore.save).not.toHaveBeenCalled();
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
    expect(fakeStore.save).toHaveBeenCalledOnce();
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

  it('keeps the new account on this device when it can’t be uploaded yet (ADR-0015)', async () => {
    fakeStore.save.mockRejectedValue(new DriveError('Google Drive can’t be reached', 'offline'));
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, file);
    await user.type(screen.getByLabelText('Name'), 'Wallet');
    await user.click(screen.getByRole('button', { name: 'Cash' }));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Wallet' })).toBeInTheDocument();
    expect(dataIn(client)?.accounts.some((a) => a.name === 'Wallet')).toBe(true);
    expect(client.getQueryData<LoadedDataFile>(DATA_FILE_KEY)).toMatchObject({
      pending: 1,
      offline: true,
    });
  });

  describe('opening balance', () => {
    const fillBasics = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.type(screen.getByLabelText('Name'), name);
      await user.click(screen.getByRole('button', { name: 'Cash' }));
    };

    it('records an opening balance dated today', async () => {
      const user = userEvent.setup();
      const { client } = renderWithData(<Routes />, file);
      await fillBasics(user, 'Wallet');
      await user.type(screen.getByLabelText('Opening balance (optional)'), '2,500');
      expect(screen.getByText(/Saved as ₹2,500.00 for today/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      await screen.findByRole('heading', { name: 'Wallet' });

      const data = dataIn(client);
      const account = data?.accounts.find((a) => a.name === 'Wallet');
      expect(data?.balances.filter((b) => b.accountId === account?.id)).toEqual([
        expect.objectContaining({ date: localIsoDate(), amountMinor: 2_500_00 }),
      ]);
      expect(fakeStore.save).toHaveBeenCalledOnce(); // account + balance in one save
    });

    it('defaults to negative for a liability, following the type until the sign is chosen', async () => {
      const user = userEvent.setup();
      const { client } = renderWithData(<Routes />, file);
      await fillBasics(user, 'Card');
      const negative = () => screen.getByRole('radio', { name: 'Negative' });
      expect(negative()).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByRole('radio', { name: 'Liability' }));
      expect(negative()).toHaveAttribute('aria-checked', 'true');

      await user.type(screen.getByLabelText('Opening balance (optional)'), '645');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      await screen.findByRole('heading', { name: 'Card' });
      expect(dataIn(client)?.balances.at(-1)?.amountMinor).toBe(-645_00);
    });

    it('keeps a sign the user picked when the type changes', async () => {
      const user = userEvent.setup();
      renderWithData(<Routes />, file);
      await user.click(screen.getByRole('radio', { name: 'Negative' }));
      await user.click(screen.getByRole('radio', { name: 'Liability' }));
      await user.click(screen.getByRole('radio', { name: 'Asset' }));
      expect(screen.getByRole('radio', { name: 'Negative' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('creates no balance when left empty, and rejects unreadable amounts', async () => {
      const user = userEvent.setup();
      const { client } = renderWithData(<Routes />, file);
      await fillBasics(user, 'Empty');
      await user.type(screen.getByLabelText('Opening balance (optional)'), 'abc');
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByText(/Enter an amount/)).toBeInTheDocument();
      expect(fakeStore.save).not.toHaveBeenCalled();

      await user.clear(screen.getByLabelText('Opening balance (optional)'));
      await user.click(screen.getByRole('button', { name: 'Create account' }));
      await screen.findByRole('heading', { name: 'Empty' });
      expect(dataIn(client)?.balances).toEqual([]);
    });
  });
});
