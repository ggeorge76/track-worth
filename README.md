# TrackWorth

A desktop app for tracking your account balances and net worth by hand. Your data is one JSON
file in **your own Google Drive**. There's no server, no bank connection and no tracking.

> **Status:** early development (M0 scaffolding complete). See the [roadmap](docs/roadmap.md).

## Features

- Installed app for macOS, Windows and Linux (Tauri: small and fast). Android is planned.
- Sign in with Google in your browser. You stay signed in, and your name is shown in the app.
- Data lives in `My Drive/TrackWorth/` as readable JSON files, one per financial year, created on
  first use. Saves only touch the files that changed, and a local copy keeps start-up fast.
- Accounts with tags, liquidity (1–5), currency, balance source and notes. Sort, filter and
  group the list; swipe between accounts in balance-source order.
- Manual balance entries for assets and liabilities, with change since the last entry, last
  month and last financial year, plus all-time high. Charts _(next)_.
- **Self-updating from GitHub Releases.** When a new release is published, the app offers it and
  installs only after you confirm. Updates are signature-verified.

## Install

Download the installer for your OS from the
[latest release](https://github.com/ggeorge76/track-worth/releases/latest). The app isn't
code-signed yet, so the first time you open it:

- **macOS:** right-click the app, choose **Open**, then **Open** again.
- **Windows:** on the SmartScreen warning, click **More info → Run anyway**.

## Develop

Prerequisites: [Bun](https://bun.sh), [Rust](https://rustup.rs), and the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) (on macOS: Xcode Command
Line Tools).

```bash
bun install
cp .env.example .env.local   # add your Google OAuth Desktop client (docs/setup/google-cloud.md)
bun run app:dev              # opens the desktop app with hot reload
```

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `bun run app:dev`   | Run the desktop app                                                  |
| `bun run dev`       | Run just the UI in a browser (no sign-in)                            |
| `bun run check`     | Everything CI checks: format, lint, types, tests, build, Rust checks |
| `bun run test`      | Unit and component tests (Vitest). Not `bun test`.                   |
| `bun run test:e2e`  | Playwright smoke test                                                |
| `bun run app:build` | Build installers for your OS                                         |

## Tech stack

Tauri 2 (Rust) · React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · TanStack Query · Zod ·
Recharts · Vitest · Playwright · Bun. See [ADR-0002](docs/adr/0002-technology-stack.md) for the
reasoning.

## How it works

```
TrackWorth (on your computer)
 ├─ React UI (OS webview, no direct internet access)
 └─ Rust shell ──► Google sign-in (your browser) · refresh token in your OS keychain
              ──► Google Drive: TrackWorth/{settings,accounts}.json + balances/<year>.json
              ──► GitHub Releases: latest.json → signed update, installed when you confirm
```

Website: [home](https://ggeorge76.github.io/track-worth/) ·
[privacy policy](https://ggeorge76.github.io/track-worth/privacy/) ·
[terms](https://ggeorge76.github.io/track-worth/terms/) (source in `site/`).

More detail: [architecture](docs/architecture.md) · [data model](docs/data-model.md) ·
[ADRs](docs/adr/README.md) · [security](SECURITY.md) · [releasing](docs/setup/releasing.md).

## Contributing

This project is developed mostly by AI agents with human review. Start with
[AGENTS.md](AGENTS.md), [SOUL.md](SOUL.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
