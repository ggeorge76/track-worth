import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as auth from '@/services/auth/desktopAuth';
import { isDesktopApp } from '@/services/platform';
import { AuthContext, type AuthContextValue, type AuthState } from './authContext';

const asAuthError = (err: unknown) => (err instanceof auth.AuthError ? err : auth.toAuthError(err));

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    isDesktopApp() ? { status: 'restoring' } : { status: 'signed-out' },
  );

  const resetToSignedOut = useCallback(
    (error?: string) => {
      // Drop every cached query so no balances survive into the next (possibly different) user.
      queryClient.clear();
      setState(error ? { status: 'signed-out', error } : { status: 'signed-out' });
    },
    [queryClient],
  );

  // Silent sign-in at startup with the refresh token kept in the OS keychain.
  useEffect(() => {
    if (!isDesktopApp()) return;
    // An object (not a boolean) so the async closure sees the cleanup's write.
    const run = { cancelled: false };
    void (async () => {
      try {
        const token = await auth.restoreSession();
        if (!token) {
          if (!run.cancelled) setState({ status: 'signed-out' });
          return;
        }
        const user = await auth.fetchUserProfile(token.accessToken);
        if (!run.cancelled) setState({ status: 'signed-in', user });
      } catch (err) {
        if (!run.cancelled) setState({ status: 'signed-out', error: asAuthError(err).message });
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setState({ status: 'signing-in' });
    try {
      const token = await auth.signIn();
      const user = await auth.fetchUserProfile(token.accessToken);
      setState({ status: 'signed-in', user });
    } catch (err) {
      setState({ status: 'signed-out', error: asAuthError(err).message });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await auth.signOut();
    } catch {
      // Still sign out locally; worst case the token expires on its own.
    }
    resetToSignedOut();
  }, [resetToSignedOut]);

  const getAccessToken = useCallback(async () => {
    try {
      return await auth.getAccessToken();
    } catch (err) {
      const error = asAuthError(err);
      if (error.code === 'session-expired' || error.code === 'not-signed-in') {
        resetToSignedOut(error.message);
      }
      throw error;
    }
  }, [resetToSignedOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, getAccessToken }),
    [state, signIn, signOut, getAccessToken],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
