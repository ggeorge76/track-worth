import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { httpFetch } from '@/services/platform';

/**
 * Frontend side of Google sign-in (ADR-0004). The OAuth flow and the refresh token live in Rust
 * (src-tauri/src/auth). This module only ever sees short-lived access tokens, kept in memory.
 */

export interface AccessToken {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

export type AuthErrorCode =
  | 'not-configured'
  | 'cancelled'
  | 'denied'
  | 'scope-denied'
  | 'session-expired'
  | 'not-signed-in'
  | 'keychain'
  | 'network'
  | 'failed';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const rustErrorSchema = z.object({ code: z.string(), message: z.string() });

/** Convert an error rejected by a Tauri command into an AuthError. */
export function toAuthError(err: unknown): AuthError {
  const parsed = rustErrorSchema.safeParse(err);
  if (parsed.success) {
    return new AuthError(parsed.data.message, parsed.data.code as AuthErrorCode);
  }
  return new AuthError('Sign-in failed. Please try again.', 'failed');
}

async function call<T>(command: string): Promise<T> {
  try {
    return await invoke<T>(command);
  } catch (err) {
    throw toAuthError(err);
  }
}

/** Opens the system browser for Google sign-in and waits for the result. */
export const signIn = () => call<AccessToken>('auth_sign_in');

/** Silent sign-in at startup. Resolves null when the user must sign in. */
export const restoreSession = () => call<AccessToken | null>('auth_restore');

/** A valid access token, refreshed by Rust when close to expiry. */
export const getAccessToken = async () =>
  (await call<AccessToken>('auth_access_token')).accessToken;

export const signOut = () => call<undefined>('auth_sign_out');

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const userInfoSchema = z.object({
  name: z.string().optional(),
  given_name: z.string().optional(),
  email: z.string(),
  picture: z.string().optional(),
});

export async function fetchUserProfile(
  accessToken: string,
  fetchImpl: typeof fetch = httpFetch,
): Promise<GoogleUser> {
  const res = await fetchImpl(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new AuthError(`Couldn't load your Google profile (${res.status}).`, 'failed');
  const info = userInfoSchema.parse(await res.json());
  const user: GoogleUser = { name: info.name ?? info.given_name ?? info.email, email: info.email };
  if (info.picture) user.picture = info.picture;
  return user;
}
