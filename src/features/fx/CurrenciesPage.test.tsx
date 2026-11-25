import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeAccount, makeFile } from '@/test/builders';
import type * as RateStoreModule from '@/services/fx/rateStore';
import { renderWithData } from '@/test/renderWithData';

// The page's rates come from the (mocked) service; keep them in memory, fresh per test.
vi.mock('@/services/fx/rateStore', async (importOriginal) => {
  const actual = await importOriginal<typeof RateStoreModule>();
  const { createMemoryStore } = await import('@/services/cache/fileCache');
  return { ...actual, rateStore: actual.rateStoreOn(createMemoryStore()) };
});

const rows = [
  { date: '2026-11-25', base: 'INR', quote: 'USD', rate: 0.0125 },
  { date: '2026-11-25', base: 'INR', quote: 'EUR', rate: 0.01 },
];

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(rows))));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const data = makeFile({ baseCurrency: 'INR', accounts: [makeAccount({ currency: 'USD' })] });
const row = (code: string) =>
  within(screen.getByRole('list', { name: 'Converted amounts' }))
    .getAllByRole('listitem')
    .find((li) => li.textContent.startsWith(code)) as HTMLElement;

describe('CurrenciesPage', () => {
  it('converts the base amount into other currencies, and takes your own rate', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/currencies');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    const amount = screen.getByLabelText(/Amount in INR/);
    expect(amount).toHaveValue('1');
    await waitFor(() => {
      expect(row('USD')).toHaveTextContent('1 USD = 80 INR');
    });
    await user.clear(amount);
    await user.type(amount, '1,000');
    expect(row('USD')).toHaveTextContent('$12.50');
    expect(row('EUR')).toHaveTextContent('€10.00');
    expect(row('GBP')).toHaveTextContent('No rate yet');

    await user.click(within(row('USD')).getByRole('button', { name: /own rate for USD/ }));
    const own = within(row('USD')).getByLabelText('1 USD =');
    await user.clear(own);
    await user.type(own, '100');
    await user.click(within(row('USD')).getByRole('button', { name: 'Use my rate' }));
    await waitFor(() => {
      expect(row('USD')).toHaveTextContent('1 USD = 100 INRyour rate');
    });
    expect(row('USD')).toHaveTextContent('$10.00');

    await user.click(within(row('USD')).getByRole('button', { name: /own rate for USD/ }));
    await user.click(within(row('USD')).getByRole('button', { name: 'Use the published rate' }));
    await waitFor(() => {
      expect(row('USD')).toHaveTextContent('$12.50');
    });
  });

  it('flags an amount it can’t read', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/currencies');
    const user = userEvent.setup();
    renderWithData(<Routes />, data);
    await user.type(screen.getByLabelText(/Amount in INR/), 'x');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
  });
});
