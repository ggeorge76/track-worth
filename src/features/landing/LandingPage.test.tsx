import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext, type AuthContextValue } from '@/features/auth/authContext';
import { LandingPage } from './LandingPage';

const signIn = vi.fn(() => Promise.resolve());
const auth: AuthContextValue = {
  state: { status: 'signed-out' },
  signIn,
  signOut: vi.fn(),
  getAccessToken: vi.fn(),
};

function renderPage() {
  return render(
    <AuthContext value={auth}>
      <LandingPage />
    </AuthContext>,
  );
}

describe('LandingPage', () => {
  it('has every section, in order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Your Wealth. Clearly Visualized.',
      'Everything You Need to Understand Your Wealth',
      'Track Everything That Matters',
      'More Than A Portfolio Tracker',
      'What Is Net Worth?',
      'Your Data. Your Control.',
      'Available Where You Need It',
      'Frequently Asked Questions',
    ]);
  });

  it('shows the value summary and the sample figures', () => {
    renderPage();
    const glance = screen.getByLabelText('TrackWorth at a glance');
    expect(glance).toHaveTextContent('14asset types');
    expect(glance).toHaveTextContent('DesktopAndroid soon');
    const preview = screen.getByRole('region', { name: 'Your Wealth. Clearly Visualized.' });
    expect(preview).toHaveTextContent('₹48,75,000');
    expect(preview).toHaveTextContent('₹62,00,000');
    expect(preview).toHaveTextContent('₹13,25,000');
    expect(preview).toHaveTextContent(/sample data/i);
    expect(screen.getByRole('region', { name: 'What Is Net Worth?' })).toHaveTextContent(
      '₹42,00,000',
    );
  });

  it('lists all 14 asset types', () => {
    renderPage();
    const assets = screen.getByRole('region', { name: 'Track Everything That Matters' });
    expect(within(assets).getAllByRole('listitem')).toHaveLength(14);
  });

  it('is honest about what isn’t built yet', () => {
    renderPage();
    const platforms = screen.getByRole('region', { name: 'Available Where You Need It' });
    expect(within(platforms).getByRole('heading', { name: /Android App/ })).toHaveTextContent(
      'Coming soon to Google Play',
    );
    // Charts are built, so they're no longer marked as coming.
    expect(screen.getByRole('heading', { name: /Wealth Growth Charts/ })).not.toHaveTextContent(
      'Coming soon',
    );
    expect(document.body.textContent).not.toMatch(/charts coming soon/i);
  });

  it('offers only Sign In: no sign-up, registration or pricing', () => {
    renderPage();
    const page = document.body.textContent;
    expect(page).not.toMatch(/sign up|create account|register|pricing|testimonial/i);
    expect(
      screen.getAllByRole('button', { name: /^Sign In$|Sign in with Google/ }).length,
    ).toBeGreaterThan(0);
  });

  it('answers the FAQ, including that bank accounts are never linked', async () => {
    const user = userEvent.setup();
    renderPage();
    const faq = screen.getByRole('region', { name: 'Frequently Asked Questions' });
    await user.click(within(faq).getByText('Do I need to link bank accounts?'));
    expect(within(faq).getByText(/never connects to your bank/)).toBeVisible();
  });

  it('scrolls to the preview from Learn More', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Learn More' }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('has privacy, terms, contact, version and copyright in the footer', () => {
    renderPage();
    const footer = screen.getByRole('contentinfo');
    for (const name of ['Privacy Policy', 'Terms of Service', 'Contact']) {
      expect(within(footer).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(footer).toHaveTextContent(
      `© ${String(new Date().getFullYear())} TrackWorth · v${__APP_VERSION__}`,
    );
  });
});
