import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as auth from '@/services/auth/desktopAuth';
import { fileCache } from '@/services/cache/fileCache';
import { workspace } from '@/services/cache/workspace';
import { OFFLINE_RETRY_MS } from '@/features/data/useDataFile';
import { isDesktopApp } from '@/services/platform';
import { AuthContext, type AuthContextValue, type AuthState } from './authContext';

const asAuthError = (err: unknown) => (err instanceof auth.AuthError ? err : auth.toAuthError(err));

/**
 * Silent sign-in with the refresh token kept in the OS keychain. If Google can't be reached and
 * this device has signed in before, open in offline mode with the saved name (ADR-0015).
 */
async function restoreState(): Promise<AuthState> {
  try {
    const token = await auth.restoreSession();
    if (!token) return { status: 'signed-out' };
    const user = await auth.fetchUserProfile(token.accessToken);
    await workspace.saveUser(user);
    return { status: 'signed-in', user };
  } catch (err) {
    // Not an AuthError means the profile request itself failed to connect.
    const unreachable = !(err instanceof auth.AuthError) || err.code === 'network';
    const cachedUser = unreachable ? await workspace.loadUser() : undefined;
    return cachedUser
      ? { status: 'signed-in', user: cachedUser, offline: true }
      : { status: 'signed-out', error: asAuthError(err).message };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    isDesktopApp() ? { status: 'restoring' } : { status: 'signed-out' },
  );

  const resetToSignedOut = useCallback(
    (error?: string) => {
      // Drop all in-memory data and the on-device copy (ADR-0014), so no balances survive into
      // the next (possibly different) user.
      queryClient.clear();
      void fileCache.clear();
      void workspace.clear();
      setState(error ? { status: 'signed-out', error } : { status: 'signed-out' });
    },
    [queryClient],
  );

  // Silent sign-in at startup (see `restoreState`).
  useEffect(() => {
    if (!isDesktopApp()) return;
    // An object (not a boolean) so the async callback sees the cleanup's write.
    const run = { cancelled: false };
    void restoreState().then((next) => {
      if (!run.cancelled) setState(next);
    });
    return () => {
      run.cancelled = true;
    };
  }, []);

  // While in offline mode, keep trying to sign in properly: when the connection returns and every
  // 30 seconds.
  const offline = state.status === 'signed-in' && state.offline === true;
  useEffect(() => {
    if (!offline) return;
    const retry = () => {
      void restoreState().then(setState);
    };
    window.addEventListener('online', retry);
    const timer = setInterval(retry, OFFLINE_RETRY_MS);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [offline]);

  const signIn = useCallback(async () => {
    setState({ status: 'signing-in' });
    try {
      const token = await auth.signIn();
      // An interactive sign-in may be a different Google account: start from a clean local copy.
      await Promise.all([fileCache.clear(), workspace.clear()]);
      const user = await auth.fetchUserProfile(token.accessToken);
      await workspace.saveUser(user);
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
