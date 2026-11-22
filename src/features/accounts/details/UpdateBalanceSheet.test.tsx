import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { localIsoDate } from '@/domain/dates';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { fakeDrive } from '@/test/mockDrive';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/drive/driveClient', async (importOriginal) =>
  (await import('@/test/mockDrive')).mockDriveModule(importOriginal),
);

const today = localIsoDate();
const yesterday = localIsoDate(new Date(Date.now() - 86_400_000));

const file = makeFile({
  accounts: [
    makeAccount({ id: 'bank', name: 'Bank', kind: 'asset', currency: 'INR' }),
    makeAccount({ id: 'loan', name: 'Loan', kind: 'liability', currency: 'INR' }),
  ],
  balances: [makeEntry({ id: 'y', accountId: 'bank', date: yesterday, amountMinor: 1_000_00 })],
});

function openUpdate(id: string) {
  window.history.replaceState({ idx: 1 }, '', `#/accounts/${id}`);
  const utils = renderWithData(<Routes />, file);
  return utils;
}

const entriesFor = (client: ReturnType<typeof renderWithData>['client'], id: string) =>
  dataIn(client)?.balances.filter((b) => b.accountId === id) ?? [];

afterEach(() => {
  vi.clearAllMocks();
});

describe('UpdateBalanceSheet', () => {
  it('saves a positive balance for an asset, dated today by default', async () => {
    const user = userEvent.setup();
    const { client } = openUpdate('bank');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    const dialog = screen.getByRole('dialog', { name: 'Update balance' });
    expect(within(dialog).getByLabelText('Date')).toHaveValue(today);
    expect(within(dialog).getByRole('radio', { name: 'Positive' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(dialog).getByText(/INR/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Amount'), '1,234.5');
    expect(within(dialog).getByText(/Will be saved as ₹1,234.50/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(entriesFor(client, 'bank').find((b) => b.date === today)?.amountMinor).toBe(1_234_50);
    expect(fakeDrive.save).toHaveBeenCalledOnce();
  });

  it('defaults to negative for a liability and saves the amount as negative', async () => {
    const user = userEvent.setup();
    const { client } = openUpdate('loan');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(screen.getByRole('radio', { name: 'Negative' })).toHaveAttribute('aria-checked', 'true');
    await user.type(screen.getByLabelText('Amount'), '500');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(entriesFor(client, 'loan')[0]?.amountMinor).toBe(-500_00);
    });
  });

  it('lets you flip the sign', async () => {
    const user = userEvent.setup();
    const { client } = openUpdate('loan');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await user.click(screen.getByRole('radio', { name: 'Positive' }));
    await user.type(screen.getByLabelText('Amount'), '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(entriesFor(client, 'loan')[0]?.amountMinor).toBe(20_00);
    });
  });

  it('updates the existing entry when the date already has one, and says so', async () => {
    const user = userEvent.setup();
    const { client } = openUpdate('bank');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    const date = screen.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, yesterday);
    expect(screen.getByText(/This replaces the ₹1,000.00 already saved/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '1500');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(entriesFor(client, 'bank')).toEqual([
        expect.objectContaining({ id: 'y', date: yesterday, amountMinor: 1_500_00 }),
      ]);
    });
  });

  it('edits a past entry from the history list', async () => {
    const user = userEvent.setup();
    const { client } = openUpdate('bank');
    await user.click(screen.getByRole('button', { name: /Edit balance for/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit balance' });
    expect(within(dialog).getByLabelText('Date')).toHaveValue(yesterday);
    expect(within(dialog).getByLabelText('Amount')).toHaveValue('1000.00');
    expect(within(dialog).queryByText(/This replaces/)).not.toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Amount'));
    await user.type(within(dialog).getByLabelText('Amount'), '999');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(entriesFor(client, 'bank')[0]?.amountMinor).toBe(999_00);
    });
  });

  it.each([
    ['', 'Enter an amount'],
    ['abc', 'Enter an amount'],
    ['-5', 'without a minus sign'],
  ])('rejects amount "%s"', async (amount, message) => {
    const user = userEvent.setup();
    openUpdate('bank');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    if (amount) await user.type(screen.getByLabelText('Amount'), amount);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(fakeDrive.save).not.toHaveBeenCalled();
  });

  it('rejects future dates', async () => {
    const user = userEvent.setup();
    openUpdate('bank');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    const date = screen.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2999-01-01');
    await user.type(screen.getByLabelText('Amount'), '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('isn’t in the future');
  });
});
