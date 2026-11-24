import { Routes } from './app/Routes';
import { config, symbolUrl } from './config';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/authContext';
import { UserMenu } from './features/auth/UserMenu';
import { LandingPage } from './features/landing/LandingPage';
import { SyncStatus } from './features/data/SyncStatus';
import { SaveStatus } from './features/data/SaveStatus';

function Shell() {
  const { state } = useAuth();

  // Before sign-in: the full landing page, with its own header and footer.
  if (state.status === 'signed-out' || state.status === 'signing-in') return <LandingPage />;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-header px-4 text-white shadow-md shadow-black/10 sm:px-6">
        <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <img
            src={symbolUrl}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] rounded-lg"
          />
          <span>
            Track
            <span className="bg-gradient-to-r from-accent-1 via-accent-2 to-accent-3 bg-clip-text text-transparent">
              Worth
            </span>
          </span>
        </span>
        {state.status === 'signed-in' && <UserMenu user={state.user} />}
      </header>
      {state.status === 'signed-in' && <SyncStatus />}
      {state.status === 'signed-in' && <SaveStatus />}
      <main className="flex-1">
        {state.status === 'signed-in' ? (
          <Routes />
        ) : (
          <p className="p-6 text-ink-muted">Signing you in…</p>
        )}
      </main>
      <footer className="px-6 py-4 text-center text-xs text-ink-faint">v{config.appVersion}</footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
