import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { localIsoDate } from '@/domain/dates';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { renderWithData } from '@/test/renderWithData';

const today = localIsoDate();

const file = makeFile({
  accounts: [
    makeAccount({ id: 'hdfc', name: '💵 HDFC', tag: 'Cash', liquidity: 5 }),
    makeAccount({ id: 'ppf', name: 'PPF', tag: 'Fixed Income', liquidity: 1 }),
    makeAccount({ id: 'card', name: 'Axis card', tag: 'Debt', liquidity: 4, kind: 'liability' }),
  ],
  balances: [
    makeEntry({ accountId: 'hdfc', date: today, amountMinor: 1_234_50 }),
    makeEntry({ accountId: 'card', date: today, amountMinor: -645_00 }),
  ],
});

// Queried directly: while the filter popup is open, the list behind it is (correctly) hidden
// from assistive technology, so role queries can't name it.
const rowNames = () =>
  [...document.querySelectorAll('ul[aria-label="Accounts"] a span.block')].map(
    (el) => el.textContent,
  );

const netWorthCard = () => screen.getByRole('region', { name: /^Net worth/ });

beforeEach(() => {
  window.history.replaceState(null, '', '#/');
});

describe('StartPage', () => {
  it('lists accounts with their current balance and net worth', () => {
    renderWithData(<Routes />, file);
    expect(rowNames()).toEqual(['💵 HDFC', 'Axis card', 'PPF']); // emoji included in the sort
    expect(
      screen.getByRole('link', { name: /💵 HDFC.*Cash.*Updated today.*1,234\.50/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PPF.*No balance yet/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Axis card.*-\$645\.00/ })).toBeInTheDocument();
    // Net worth = 1,234.50 − 645.00
    expect(screen.getByRole('heading', { name: 'Net worth' })).toBeInTheDocument();
    expect(within(netWorthCard()).getByText('$589.50')).toBeInTheDocument();
  });

  it('sorts and filters in the filter popup, and resets', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const dialog = screen.getByRole('dialog', { name: 'Sort & filter' });

    await user.click(within(dialog).getByRole('button', { name: 'Sort by Liquidity' }));
    expect(rowNames()).toEqual(['💵 HDFC', 'Axis card', 'PPF']); // most liquid first
    await user.click(within(dialog).getByRole('button', { name: /Sort by Liquidity, descending/ }));
    expect(rowNames()).toEqual(['PPF', 'Axis card', '💵 HDFC']);

    // Any of the chosen tags…
    await user.click(within(dialog).getByRole('button', { name: 'Cash' }));
    await user.click(within(dialog).getByRole('button', { name: 'Fixed Income' }));
    expect(rowNames()).toEqual(['PPF', '💵 HDFC']);
    expect(
      screen.getByRole('button', { name: /2 of 3 accounts/, hidden: true }),
    ).toBeInTheDocument();
    // …and the liquidity levels left on: all start on, and a click turns one off.
    const veryLow = within(dialog).getByRole('button', { name: 'Liquidity 1: Very low' });
    expect(veryLow).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Liquidity 5: Very high' }));
    expect(rowNames()).toEqual(['PPF']);
    await user.click(within(dialog).getByRole('button', { name: 'Liquidity 5: Very high' }));
    expect(rowNames()).toEqual(['PPF', '💵 HDFC']);
    await user.click(veryLow);
    expect(rowNames()).toEqual(['💵 HDFC']);

    await user.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: /^3 accounts/, hidden: true })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('net worth follows the filter', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Debt' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('heading', { name: 'Net worth · filtered' })).toBeInTheDocument();
    expect(within(netWorthCard()).getAllByText('-$645.00')).toHaveLength(2); // headline, liabilities
    expect(screen.getByText('Assets').parentElement).toHaveTextContent('Assets$0.00');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('heading', { name: 'Net worth' })).toBeInTheDocument();
    expect(within(netWorthCard()).getByText('$589.50')).toBeInTheDocument();
  });

  it('leaves imported history out of a filtered chart', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, {
      ...file,
      netWorthHistory: [{ date: '2020-01-31', amountMinor: 1, currency: 'USD' }],
    });
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText(/Earlier history/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Debt' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/Earlier history/)).not.toBeInTheDocument();
  });

  it('keeps a compact net worth in view once the big number scrolls away', () => {
    let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    renderWithData(<Routes />, file);
    const bar = screen.getByText('$589.50', { selector: '[aria-hidden] span' }).closest('.fixed');
    expect(bar).toHaveClass('opacity-0');

    const scrolled = (top: number, isIntersecting: boolean) => {
      act(() => {
        report([{ isIntersecting, boundingClientRect: { top } as DOMRectReadOnly }]);
      });
    };
    scrolled(-120, false);
    expect(bar).toHaveClass('opacity-100');
    scrolled(400, false); // below the window (not reached yet) doesn't count
    expect(bar).toHaveClass('opacity-0');
    scrolled(-120, false);
    scrolled(80, true);
    expect(bar).toHaveClass('opacity-0');
    vi.unstubAllGlobals();
  });

  it('says "1 account", not "1 accounts"', () => {
    renderWithData(<Routes />, makeFile({ accounts: [makeAccount({ id: 'only' })] }));
    expect(screen.getByRole('button', { name: /^1 account$/ })).toBeInTheDocument();
  });

  it('remembers sort, filters and grouping across sessions', async () => {
    const user = userEvent.setup();
    const first = renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Sort by Liquidity' }));
    await user.click(screen.getByRole('button', { name: 'Cash' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Group by tag' }));
    first.unmount();

    // A new session (app restarted) starts with the same view.
    renderWithData(<Routes />, file);
    expect(screen.getByRole('button', { name: 'Group by tag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /1 of 3 accounts/ })).toBeInTheDocument();
  });

  it('falls back to the default view if what was saved can’t be read', () => {
    localStorage.setItem('trackworth.accountList', '{"sort":"sideways"}');
    renderWithData(<Routes />, file);
    expect(screen.getByRole('button', { name: /^3 accounts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group by tag' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows a way out when filters match nothing', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Fixed Income' }));
    await user.click(screen.getByRole('button', { name: 'Liquidity 1: Very low' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText(/No accounts match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rowNames()).toHaveLength(3);
  });

  it('groups by tag', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('button', { name: 'Group by tag' }));
    expect(screen.getByRole('button', { name: 'Group by tag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const groups = screen
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-label'))
      .filter(Boolean);
    expect(groups).toEqual(['Cash', 'Debt', 'Fixed Income']);
  });

  it('opens account details when an account is clicked, and goes back', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, file);
    await user.click(screen.getByRole('link', { name: /PPF/ }));
    expect(await screen.findByRole('heading', { name: 'PPF' })).toBeInTheDocument();
    expect(screen.getByText('Fixed Income')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Net worth' })).toBeInTheDocument();
    });
  });

  it('invites you to add the first account when there are none', () => {
    renderWithData(<Routes />, makeFile());
    expect(screen.getByText('No accounts yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first account' })).toHaveAttribute(
      'href',
      '#/accounts/new',
    );
    expect(screen.getByRole('link', { name: 'Add account' })).toHaveAttribute(
      'href',
      '#/accounts/new',
    );
  });

  it('shows a message for an account that no longer exists', async () => {
    window.history.replaceState(null, '', '#/accounts/gone');
    renderWithData(<Routes />, file);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('doesn’t exist');
  });
});

describe('archived accounts', () => {
  const archivedFile = makeFile({
    accounts: [
      makeAccount({ id: 'old', name: 'Old account', archived: true }),
      makeAccount({ id: 'live', name: 'Live account' }),
    ],
  });

  it('hides archived accounts unless asked, and marks them', async () => {
    const user = userEvent.setup();
    renderWithData(<Routes />, archivedFile);
    expect(rowNames()).toEqual(['Live account']);
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Show archived accounts' }));
    expect(rowNames()).toEqual(['Live account', 'Old account']);
    expect(
      screen.getByRole('link', { name: /Old account.*Archived/, hidden: true }),
    ).toBeInTheDocument();
  });

  it('says so when every account is archived', async () => {
    const user = userEvent.setup();
    renderWithData(
      <Routes />,
      makeFile({ accounts: [makeAccount({ id: 'old', name: 'Old', archived: true })] }),
    );
    expect(screen.queryByText('No accounts yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show archived accounts' }));
    expect(rowNames()).toEqual(['Old']);
  });
});
