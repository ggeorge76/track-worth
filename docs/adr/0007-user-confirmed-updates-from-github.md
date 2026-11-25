---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# User-confirmed, signed self-updates from the latest GitHub Release

## Context and Problem Statement

Requirement: when the owner publishes a release on GitHub, installed copies of the app should
pick up that latest release and update themselves, but only after the user confirms.

## Decision Drivers

- The GitHub Release is the single source of truth for the latest version (ADR-0010).
- SOUL.md: updates are offered, never forced.
- Updates execute code on users' machines, so they must be cryptographically verified.
- No server of our own (ADR-0003).

## Considered Options

1. **Tauri updater plugin** with `latest.json` hosted as a GitHub Release asset
2. A custom updater: query the GitHub API, download the installer, run it
3. No in-app updates. Users download new versions manually.

## Decision Outcome

Chosen option: **1. Tauri updater + GitHub Releases.**

**Publishing** (`.github/workflows/release.yml`): merging the release-please PR creates
release `vX.Y.Z`. CI builds installers for macOS (universal), Windows and Linux. It signs each
update bundle with the **updater private key** (GitHub secret `TAURI_SIGNING_PRIVATE_KEY`),
then uploads the installers, update bundles, signatures and a generated `latest.json` to the
release.

**In the app:**

1. **Discover.** On start and every hour, `checkForUpdate()` asks the updater to fetch
   `https://github.com/ggeorge76/track-worth/releases/latest/download/latest.json` and compare
   it with the running version.
2. **Confirm.** If a newer release exists, a non-blocking banner shows
   "TrackWorth X.Y.Z is available", with **What's new** (opens the GitHub release page in the
   browser), **Later** and **Update and restart**. Nothing is downloaded until the user clicks.
3. **Apply.** The updater downloads the bundle, **verifies its signature against the public
   key embedded in the app** (`tauri.conf.json`), installs it, and the app relaunches. Progress
   is shown. On failure, the user sees a message and can retry.
4. **Later** hides the banner until a newer release appears.

User data is never touched by an update. Schema changes go through migrations (ADR-0006).

### Consequences

- Good, because publishing a GitHub Release is the only step needed to update every install.
- Good, because tampered or unofficial bundles are rejected, even if GitHub or the network
  were compromised.
- Bad, because **losing the updater private key means installed apps can never auto-update
  again**. Users would have to reinstall manually. Back it up (see `docs/setup/releasing.md`).
- Bad, because there is a short window while CI uploads per-OS assets in which `latest.json`
  may not list every platform yet. The check fails quietly and retries an hour later.
  Follow-up: publish the release only after all builds finish (draft releases).

### Confirmation

- `UpdatePrompt.test.tsx` asserts that nothing installs without a click, that install is
  followed by restart, that failure shows a retry, and that **Later** hides the banner.
- `tauri.conf.json` → `plugins.updater` holds the public key and the GitHub endpoint.

## Pros and Cons of the Options

### Custom updater

- Bad, because we'd re-implement signature checks and per-OS installation, which is
  error-prone and security-critical.

### Manual updates

- Bad, because it doesn't meet the requirement.

## More Information

<https://v2.tauri.app/plugin/updater/>
