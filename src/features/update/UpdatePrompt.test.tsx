import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { checkForUpdate, restartApp, type AvailableUpdate } from '@/services/update/desktopUpdater';
import { UpdatePrompt } from './UpdatePrompt';

vi.mock('@/services/update/desktopUpdater', () => ({
  checkForUpdate: vi.fn(),
  restartApp: vi.fn(() => Promise.resolve()),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function fakeUpdate(install: AvailableUpdate['install'] = () => Promise.resolve()) {
  const update = { version: '9.9.9', notes: 'Shiny', install: vi.fn(install) };
  vi.mocked(checkForUpdate).mockResolvedValue(update);
  return update;
}

function renderPrompt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UpdatePrompt />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('UpdatePrompt', () => {
  it('stays hidden when there is no newer release', async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(null);
    renderPrompt();
    await vi.waitFor(() => {
      expect(checkForUpdate).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('announces the release without installing anything on its own', async () => {
    const update = fakeUpdate();
    renderPrompt();
    expect(await screen.findByText(/TrackWorth 9\.9\.9 is available/)).toBeInTheDocument();
    expect(update.install).not.toHaveBeenCalled();
    expect(restartApp).not.toHaveBeenCalled();
  });

  it('opens the GitHub release notes', async () => {
    fakeUpdate();
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'What’s new' }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://github.com/ggeorge76/track-worth/releases/tag/v9.9.9',
    );
  });

  it('installs and restarts only after the user confirms', async () => {
    const update = fakeUpdate();
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Update and restart' }));
    expect(update.install).toHaveBeenCalledOnce();
    expect(restartApp).toHaveBeenCalledOnce();
  });

  it('shows an error and offers a retry when installation fails', async () => {
    fakeUpdate(() => Promise.reject(new Error('signature mismatch')));
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Update and restart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t be installed');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(restartApp).not.toHaveBeenCalled();
  });

  it('hides when the user chooses Later', async () => {
    fakeUpdate();
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
