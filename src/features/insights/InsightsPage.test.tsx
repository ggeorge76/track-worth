import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { renderWithData } from '@/test/renderWithData';

const data = makeFile({
  accounts: [
    makeAccount({ id: 'bank', name: 'Bank', tag: 'Cash', liquidity: 5 }),
    makeAccount({ id: 'fd', name: 'FD', tag: 'Fixed Income', liquidity: 2 }),
    makeAccount({ id: 'loan', name: 'Loan', kind: 'liability', tag: 'Loan' }),
    makeAccount({ id: 'eur', name: 'Euro', tag: 'Cash', currency: 'EUR' }),
  ],
  balances: [
    makeEntry({ accountId: 'bank', amountMinor: 250_00 }),
    makeEntry({ accountId: 'fd', amountMinor: 750_00 }),
    makeEntry({ accountId: 'loan', amountMinor: -400_00 }),
    makeEntry({ accountId: 'eur', amountMinor: 10_00 }),
  ],
});

const section = (name: string) => screen.getByRole('region', { name });

describe('InsightsPage', () => {
  it('opens from the start page and shows the breakdowns', async () => {
    window.history.replaceState({ idx: 0 }, '', '#/');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.click(screen.getByRole('link', { name: 'See where your money is' }));
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();

    const byTag = section('Assets by tag');
    expect(byTag).toHaveTextContent('$1,000.00');
    expect(
      within(byTag)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Fixed Income · 1 account$750.0075%', 'Cash · 1 account$250.0025%']);
    expect(section('Assets by liquidity')).toHaveTextContent('5 · Very high');
    expect(section('Liabilities by tag')).toHaveTextContent('Loan · 1 account$400.00100%');
  });

  it('shows one currency at a time', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/insights');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.click(screen.getByRole('radio', { name: 'EUR' }));
    expect(section('Assets by tag')).toHaveTextContent('Cash · 1 account€10.00100%');
    expect(screen.queryByRole('region', { name: 'Liabilities by tag' })).not.toBeInTheDocument();
  });

  it('explains when there is nothing to show', () => {
    window.history.replaceState({ idx: 1 }, '', '#/insights');
    renderWithData(<Routes />, makeFile());
    expect(screen.getByText(/Nothing to show yet/)).toBeInTheDocument();
  });
});
