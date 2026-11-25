import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatIsoDate as d } from '@/domain/dates';
import type { DataFile } from '@/domain/schema';
import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { createConverter, sameCurrencyConverter, type Converter } from '@/domain/fx';
import { NetWorthTrend } from './NetWorthTrend';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 12)); // 23 Nov 2026, local time
});
afterEach(() => {
  vi.useRealTimers();
});

const data = makeFile({
  accounts: [
    makeAccount({ id: 'bank', currency: 'USD' }),
    makeAccount({ id: 'loan', kind: 'liability', currency: 'USD' }),
  ],
  balances: [
    makeEntry({ accountId: 'bank', date: '2025-06-01', amountMinor: 100000 }),
    makeEntry({ accountId: 'bank', date: '2026-11-01', amountMinor: 150000 }),
    makeEntry({ accountId: 'loan', date: '2025-06-01', amountMinor: -20000 }),
  ],
});

function show(file: DataFile = data, fx: Converter = sameCurrencyConverter('USD')) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  render(<NetWorthTrend data={file} fx={fx} />);
  return user;
}

/** Matches the change pill, whose arrow is a separate (screen-reader-hidden) element. */
const pill = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'SPAN' && el.textContent === text && el.className.includes('rounded-full');

describe('NetWorthTrend', () => {
  it('shows nothing without balances', () => {
    const { container } = render(
      <NetWorthTrend data={makeFile()} fx={sameCurrencyConverter('USD')} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to 1Y with the change, totals and the financial-year line', () => {
    show();
    expect(screen.getByRole('radio', { name: '1Y' })).toBeChecked();
    expect(screen.getByText(pill('▲ +$500.00 (+62.5%)'))).toBeInTheDocument();
    expect(screen.getByText('in the last year')).toBeInTheDocument();
    expect(screen.getByText(`┆ Financial year started ${d('2026-04-01')}`)).toBeInTheDocument();
    expect(screen.getByText('Assets').parentElement).toHaveTextContent('Assets$1,500.00');
    expect(screen.getByText('Liabilities').parentElement).toHaveTextContent('Liabilities-$200.00');
    expect(
      screen.getByRole('img', {
        name: `Net worth in USD: $800.00 on ${d('2025-11-23')}, $1,300.00 on ${d('2026-11-23')}.`,
      }),
    ).toBeInTheDocument();
  });

  it('switches range; All has no financial-year line', async () => {
    const user = show();
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText(`since ${d('2025-06-01')}`)).toBeInTheDocument();
    expect(screen.queryByText(/Financial year started/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '1M' }));
    expect(screen.getByText('in the last month')).toBeInTheDocument();
  });

  it('shows every currency in the base currency', () => {
    // 1 USD = 0.5 EUR, so 1 EUR = $2.
    const fx = createConverter(
      'USD',
      { base: 'USD', latest: { date: '2026-11-23', rates: { EUR: 0.5 } }, monthly: {} },
      {},
      '2026-11-23',
    );
    show(
      makeFile({
        accounts: [
          makeAccount({ id: 'usd', currency: 'USD' }),
          makeAccount({ id: 'eur', currency: 'EUR' }),
        ],
        balances: [
          makeEntry({ accountId: 'usd', date: '2026-01-01', amountMinor: 100 }),
          makeEntry({ accountId: 'eur', date: '2026-01-01', amountMinor: 700 }),
          makeEntry({ accountId: 'eur', date: '2026-11-01', amountMinor: 1400 }),
        ],
      }),
      fx,
    );
    expect(screen.queryByRole('radio', { name: 'EUR' })).not.toBeInTheDocument();
    expect(screen.getByText(pill('▲ +$14.00 (+93.3%)'))).toBeInTheDocument();
    expect(screen.getByText('Assets').parentElement).toHaveTextContent('Assets$29.00');
  });

  it('marks earlier imported history', async () => {
    const user = show({
      ...data,
      netWorthHistory: [{ date: '2020-01-31', amountMinor: 50000, currency: 'USD' }],
    });
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText('┄ Earlier history (imported totals)')).toBeInTheDocument();
    expect(screen.getByText(`since ${d('2020-01-31')}`)).toBeInTheDocument();
  });
});
