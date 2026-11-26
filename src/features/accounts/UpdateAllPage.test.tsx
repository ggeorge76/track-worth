import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { localIsoDate } from '@/domain/dates';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { fakeStore } from '@/test/mockStore';
import { dataIn, renderWithData } from '@/test/renderWithData';

vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

const today = localIsoDate();
const earlier = '2026-01-31';

const file = makeFile({
  accounts: [
    makeAccount({ id: 'card', name: 'Card', kind: 'liability', balanceSource: 'Bank app' }),
    makeAccount({ id: 'save', name: 'Savings', balanceSource: 'Bank app' }),
    makeAccount({ id: 'fund', name: 'Fund', balanceSource: 'Fund app' }),
    makeAccount({ id: 'cash', name: 'Cash box' }),
    makeAccount({ id: 'old', name: 'Old', archived: true }),
  ],
  balances: [
    makeEntry({ accountId: 'card', date: earlier, amountMinor: -50_00 }),
    makeEntry({ accountId: 'save', date: earlier, amountMinor: 1_000_00 }),
    makeEntry({ accountId: 'fund', date: earlier, amountMinor: 500_00 }),
  ],
});

function open(data = file) {
  window.history.replaceState({ idx: 1 }, '', '#/update');
  const user = userEvent.setup();
  return { user, ...renderWithData(<Routes />, data) };
}

const entriesOn = (client: ReturnType<typeof renderWithData>['client'], date: string) =>
  (dataIn(client)?.balances ?? [])
    .filter((e) => e.date === date)
    .map((e) => [e.accountId, e.amountMinor])
    .sort();

afterEach(() => {
  vi.clearAllMocks();
});

describe('UpdateAllPage', () => {
  it('lists active accounts by balance source, with the last balance as a hint', () => {
    open();
    const list = screen.getByRole('list', { name: 'Accounts to update' });
    expect(
      within(list)
        .getAllByRole('heading')
        .map((h) => h.textContent),
    ).toEqual(['Bank app', 'Fund app', 'No balance source']);
    expect(screen.queryByLabelText('Old')).not.toBeInTheDocument(); // archived
    expect(screen.getByLabelText('Savings')).toHaveAttribute('placeholder', '1000.00');
    expect(screen.getByLabelText('Card').closest('div.rounded-2xl')).toHaveTextContent('-$50.00');
    expect(screen.getByLabelText('Cash box').closest('div.rounded-2xl')).toHaveTextContent(
      'No balance yet',
    );
    expect(screen.getByRole('button', { name: 'Save 0 balances' })).toBeDisabled();
  });

  it('saves only what was entered or confirmed, in one change, then goes home', async () => {
    const { user, client } = open();
    await user.type(screen.getByLabelText('Savings'), '1,250.50');
    await user.click(screen.getByRole('button', { name: 'Same as last for Card' }));
    expect(screen.getByLabelText('Card')).toHaveValue('50.00');
    expect(screen.getByText('2 of 4 ready to save')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save 2 balances' }));
    await waitFor(() => {
      expect(entriesOn(client, today)).toEqual([
        ['card', -50_00],
        ['save', 1_250_50],
      ]);
    });
    expect(fakeStore.save).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('#/');
  });

  it('keeps each account’s sign, which can be switched', async () => {
    const { user, client } = open();
    await user.type(screen.getByLabelText('Card'), '80');
    await user.click(screen.getByRole('button', { name: 'Fund: positive, tap to switch' }));
    await user.type(screen.getByLabelText('Fund'), '600');
    await user.click(screen.getByRole('button', { name: 'Save 2 balances' }));
    await waitFor(() => {
      expect(entriesOn(client, today)).toEqual([
        ['card', -80_00],
        ['fund', -600_00],
      ]);
    });
  });

  it('flags amounts it can’t read and won’t save until fixed', async () => {
    const { user } = open();
    await user.type(screen.getByLabelText('Fund'), '-5');
    expect(screen.getByRole('alert')).toHaveTextContent('without a minus sign');
    expect(screen.getByText('Fix 1 amount first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  it('shows a date’s saved balances and only re-saves what changed', async () => {
    const { user, client } = open(
      makeFile({
        ...file,
        balances: [
          ...file.balances,
          makeEntry({ accountId: 'save', date: today, amountMinor: 1_100_00 }),
        ],
      }),
    );
    expect(screen.getByLabelText('Savings')).toHaveValue('1100.00');
    expect(screen.getByRole('button', { name: 'Save 0 balances' })).toBeDisabled();
    const savings = screen.getByLabelText('Savings');
    await user.clear(savings);
    await user.type(savings, '1100');
    expect(screen.getByRole('button', { name: 'Save 0 balances' })).toBeDisabled(); // unchanged
    await user.clear(savings);
    await user.type(savings, '1200');
    await user.click(screen.getByRole('button', { name: 'Save 1 balance' }));
    await waitFor(() => {
      expect(entriesOn(client, today)).toEqual([['save', 1_200_00]]);
    });
  });

  it('uses the chosen date for every balance, and refuses future dates', async () => {
    const { user, client } = open();
    const date = screen.getByLabelText('Balances on');
    await user.clear(date);
    await user.type(date, '2999-01-01');
    expect(screen.getByRole('alert')).toHaveTextContent('isn’t in the future');
    await user.clear(date);
    await user.type(date, '2026-02-28');
    await user.type(screen.getByLabelText('Cash box'), '20');
    await user.click(screen.getByRole('button', { name: 'Save 1 balance' }));
    await waitFor(() => {
      expect(entriesOn(client, '2026-02-28')).toEqual([['cash', 20_00]]);
    });
  });

  it('is reachable from the start page', async () => {
    window.history.replaceState({ idx: 0 }, '', '#/');
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('link', { name: 'Update all balances' }));
    expect(await screen.findByRole('heading', { name: 'Update all' })).toBeInTheDocument();
  });
});
