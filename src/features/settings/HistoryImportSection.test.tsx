import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeAccount, makeFile } from '@/test/builders';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

const CSV = [
  'Month/Year,Opening Worth,Closing Worth',
  'April-2011,"1,000.00 ","1,100.00 "',
  'May-2011,"1,100.00 ","1,250.00 "',
  'May-2011,"1,100.00 ","1,250.00 "',
].join('\n');

const data = makeFile({ accounts: [makeAccount({ id: 'a', currency: 'INR' })] });

function open(file = data) {
  window.history.replaceState({ idx: 1 }, '', '#/settings');
  const user = userEvent.setup();
  const utils = renderWithData(<Routes />, file);
  return { user, ...utils };
}

describe('HistoryImportSection (development builds)', () => {
  it('previews a pasted CSV and imports it in the accounts’ currency', async () => {
    const { user, client } = open();
    expect(screen.getByLabelText('Currency')).toHaveValue('INR');
    await user.click(screen.getByLabelText('Or paste it here'));
    await user.paste(CSV);
    expect(screen.getByLabelText('Preview')).toHaveTextContent(
      /3 months, .* from ₹1,000\.00 to ₹1,250\.00\./,
    );
    expect(screen.getByText(/May-2011 appears twice/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 3 months' }));
    await waitFor(() => {
      expect(dataIn(client)?.netWorthHistory).toEqual([
        { date: '2011-03-31', amountMinor: 1_000_00, currency: 'INR' },
        { date: '2011-04-30', amountMinor: 1_100_00, currency: 'INR' },
        { date: '2011-05-31', amountMinor: 1_250_00, currency: 'INR' },
      ]);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 3 months.');
  });

  it('shows what’s wrong with a CSV', async () => {
    const { user } = open();
    await user.click(screen.getByLabelText('Or paste it here'));
    await user.paste('Month,Closing\nSomeday,5');
    expect(screen.getByRole('alert')).toHaveTextContent('Row 2: “Someday” isn’t a month.');
  });

  it('reads a chosen file, and can remove an earlier import', async () => {
    const { user, client } = open(
      makeFile({
        ...data,
        netWorthHistory: [{ date: '2010-01-31', amountMinor: 5, currency: 'INR' }],
      }),
    );
    await user.upload(
      screen.getByLabelText('CSV file'),
      new File([CSV], 'history.csv', { type: 'text/csv' }),
    );
    expect(
      await screen.findByText(/This replaces the 1 month already imported/),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Or paste it here'));
    await user.click(screen.getByRole('button', { name: 'Remove the imported 1 month in INR' }));
    await waitFor(() => {
      expect(dataIn(client)?.netWorthHistory).toEqual([]);
    });
  });

  it('lists the imported months, newest first', async () => {
    const { user } = open(
      makeFile({
        ...data,
        netWorthHistory: [
          { date: '2011-03-31', amountMinor: 1_000_00, currency: 'INR' },
          { date: '2011-04-30', amountMinor: -50_00, currency: 'INR' },
          { date: '2011-04-30', amountMinor: 7, currency: 'USD' },
        ],
      }),
    );
    await user.click(screen.getByText('View the imported 2 months in INR'));
    const table = screen.getByRole('table', { name: /Imported net worth in INR/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('-₹50.00') as string,
      expect.stringContaining('₹1,000.00') as string,
    ]);
  });
});
