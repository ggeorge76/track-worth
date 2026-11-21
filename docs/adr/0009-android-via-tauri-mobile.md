---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Build the Android app with Tauri 2 mobile

## Context and Problem Statement

Android comes after desktop. How do we ship it without a second codebase?

## Decision Drivers

- One codebase (ADR-0002).
- Desktop now, without blocking Android later.

## Considered Options

- Tauri 2 mobile (same project, `tauri android`)
- Capacitor wrapping the same UI
- A native rewrite

## Decision Outcome

Chosen option: **Tauri 2 mobile.** The same `src-tauri` project and React UI target Android via
`bun run tauri android init` / `build`. Icons for Android are already generated
(`src-tauri/icons/android`).

Known work items, each needing its own issue and ADR where noted:

- **Sign-in (ADR).** The loopback flow and `keyring` are desktop-only. Android needs a
  platform-specific auth implementation behind the same four Tauri commands, for example
  Android Credential Manager / Google Sign-In via a mobile plugin, with tokens kept in the
  Android Keystore. The UI doesn't change.
- **Updates.** The Tauri updater is desktop-only. Use Play In-App Updates (if published on
  Play) or a GitHub-Release APK download handed to the system installer, always user-confirmed
  (ADR-0007).
- **Platform seams.** Keep platform-specific code behind `#[cfg(desktop)]` / `#[cfg(mobile)]`
  in Rust and behind `services/` in the UI.

### Consequences

- Good, because it reuses 100% of the UI and domain code, with one toolchain.
- Bad, because Tauri mobile is younger than Capacitor, and auth and updates need Android-specific
  code.

## Pros and Cons of the Options

### Capacitor

- Good, because it is mature on mobile.
- Bad, because it would be a second shell and toolchain alongside Tauri, with duplicated native
  glue.
