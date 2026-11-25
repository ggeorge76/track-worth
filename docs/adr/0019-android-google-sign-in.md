---
status: Proposed
date: 2026-11-25
decision-makers: [project owner]
---

# Android sign-in with Google's native authorization API, with no stored tokens

## Context and Problem Statement

The desktop app signs in through the system browser with a loopback redirect and PKCE, and keeps
the refresh token in the OS keychain (ADR-0004). Neither part fits Android:

- **Loopback:** a loopback listener on a phone is fragile, because the OS may stop the app while
  the browser is open.
- **Recommended flows:** Google recommends its native sign-in APIs for Android, and no longer
  supports custom-scheme redirects for Android OAuth clients.
- **Keychain:** there is no keychain the `keyring` crate can use, so the app currently shows
  "Couldn't access the system keychain".

How should the Android app get Drive access tokens, and stay signed in, safely?

## Decision Drivers

- Follow Google's current guidance for Android (Android OAuth client, package name + SHA-1).
- Same scopes as desktop, nothing broader: `drive.file`, `openid`, `email`, `profile`
  (ADR-0004).
- A compromised UI (XSS) must not be able to steal long-lived credentials.
- Stay signed in across launches, and show the standard Google account picker.
- No server, no client secret in the app (SOUL.md).
- Few dependencies, and only from Google or Tauri.

## Considered Options

1. **Google Identity Services `AuthorizationClient`** (play-services-auth), called from a
   small Tauri plugin of our own written in Kotlin. Google keeps the grant; the app keeps no token.
2. The desktop loopback flow on the phone (system browser + local listener), with the refresh
   token in the Android Keystore.
3. A community Tauri Google sign-in plugin.
4. Credential Manager "Sign in with Google" alone.

## Decision Outcome

Chosen option: **1**.

- **How it works:**
  - **First sign-in:** `Identity.getAuthorizationClient(activity).authorize(...)` asks for
    `drive.file openid email profile`. The first time, it shows Google's account picker and consent
    (a pending intent the plugin launches). The result carries an **access token** (about 1 hour).
  - **Later:** calling `authorize` again with the same scopes returns a fresh token
    **silently**, because Google Play services keeps the user's grant. So the app stores **no
    refresh token or other secret**. The only thing remembered is a flag "signed in on this
    device" (plain app preferences), so startup knows to ask silently instead of showing the
    landing page.
  - **Token use:** access tokens stay in Rust memory, as on desktop, and are handed to the UI
    only through `auth_access_token`, as today. When a token is rejected, the plugin calls
    `clearToken` and asks again.
  - **Sign-out:** `revokeAccess(...)` removes the grant, and the flag is cleared. Revoking on
    desktop works through Google as before.
- **Code layout:**
  - **Our own Tauri plugin,** `src-tauri/plugins/google-auth`: Kotlin for Android, with a small
    Rust bridge. No third-party plugin.
  - **The Rust auth commands keep their names** (`auth_sign_in`, `auth_restore`,
    `auth_access_token`, `auth_sign_out`), so `services/auth` and the UI don't change.
  - **On desktop** they use ADR-0004's code. `keyring` and the loopback server compile for desktop
    only.
  - **On Android** they call the plugin.
- **New dependency:** `com.google.android.gms:play-services-auth` (Google's own library; Gradle,
  Android only). The plugin has no permissions beyond what Play services needs.
- **Google Cloud:** an **Android OAuth client** for `com.trackworth.app`, already created with
  the debug key's SHA-1. A second fingerprint (Play App Signing) is added before release. The
  consent screen and scopes are shared with desktop.
- **iOS later:** the same plugin shape with Google's iOS sign-in SDK, and an iOS OAuth client for
  the same ID.

### Consequences

- Good: Google's recommended flow, with the familiar account picker and no browser round trip.
- Good: no secrets stored on the phone at all, so nothing to leak and no Keystore code to
  maintain.
- Good: the UI and services are unchanged; only Rust swaps the platform implementation.
- Bad: needs Google Play services on the phone. Play-certified phones have it; de-Googled phones
  can't sign in.
- Bad: a small amount of Kotlin to maintain, and one new Google library.

### Confirmation

- Rust unit tests still cover the desktop flow; the Android path is checked on a real phone
  (sign in, restart, still signed in, sign out, revoked).
- `cargo clippy` for both the desktop and `aarch64-linux-android` targets.
- No token is written to disk on Android (review: only the "signed in" flag is stored).

## Pros and Cons of the Options

### Option 2: loopback + Keystore

- Good, because it reuses most of the desktop code.
- Bad, because Android may stop the app while the browser is open, which breaks the redirect.
  It also needs Keystore-encrypted storage for the refresh token, and isn't Google's recommended
  Android flow.

### Option 3: community plugin

- Good, because it's less code for us.
- Bad, because it's unvetted code holding the user's Google tokens. Our own plugin is small
  enough to own.

### Option 4: Credential Manager only

- Good, because it's the modern "Sign in with Google" button.
- Bad, because it only proves who the user is (an ID token). It gives no Drive access token, so
  `AuthorizationClient` is needed anyway.

## More Information

- [Authorize access to Google user data (Android)](https://developer.android.com/identity/authorization)
- ADR-0004 (desktop sign-in), ADR-0009 (Android via Tauri mobile).
