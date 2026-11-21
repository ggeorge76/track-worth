---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Google OAuth in the system browser (loopback + PKCE), refresh token in the OS keychain

## Context and Problem Statement

Users sign in with Google. We need (a) the user's display name and (b) access tokens that can
read and write their Drive data file. Users shouldn't have to sign in on every launch, and
tokens must stay safe on the device.

## Decision Drivers

- Google's guidance for installed apps: use the system browser, not an embedded webview, with
  a loopback redirect and PKCE.
- Least privilege. Avoid "restricted" scopes, which need a paid security assessment.
- A compromise of the UI layer (XSS) must not be able to steal long-lived credentials.
- Stay signed in across launches.

## Considered Options

1. Rust-side OAuth: **system browser + loopback redirect + PKCE**, refresh token in the **OS
   keychain**
2. Google Identity Services (web token model) inside the webview
3. A community Tauri OAuth plugin with a frontend-driven flow
4. Custom URI scheme / deep-link redirect

## Decision Outcome

Chosen option: **1.** Implemented in `src-tauri/src/auth/`.

- **Client:** a Google OAuth client of type **Desktop app**. Its ID and secret are compiled in
  by `build.rs` from env vars (CI secrets or `.env.local`). Google does not treat installed-app
  secrets as confidential. PKCE protects the flow.
- **Scopes:** `openid email profile https://www.googleapis.com/auth/drive.file`, all
  non-sensitive (ADR-0005). If the user unticks Drive access on the consent screen, sign-in
  fails with a clear message and the token is revoked.
- **Flow:**
  1. Rust binds `127.0.0.1:<random port>` and generates a PKCE verifier and challenge plus a
     random `state`.
  2. It opens the Google consent page in the default browser.
  3. Google redirects to the loopback address. Rust checks `state` and exchanges the code (with
     the verifier) for tokens.
- **Storage:** the **refresh token** goes in the OS keychain (macOS Keychain, Windows
  Credential Manager, Linux Secret Service) via `keyring`. It never reaches the webview.
- **Access tokens** (about 1 hour) are cached in Rust memory. The UI asks for one with
  `auth_access_token`, and Rust refreshes it 60 seconds before expiry.
- **Startup:** `auth_restore` silently refreshes using the keychain token. If Google says
  `invalid_grant` (revoked or expired), the stored token is deleted and the sign-in screen is
  shown.
- **Name:** the UI calls the OIDC userinfo endpoint (through the Rust HTTP plugin) and shows
  `name`, falling back to `given_name`, then `email`.
- **Sign-out** revokes the refresh token at Google and deletes it from the keychain.

### Consequences

- Good, because this is Google's recommended pattern. The user sees the real Google page in
  their own browser (password managers and passkeys work, and there's no phishing-prone
  embedded login).
- Good, because users stay signed in across launches, and the long-lived secret sits in
  OS-protected storage outside the webview.
- Bad, because there is more Rust code to own, about 400 lines with unit tests including a
  real TCP loopback test.
- Bad, because Android can't use the loopback flow or `keyring` in the same way and will need a
  platform-specific path (ADR-0009).

### Confirmation

- Rust tests: PKCE RFC 7636 vector, callback parsing (state mismatch, denial), the token-error
  mapping, and the loopback server over TCP.
- AGENTS.md forbids persisting tokens anywhere else or exposing refresh tokens to the UI.

## Pros and Cons of the Options

### GIS in the webview

- Bad, because Google blocks sign-in in embedded webviews and GIS popups don't work in Tauri. It
  also only provides about one hour of access with no refresh token.

### Community plugin

- Good, because it would mean less code.
- Bad, because it adds a third-party dependency in the most security-sensitive path, and the
  flow would be driven from the webview.

### Deep-link redirect

- Bad, because Google doesn't allow custom URI schemes for Desktop clients. Loopback is the
  supported option.

## More Information

<https://developers.google.com/identity/protocols/oauth2/native-app>. Setup:
`docs/setup/google-cloud.md`.
