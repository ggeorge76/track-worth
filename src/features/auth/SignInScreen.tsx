import { isDesktopApp } from '@/services/platform';
import { logoUrl } from '@/config';
import { useAuth } from './authContext';

export function SignInScreen() {
  const { state, signIn } = useAuth();

  return (
    <section className="mx-auto mt-16 max-w-md space-y-6 px-6 text-center">
      {/* Decorative: the heading below carries the name for screen readers. */}
      <img src={logoUrl} alt="" width={128} height={128} className="mx-auto h-32 w-32" />
      <h1 className="text-3xl font-semibold">TrackWorth</h1>
      <p className="text-slate-600">
        Track your account balances by hand. Your data is saved in a TrackWorth folder in your own
        Google Drive. TrackWorth never connects to your bank.
      </p>
      {isDesktopApp() ? (
        <>
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={state.status === 'signing-in'}
            className="rounded-lg bg-teal-700 px-5 py-2.5 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {state.status === 'signing-in' ? 'Waiting for Google…' : 'Sign in with Google'}
          </button>
          {state.status === 'signing-in' && (
            <p className="text-sm text-slate-500">
              Finish signing in in your browser, then come back here.
            </p>
          )}
        </>
      ) : (
        <p role="note" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          You’re viewing TrackWorth in a browser. Sign-in only works in the desktop app (
          <code>bun run app:dev</code>).
        </p>
      )}
      {state.status === 'signed-out' && state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </section>
  );
}
