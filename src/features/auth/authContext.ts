import { createContext, useContext } from 'react';
import type { GoogleUser } from '@/services/auth/desktopAuth';

export type AuthState =
  | { status: 'restoring' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signing-in' }
  /** `offline`: Google couldn't be reached at start; showing the device's copy (ADR-0015). */
  | { status: 'signed-in'; user: GoogleUser; offline?: boolean };

export interface AuthContextValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** A valid access token for Google APIs. Signs the user out if the session has expired. */
  getAccessToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
