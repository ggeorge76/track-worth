# Security policy

## Reporting a vulnerability

Please **don't open a public issue.** Report privately via
[GitHub Security Advisories](https://github.com/ggeorge76/track-worth/security/advisories/new).
You'll get an acknowledgement within 7 days. Never include real financial data or tokens in a
report.

## Supported versions

Only the latest release is supported. The app offers updates in-app (ADR-0007).

## Security model

TrackWorth is a local desktop app with **no server** (ADR-0003).

| Asset                      | Protection                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Google refresh token       | Stored only in the OS keychain by Rust. It never reaches the UI. Revoked on sign-out (ADR-0004).                                    |
| Google access token        | About 1 h lifetime, cached in Rust memory, handed to the UI on demand, never persisted.                                             |
| OAuth flow                 | System browser + loopback redirect on 127.0.0.1 + PKCE (S256) + random `state` check.                                               |
| Access to the user's Drive | `drive.file` scope only: the app sees only files it created (ADR-0005).                                                             |
| Financial data             | Stays in the user's Drive and in memory. Never logged or sent elsewhere. There are no analytics.                                    |
| Data integrity             | Zod validation on load, refusal of newer schemas, Drive version check before every write (ADR-0006).                                |
| UI compromise (XSS)        | React escaping, a strict CSP with no direct network access (`connect-src` is IPC only), and least-privilege Tauri capabilities.     |
| Updates                    | Every update bundle is signed. The app verifies it against the embedded public key before installing (ADR-0007).                    |
| Supply chain               | Lockfiles (`bun.lock`, `Cargo.lock`), Dependabot (bun, cargo, actions), minimal dependencies, least-privilege workflow permissions. |

### What the UI is allowed to reach

The UI can't open network connections itself. It can only ask Rust to fetch these URLs
(`src-tauri/capabilities/default.json`):

- `https://www.googleapis.com/drive/v3/*` and `https://www.googleapis.com/upload/drive/v3/*`
- `https://openidconnect.googleapis.com/v1/userinfo`

It may also open `https://github.com/ggeorge76/track-worth/*` in the user's browser (release
notes). Changing any of these requires owner approval and an update to this file.

### Secrets

| Secret                          | Where it lives                                       | Notes                                                                 |
| ------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Updater private key             | `~/.tauri/trackworth.key` + GitHub secret            | **Critical.** Anyone holding it can ship updates. Back it up offline. |
| Google OAuth client ID / secret | `.env.local` + GitHub secrets, compiled into the app | Desktop-client secrets are not confidential by Google's design.       |

Never commit secrets, never log tokens, emails, account names or balances, and never widen
OAuth scopes, the CSP or capabilities without an ADR.
