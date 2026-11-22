import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: /Tag: Cash/ })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: '💵 ESAF. Edit name and tag' }));
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
    const options = [
      ...(document.getElementById(source.getAttribute('list') ?? '')?.querySelectorAll('option') ??
        []),
    ];
    expect(options.map((o) => o.value)).toEqual(['Axis', 'ESAF', 'Zerodha']);
    await user.clear(source);
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
    expect(fakeDrive.save).toHaveBeenCalledTimes(4);
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
    fireEvent(page, up);
    expect(await screen.findByRole('heading', { name: /Axis card/ })).toBeInTheDocument();
  });
});
