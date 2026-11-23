import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { renderWithData } from '@/test/renderWithData';

const data = makeFile({
  accounts: [
    makeAccount({ id: 'bank', name: 'Bank', tag: 'Cash', liquidity: 5 }),
    makeAccount({ id: 'fd', name: 'FD', tag: 'Fixed Income', liquidity: 2 }),
    makeAccount({ id: 'loan', name: 'Loan', kind: 'liability', tag: 'Loan', liquidity: 1 }),
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
const rows = (name: string) =>
  within(section(name))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('InsightsPage', () => {
  it('opens from the start page and breaks down by tag', async () => {
    window.history.replaceState({ idx: 0 }, '', '#/');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.click(screen.getByRole('link', { name: 'See where your money is' }));
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tag' })).toBeChecked();

    expect(section('Assets')).toHaveTextContent('$1,000.00');
    expect(rows('Assets')).toEqual([
      'Fixed Income · 1 account$750.0075%',
      'Cash · 1 account$250.0025%',
    ]);
    expect(rows('Liabilities')).toEqual(['Loan · 1 account$400.00100%']);
  });

  it('switches to liquidity, most liquid first', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/insights');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.click(screen.getByRole('radio', { name: 'Liquidity' }));
    expect(rows('Assets')).toEqual([
      '5 · Very high · 1 account$250.0025%',
      '2 · Low · 1 account$750.0075%',
    ]);
    expect(rows('Liabilities')).toEqual(['1 · Very low · 1 account$400.00100%']);
  });

  it('shows one currency at a time, and says when a section is empty', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/insights');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.click(screen.getByRole('radio', { name: 'EUR' }));
    expect(rows('Assets')).toEqual(['Cash · 1 account€10.00100%']);
    expect(section('Liabilities')).toHaveTextContent('No liability balances yet.');
  });

  it('explains when there is nothing to show', () => {
    window.history.replaceState({ idx: 1 }, '', '#/insights');
    renderWithData(<Routes />, makeFile());
    expect(screen.getByText(/Nothing to show yet/)).toBeInTheDocument();
  });
});
