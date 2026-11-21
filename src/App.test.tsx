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

// jsdom is not the desktop app, so this covers the browser-preview shell.
describe('App (browser preview)', () => {
  it('shows the sign-in screen with a desktop-app hint', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'TrackWorth' })).toBeInTheDocument();
    expect(screen.getByText(/never connects to your bank/i)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/only works in the desktop app/i);
  });

  it('shows the app version', () => {
    renderApp();
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });
});
