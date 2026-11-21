---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Distribute desktop installers through GitHub Releases

## Context and Problem Statement

TrackWorth is an installed app (ADR-0003) for macOS, Windows and Linux. Where do users get it,
and in which formats?

## Decision Drivers

- No hosting of our own.
- One place for downloads, release notes and auto-updates (ADR-0007).
- Low cost for a personal project.

## Considered Options

- GitHub Releases
- OS app stores (Mac App Store, Microsoft Store, Flathub)
- A download website

## Decision Outcome

Chosen option: **GitHub Releases.** Each release carries:

| OS      | Installer                                 | Update bundle (signed) |
| ------- | ----------------------------------------- | ---------------------- |
| macOS   | `.dmg` (universal: Apple Silicon + Intel) | `.app.tar.gz` + `.sig` |
| Windows | NSIS `-setup.exe` and `.msi`              | NSIS `.exe` + `.sig`   |
| Linux   | `.AppImage`, `.deb`, `.rpm`               | `.AppImage` + `.sig`   |

plus `latest.json` for the updater.

**OS code signing** (separate from the updater signature) is **not set up yet**:

- macOS shows "unidentified developer" on first launch. Workaround: right-click the app, then
  choose **Open**. Fixing it requires an Apple Developer ID ($99 per year) and notarization in
  CI.
- Windows SmartScreen shows "Windows protected your PC". Workaround: **More info → Run
  anyway**. Fixing it requires a code-signing certificate (Azure Trusted Signing or an OV/EV
  certificate).

Either can be added later through `tauri-action` env vars, without code changes (new ADR).

### Consequences

- Good, because there is no cost, and downloads, notes and updates live in one place.
- Bad, because there are first-launch OS warnings until we pay for code signing. Fine for
  personal use, but worth fixing before sharing widely.

### Confirmation

Release workflow job `desktop` (matrix over macOS, Windows and Linux).
