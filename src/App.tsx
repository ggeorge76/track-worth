import { config } from './config';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/authContext';
import { SignInScreen } from './features/auth/SignInScreen';
import { Dashboard } from './features/dashboard/Dashboard';

function Shell() {
  const { state, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-900">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold text-teal-800">TrackWorth</span>
        {state.status === 'signed-in' && (
          <div className="flex items-center gap-3 text-sm">
            <span>{state.user.name}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-slate-500 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="flex-1">
        {state.status === 'signed-in' ? (
          <Dashboard />
        ) : state.status === 'restoring' ? (
          <p className="p-6 text-slate-500">Signing you in…</p>
        ) : (
          <SignInScreen />
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
