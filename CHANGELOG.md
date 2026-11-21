# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). From the first release on, this file is maintained
by release-please from Conventional Commit messages. Don't edit released sections by hand.

## [0.1.0] - Unreleased

### Added

- Tauri 2 desktop app with a React + TypeScript + Vite UI, managed with Bun.
- Google sign-in in the system browser (loopback + PKCE). The refresh token is kept in the OS
  keychain, and the user's name is shown.
- Load or create `My Drive/TrackWorth/trackworth-data.json` with conflict-safe saves.
- Versioned data-file schema with validation; net-worth and money helpers.
- Signed, user-confirmed self-updates from the latest GitHub Release.
- CI (UI + Rust gates, Playwright) and a release pipeline building macOS, Windows and Linux
  installers.
- Agent docs (AGENTS.md, SOUL.md, CLAUDE.md), ADRs 0001–0012, contribution templates.
