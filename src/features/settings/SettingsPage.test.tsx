import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from '@/app/Routes';
import { makeFile } from '@/test/builders';
import { dataIn, renderWithData } from '@/test/renderWithData';

// vi.mock is hoisted above imports, so load the helper inside the factory.
vi.mock('@/services/drive/driveClient', async (importOriginal) =>
  (await import('@/test/mockDrive')).mockDriveModule(importOriginal),
);

describe('SettingsPage', () => {
  it('changes the financial year start month', async () => {
    window.history.replaceState({ idx: 1 }, '', '#/settings');
    const user = userEvent.setup();
    const { client } = renderWithData(<Routes />, makeFile());
    const select = screen.getByLabelText('Financial year starts in');
    expect(select).toHaveValue('4');
    await user.selectOptions(select, '1');
    await waitFor(() => {
      expect(dataIn(client)?.settings.financialYearStartMonth).toBe(1);
    });
    expect(screen.getByText(/Current financial year: .*Jan.*Dec/)).toBeInTheDocument();
  });
});
