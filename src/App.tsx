import { hrefFor } from './app/router';
import { Routes } from './app/Routes';
import { SettingsIcon } from './components/icons';
import { config, symbolUrl } from './config';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/authContext';
import { SignOutButton } from './features/auth/SignOutButton';
import { LandingPage } from './features/landing/LandingPage';
import { SyncStatus } from './features/data/SyncStatus';
import { SaveStatus } from './features/data/SaveStatus';

function Shell() {
  const { state } = useAuth();

  // Before sign-in: the full landing page, with its own header and footer.
  if (state.status === 'signed-out' || state.status === 'signing-in') return <LandingPage />;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="flex items-center gap-2 font-semibold text-teal-800">
          <img src={symbolUrl} alt="" width={28} height={28} className="h-7 w-7" />
          TrackWorth
        </span>
        {state.status === 'signed-in' && (
          <div className="flex items-center gap-3 text-sm">
            <span>{state.user.name}</span>
            <a
              href={hrefFor({ name: 'settings' })}
              aria-label="Settings"
              title="Settings"
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <SettingsIcon />
            </a>
            <SignOutButton />
          </div>
        )}
      </header>
      {state.status === 'signed-in' && <SyncStatus />}
      {state.status === 'signed-in' && <SaveStatus />}
      <main className="flex-1">
        {state.status === 'signed-in' ? (
          <Routes />
        ) : (
          <p className="p-6 text-slate-500">Signing you in…</p>
        )}
      </main>
      <footer className="px-6 py-3 text-xs text-slate-400">v{config.appVersion}</footer>
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
