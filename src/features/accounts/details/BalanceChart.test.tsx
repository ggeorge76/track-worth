import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatIsoDate as d } from '@/domain/dates';
import { makeAccount, makeEntry } from '@/test/builders';
import { BalanceChart } from './BalanceChart';

const TODAY = '2026-11-23';
const show = (
  kind: 'asset' | 'liability',
  entries = [
    makeEntry({ date: '2025-06-01', amountMinor: kind === 'asset' ? 100_00 : -900_00 }),
    makeEntry({ date: '2026-06-01', amountMinor: kind === 'asset' ? 250_00 : -400_00 }),
  ],
) =>
  render(
    <BalanceChart
      account={makeAccount({ kind, currency: 'USD' })}
      entries={entries}
      today={TODAY}
      financialYearStartMonth={4}
    />,
  );

describe('BalanceChart', () => {
  it('shows nothing without entries', () => {
    const { container } = show('asset', []);
    expect(container).toBeEmptyDOMElement();
  });

  it('charts the balance for 1Y by default, with the financial-year line', () => {
    show('asset');
    expect(screen.getByRole('heading', { name: 'Balance over time' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1Y' })).toBeChecked();
    expect(
      screen.getByRole('img', {
        name: `Balance over time: $100.00 on ${d('2025-11-23')}, $250.00 on ${d(TODAY)}.`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(`┆ Financial year started ${d('2026-04-01')}`)).toBeInTheDocument();
  });

  it('shows a liability as the amount owed, and All from the first entry', async () => {
    const user = userEvent.setup();
    show('liability');
    expect(screen.getByRole('heading', { name: 'Amount owed over time' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(
      screen.getByRole('img', {
        name: `Amount owed over time: $900.00 on ${d('2025-06-01')}, $400.00 on ${d(TODAY)}.`,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Financial year started/)).not.toBeInTheDocument();
  });

  it('has no from–to summary with a single point', () => {
    show('asset', [makeEntry({ date: TODAY, amountMinor: 5 })]);
    expect(screen.getByRole('img', { name: 'Balance over time.' })).toBeInTheDocument();
  });
});
