import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeAccount, makeFile } from '@/test/builders';
import { dataIn, renderWithData } from '@/test/renderWithData';

vi.mock('@/services/storage/dataStore', async (importOriginal) =>
  (await import('@/test/mockStore')).mockStoreModule(importOriginal),
);

describe('SampleDataSection (development builds)', () => {
  it('fills an empty Drive with sample data after confirming', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/settings');
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, makeFile());
    await user.click(screen.getByRole('button', { name: 'Load sample data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, fill this Drive with sample data' }));
    await waitFor(() => {
      expect(dataIn(client)?.accounts).toHaveLength(9);
    });
    expect(dataIn(client)?.baseCurrency).toBe('INR');
  });

  it('is unavailable once there are accounts, so real data is never replaced', () => {
    window.history.replaceState({ idx: 1 }, '', '#/settings');
    renderWithData(<Routes />, makeFile({ accounts: [makeAccount()] }));
    expect(screen.queryByRole('button', { name: 'Load sample data' })).not.toBeInTheDocument();
    expect(screen.getByText(/real data is never replaced/)).toBeInTheDocument();
  });
});
