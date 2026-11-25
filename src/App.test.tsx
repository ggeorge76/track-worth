import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { App } from './App';

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

// jsdom is not the desktop app, so this covers the browser preview of the landing page.
describe('App before sign-in (browser preview)', () => {
  it('shows the landing page with a desktop-app hint', () => {
    renderApp();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'See Your Complete Financial Life in One Place',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/never connects to your bank/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('note')).toHaveTextContent(/only works in the desktop app/i);
  });

  it('shows the app version in the footer', () => {
    renderApp();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`v${__APP_VERSION__}`);
  });
});
