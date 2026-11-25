import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sampleDataFile } from '@/domain/sampleData';
import type { DataFile } from '@/domain/schema';
import { DATA_FILE_KEY } from '@/features/data/useDataFile';
import { makeFile } from '@/test/builders';
import { AuthContext, type AuthContextValue } from './authContext';
import { UserMenu } from './UserMenu';

const signOut = vi.fn(() => Promise.resolve());
const auth: AuthContextValue = {
  state: { status: 'signed-in', user: { name: 'Ada Lovelace', email: 'ada@example.com' } },
  signIn: vi.fn(),
  signOut,
  getAccessToken: vi.fn(),
};

function renderMenu(user = { name: 'Ada Lovelace', email: 'ada@example.com' } as const) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext value={auth}>
        <UserMenu user={user} />
        <p>Outside</p>
      </AuthContext>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('UserMenu', () => {
  it('shows the avatar initials and name, with the menu closed', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Ada Lovelace/ });
    expect(button).toHaveTextContent('AL');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the profile photo when there is one', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext value={auth}>
          <UserMenu
            user={{
              name: 'Ada',
              email: 'a@example.com',
              picture: 'https://lh3.googleusercontent.com/a/x',
            }}
          />
        </AuthContext>
      </QueryClientProvider>,
    );
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://lh3.googleusercontent.com/a/x',
    );
  });

  it('opens a menu with who is signed in, Settings, and Sign out', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(menu).toHaveTextContent('ada@example.com');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '#/settings',
    );
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('closes with Escape (returning focus) and on a click outside', async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = screen.getByRole('button', { name: /Ada Lovelace/ });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('UserMenu with sample data (debug builds)', () => {
  function renderWith(data: DataFile) {
    const client = new QueryClient();
    client.setQueryData(DATA_FILE_KEY, { data });
    return render(
      <QueryClientProvider client={client}>
        <AuthContext value={auth}>
          <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com' }} />
        </AuthContext>
      </QueryClientProvider>,
    );
  }

  it('hides the real profile while sample data is showing', async () => {
    const user = userEvent.setup();
    renderWith(sampleDataFile('2026-11-26', makeFile()));
    await user.click(screen.getByRole('button', { name: /Alex Sample/ }));
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/Ada Lovelace|ada@example.com/)).not.toBeInTheDocument();
  });

  it('shows the real profile with real data', () => {
    renderWith(makeFile());
    expect(screen.getByRole('button', { name: /Ada Lovelace/ })).toBeInTheDocument();
  });
});
