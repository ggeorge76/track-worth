import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { App } from '@/App';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

const token = { accessToken: 'access-1', expiresAt: Date.now() + 3_600_000 };

function mockRust(handlers: Record<string, () => unknown>) {
  vi.mocked(invoke).mockImplementation((cmd: string) => {
    const handler = handlers[cmd];
    if (!handler) return Promise.reject(new Error(`unexpected command ${cmd}`));
    return Promise.resolve().then(handler);
  });
}

function mockProfile(name: string) {
  vi.mocked(tauriFetch).mockImplementation((input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes('userinfo')) {
      return Promise.resolve(new Response(JSON.stringify({ name, email: 'a@example.com' })));
    }
    // Drive calls from the dashboard: keep them pending, they're not under test here.
    return new Promise<Response>(() => undefined);
  });
}

function renderApp() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('desktop sign-in', () => {
  it('restores the session at startup and shows the user name from Google', async () => {
    mockRust({ auth_restore: () => token });
    mockProfile('Ada Lovelace');
    renderApp();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows the sign-in screen when there is no saved session', async () => {
    mockRust({ auth_restore: () => null });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  it('signs in through the browser flow and then signs out', async () => {
    mockRust({ auth_restore: () => null, auth_sign_in: () => token, auth_sign_out: () => null });
    mockProfile('Grace Hopper');
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('auth_sign_out');
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('shows the error message from Rust when sign-in fails', async () => {
    mockRust({
      auth_restore: () => null,
      auth_sign_in: () =>
        // Tauri commands reject with the serialized Rust error, a plain object.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        Promise.reject({
          code: 'scope-denied',
          message: 'TrackWorth needs access to Google Drive.',
        }),
    });
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs access to Google Drive');
  });
});
