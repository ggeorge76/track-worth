---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Local desktop app with no TrackWorth server

## Context and Problem Statement

Data must be stored as a JSON file in the user's Google Drive, balances are entered manually,
and the owner does not want to host the app anywhere. Do we need any server of our own?

## Decision Drivers

- SOUL.md: the user owns their data, and privacy comes from the architecture.
- No hosting cost or operations work.
- Google OAuth and Drive can be called directly from an installed app.

## Considered Options

- Installed desktop app only. It talks directly to Google and GitHub.
- A hosted web app (static site)
- A backend that holds tokens and proxies Drive

## Decision Outcome

Chosen option: **installed desktop app only.** The app runs entirely on the user's device. Its
only network traffic is:

| Destination                     | From      | Why                             |
| ------------------------------- | --------- | ------------------------------- |
| `accounts.google.com`           | browser   | Google sign-in page             |
| `oauth2.googleapis.com`         | Rust      | token exchange, refresh, revoke |
| `openidconnect.googleapis.com`  | Rust HTTP | user's display name             |
| `www.googleapis.com` (Drive v3) | Rust HTTP | read/write the data file        |
| `github.com` (Releases)         | Rust      | `latest.json` + update bundles  |

The webview itself has **no direct network access**. Its CSP only allows Tauri IPC. All HTTP
goes through Rust, limited to the URL allow-list in `src-tauri/capabilities/default.json`.

### Consequences

- Good, because there is no server to run, secure, pay for or breach, and we never see user data.
- Good, because the attack surface is small and explicit (capability allow-lists + CSP).
- Bad, because there is no server-side conflict resolution. We rely on Drive file versions
  (ADR-0005).
- Bad, because every user installs and updates the app (handled by ADR-0007).

### Confirmation

AGENTS.md "Never" list forbids adding a backend. The CSP in `src-tauri/tauri.conf.json` and the
HTTP allow-list in `src-tauri/capabilities/default.json` enumerate every permitted destination.

## Pros and Cons of the Options

### Hosted web app

- Good, because there is nothing to install.
- Bad, because it needs hosting, which the owner explicitly doesn't want.

### Backend

- Bad, because it becomes a custodian of tokens that grant access to users' Drives, which
  contradicts SOUL.md and adds operations work.
