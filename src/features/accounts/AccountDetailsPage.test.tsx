import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { localIsoDate } from '@/domain/dates';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { fakeStore } from '@/test/mockStore';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

const daysAgo = (n: number) => localIsoDate(new Date(Date.now() - n * 86_400_000));

const file = makeFile({
  accounts: [
    makeAccount({
      id: 'esaf',
      name: '💵 ESAF',
      tag: 'Cash',
      liquidity: 5,
      balanceSource: 'ESAF',
      note: 'Thrissur branch',
    }),
    makeAccount({
      id: 'card',
      name: 'Axis card',
      tag: 'Debt',
      kind: 'liability',
      balanceSource: 'Axis',
    }),
    makeAccount({ id: 'mf', name: 'Index fund', tag: 'Equity', balanceSource: 'Zerodha' }),
  ],
  balances: [
    makeEntry({ accountId: 'esaf', date: daysAgo(400), amountMinor: 1_000_00 }),
    makeEntry({ accountId: 'esaf', date: daysAgo(200), amountMinor: 3_000_00 }),
    makeEntry({ accountId: 'esaf', date: daysAgo(60), amountMinor: 1_500_00 }),
    makeEntry({ accountId: 'esaf', date: daysAgo(1), amountMinor: 2_000_00 }),
    makeEntry({ accountId: 'card', date: daysAgo(5), amountMinor: -500_00 }),
  ],
});

const open = (id: string) => {
  window.history.replaceState({ idx: 1 }, '', `#/accounts/${id}`);
  return renderWithData(<Routes />, file);
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('AccountDetailsPage', () => {
  it('shows name, tag, balance, changes, all-time high, liquidity, currency, source and notes', () => {
    open('esaf');
    expect(screen.getByRole('heading', { name: /💵 ESAF/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '💵 ESAF' }).nextElementSibling).toHaveTextContent(
      'Cash',
    );
    expect(screen.getByText('Updated yesterday').previousElementSibling).toHaveTextContent(
      '$2,000.00',
    );

    const changes = screen.getByLabelText('Changes');
    expect(within(changes).getByText('Since last entry').closest('div')).toHaveTextContent(
      '+$500.00+33.3%',
    );

    expect(screen.getByText('All-time high').parentElement).toHaveTextContent('$3,000.00');
    expect(screen.getByRole('button', { name: 'Edit liquidity' })).toHaveTextContent('Very high');
    expect(screen.getByRole('button', { name: 'Edit currency' })).toHaveTextContent('USD');
    expect(screen.getByRole('button', { name: 'Edit type' })).toHaveTextContent('Asset');
    expect(screen.getByRole('button', { name: 'Edit balance source' })).toHaveTextContent('ESAF');
    expect(screen.getByRole('button', { name: 'Edit notes' })).toHaveTextContent('Thrissur branch');
  });

  it('labels peak debt for liabilities', () => {
    open('card');
    expect(screen.getByText('All-time high (peak debt)')).toBeInTheDocument();
  });

  it('shows three history entries and all on demand', async () => {
    const user = userEvent.setup();
    open('esaf');
    const history = screen.getByRole('region', { name: 'Balance history' });
    expect(within(history).getAllByRole('button', { name: /Edit balance for/ })).toHaveLength(3);
    await user.click(within(history).getByRole('button', { name: 'See all 4 entries' }));
    expect(within(history).getAllByRole('button', { name: /Edit balance for/ })).toHaveLength(4);
    await user.click(within(history).getByRole('button', { name: 'Show less' }));
    expect(within(history).getAllByRole('button', { name: /Edit balance for/ })).toHaveLength(3);
  });

  it('edits name and tag by clicking the title', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Edit name and tag' }));
    const dialog = screen.getByRole('dialog', { name: 'Name & tag' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, '🏦 ESAF Savings');
    await user.click(within(dialog).getByRole('button', { name: 'Fixed Income' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(dataIn(client)?.accounts[0]).toMatchObject({
      name: '🏦 ESAF Savings',
      tag: 'Fixed Income',
    });
    expect(screen.getByRole('heading', { name: /🏦 ESAF Savings/ })).toBeInTheDocument();
  });

  it('has a visible edit button on every editable field, and tapping the title also edits', async () => {
    const user = userEvent.setup();
    open('esaf');
    for (const name of [
      'name and tag',
      'liquidity',
      'currency',
      'type',
      'balance source',
      'notes',
    ]) {
      const button = screen.getByRole('button', { name: `Edit ${name}` });
      expect(button.querySelector('svg')).not.toBeNull(); // the pencil
    }
    await user.click(screen.getByRole('heading', { name: '💵 ESAF' }));
    expect(screen.getByRole('dialog', { name: 'Name & tag' })).toBeInTheDocument();
  });

  it('edits liquidity, currency, balance source and notes', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');

    await user.click(screen.getByRole('button', { name: 'Edit liquidity' }));
    await user.click(screen.getByRole('radio', { name: 'Liquidity 2: Low' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]?.liquidity).toBe(2);
    });

    await user.click(screen.getByRole('button', { name: 'Edit currency' }));
    await user.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Currency'), 'INR');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]?.currency).toBe('INR');
    });

    await user.click(screen.getByRole('button', { name: 'Edit balance source' }));
    const source = within(screen.getByRole('dialog')).getByLabelText('Balance source');
    // Holding a saved source, it offers the others to switch to.
    const chips = () =>
      within(screen.getByRole('group', { name: 'Sources you’ve used' }))
        .getAllByRole('button')
        .map((b) => b.textContent);
    expect(chips()).toEqual(['Axis', 'Zerodha']);
    await user.clear(source);
    expect(chips()).toEqual(['Axis', 'ESAF', 'Zerodha']);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]).not.toHaveProperty('balanceSource');
    });

    await user.click(screen.getByRole('button', { name: 'Edit notes' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Notes'), ' · joint account');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]?.note).toBe('Thrissur branch · joint account');
    });
    expect(fakeStore.save).toHaveBeenCalledTimes(4);
  });

  it('changes the type and flips existing balances (pre-ticked when they used the default sign)', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Edit type' }));
    const dialog = screen.getByRole('dialog', { name: 'Type' });
    await user.click(within(dialog).getByRole('radio', { name: 'Liability' }));
    const flip = within(dialog).getByRole('checkbox', {
      name: /flip the sign of the 4 existing balances/,
    });
    expect(flip).toBeChecked();
    expect(within(dialog).getByText(/Current balance:/)).toHaveTextContent(
      '$2,000.00 → -$2,000.00',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]?.kind).toBe('liability');
    });
    expect(
      dataIn(client)
        ?.balances.filter((b) => b.accountId === 'esaf')
        .every((b) => b.amountMinor < 0),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit type' })).toHaveTextContent('Liability');
    expect(screen.getByText('All-time high (peak debt)')).toBeInTheDocument();
  });

  it('changes the type without touching balances when the box is unticked', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Edit type' }));
    await user.click(screen.getByRole('radio', { name: 'Liability' }));
    await user.click(screen.getByRole('checkbox', { name: /flip the sign/ }));
    expect(screen.getByText(/Current balance:/)).toHaveTextContent('$2,000.00 → $2,000.00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts[0]?.kind).toBe('liability');
    });
    expect(
      dataIn(client)
        ?.balances.filter((b) => b.accountId === 'esaf')
        .every((b) => b.amountMinor > 0),
    ).toBe(true);
  });

  it('moves between accounts in balance-source order with buttons, arrow keys and swipes', async () => {
    const user = userEvent.setup();
    open('esaf'); // order: Axis card (Axis), ESAF (ESAF), Index fund (Zerodha)
    expect(screen.getByLabelText('Account 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next account: Index fund' }));
    expect(await screen.findByRole('heading', { name: /Index fund/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next account/ })).not.toBeInTheDocument(); // last one

    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('heading', { name: /💵 ESAF/ })).toBeInTheDocument();

    // Swipe right → previous account.
    const page = screen
      .getByRole('heading', { name: /💵 ESAF/ })
      .closest('div.mx-auto') as HTMLElement;
    const down = createEvent.pointerDown(page, { clientX: 50, clientY: 300 });
    const up = createEvent.pointerUp(page, { clientX: 220, clientY: 310 });
    fireEvent(page, down);
    fireEvent(page, createEvent.pointerMove(page, { clientX: 150, clientY: 305 }));
    expect(page.style.transform).toBe('translateX(100px)'); // follows the finger
    fireEvent(page, up);
    expect(await screen.findByRole('heading', { name: /Axis card/ })).toBeInTheDocument();
    // The previous account slides in from the left.
    const next = screen.getByRole('heading', { name: /Axis card/ }).closest('div.mx-auto');
    expect(next).toHaveClass('slide-in-from-left');
    expect((next as HTMLElement).style.transform).toBe(''); // no transform at rest

    // First account: nothing to the right, so the drag resists and springs back.
    fireEvent(
      next as HTMLElement,
      createEvent.pointerDown(next as HTMLElement, { clientX: 50, clientY: 300 }),
    );
    fireEvent(
      next as HTMLElement,
      createEvent.pointerMove(next as HTMLElement, { clientX: 250, clientY: 300 }),
    );
    expect((next as HTMLElement).style.transform).toBe('translateX(50px)');
    fireEvent(
      next as HTMLElement,
      createEvent.pointerUp(next as HTMLElement, { clientX: 250, clientY: 300 }),
    );
    expect(screen.getByRole('heading', { name: /Axis card/ })).toBeInTheDocument();
  });
});

describe('deleting, archiving and undo', () => {
  it('deletes a balance entry after confirming, and can undo it', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    const count = () => dataIn(client)?.balances.filter((b) => b.accountId === 'esaf').length;
    expect(count()).toBe(4);

    await user.click(screen.getAllByRole('button', { name: /Edit balance for/ })[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Delete this entry' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => {
      expect(count()).toBe(3);
    });
    expect(screen.getByRole('status')).toHaveTextContent('deleted');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(count()).toBe(4);
    });
  });

  it('archives and unarchives an account', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Archive account' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts.find((a) => a.id === 'esaf')?.archived).toBe(true);
    });
    expect(screen.getByRole('note')).toHaveTextContent('Archived');
    await user.click(within(screen.getByRole('note')).getByRole('button', { name: 'Unarchive' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts.find((a) => a.id === 'esaf')?.archived).toBe(false);
    });
  });

  it('deletes an account only after its name is typed, then goes to the start page', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Delete account…' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete account?' });
    expect(dialog).toHaveTextContent('4 balance entries');
    const confirm = within(dialog).getByRole('button', { name: 'Delete account and history' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type “💵 ESAF” to confirm/), '💵 ESAF');
    await user.click(confirm);
    await waitFor(() => {
      expect(dataIn(client)?.accounts.some((a) => a.id === 'esaf')).toBe(false);
    });
    expect(dataIn(client)?.balances.some((b) => b.accountId === 'esaf')).toBe(false);
    await waitFor(() => {
      expect(window.location.hash).toBe('#/');
    });
  });

  it('offers archiving instead of deleting', async () => {
    const user = userEvent.setup();
    const { client } = open('esaf');
    await user.click(screen.getByRole('button', { name: 'Delete account…' }));
    await user.click(screen.getByRole('button', { name: 'Archive it instead' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts.find((a) => a.id === 'esaf')?.archived).toBe(true);
    });
  });
});
