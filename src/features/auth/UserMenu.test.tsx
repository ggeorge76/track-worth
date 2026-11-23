import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
