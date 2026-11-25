---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Technology stack: Tauri 2 desktop app with a React + TypeScript + Vite UI, managed with Bun

## Context and Problem Statement

TrackWorth must be an **installed desktop app**, not hosted on any server, with Android to
follow. It is developed almost entirely by AI agents, with a human reviewing. Which stack gives
a web-style UI codebase, small native installers, a path to Android, strong agent proficiency,
and mechanical checks that catch agent mistakes?

## Decision Drivers

- **Installed app, no hosting.** The app runs locally (ADR-0003).
- **Lightweight.** Small download, low memory use.
- **Web-style UI**, so the same code can serve desktop now and Android later.
- **AI proficiency.** Agents write the most correct code in mainstream, well-documented stacks.
- **Mechanical verification.** Strong types and fast tests on both sides (UI and native).
- **Longevity.** Mainstream, actively maintained, low churn.

## Considered Options

1. **Tauri 2** (Rust shell + system webview) + React/TypeScript/Vite, with **Bun** for tooling
2. **Electron** + React/TypeScript/Vite
3. **Flutter** (desktop + Android)
4. **Wails** (Go shell + system webview)
5. **.NET MAUI / Avalonia**

## Decision Outcome

Chosen option: **1. Tauri 2 + React + TypeScript + Vite, with Bun.**

| Concern                   | Choice                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| App shell                 | **Tauri 2** (Rust). Uses the OS webview (WebKit on macOS/Linux, WebView2 on Windows).                          |
| UI language               | TypeScript, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`                               |
| UI framework              | React 19 (function components + hooks)                                                                         |
| UI build/dev              | Vite                                                                                                           |
| Styling                   | Tailwind CSS v4                                                                                                |
| Data loading              | TanStack Query (Drive load/save, caching, retries)                                                             |
| Validation                | Zod (data file, API responses, Rust errors, forms)                                                             |
| Charts                    | Recharts                                                                                                       |
| Native side               | Rust: Google sign-in (ADR-0004), keychain, HTTP for Google APIs, updater                                       |
| Tauri plugins             | `updater`, `process`, `http`, `opener` (all official)                                                          |
| Package manager / scripts | **Bun** (fast installs, one tool). Tests still run on **Vitest** (`bun run test`).                             |
| Unit/component test       | Vitest + Testing Library + jsdom. Rust: `cargo test`.                                                          |
| E2E                       | Playwright against the UI in a browser (signed-out shell)                                                      |
| Lint/format               | ESLint (typescript-eslint `strictTypeChecked`) + Prettier. Rust: `rustfmt` + Clippy (pedantic, `-D warnings`). |
| Android (later)           | Tauri 2 mobile (ADR-0009)                                                                                      |
| Routing                   | Deferred. Add one when there is more than one screen (needs an ADR).                                           |

### Consequences

- Good, because installers are small (about 6 MB compressed on macOS versus 100+ MB for
  Electron), memory use is low, and there is no server.
- Good, because the UI is ordinary React. Agents work in TypeScript almost all the time, and
  the Rust surface is small and isolated (`src-tauri/src/auth`).
- Good, because a built-in updater, keychain access and a permission system (capabilities) cover
  our needs without custom native code.
- Bad, because building requires the Rust toolchain, and the webview differs per OS (Safari-ish
  WebKit vs Chromium), so UI code must avoid bleeding-edge web APIs (`build.target` is set
  accordingly).
- Bad, because unsigned installers show OS warnings until we buy code-signing certificates
  (ADR-0008).

### Confirmation

`bun run check` runs the web gates and the Rust gates (fmt, Clippy, tests) and is mirrored in CI.

## Pros and Cons of the Options

### Electron

- Good, because it is the most mature option and renders identically everywhere (bundled
  Chromium).
- Bad, because it is heavy (about 100+ MB installers and high memory use) and has no Android
  path.

### Flutter

- Good, because it is a single codebase for desktop and Android.
- Bad, because the UI is not web-based and Dart has less agent training data.

### Wails

- Good, because it is light and similar to Tauri.
- Bad, because it has a smaller ecosystem, no official updater and no mobile support.

### .NET MAUI / Avalonia

- Bad, because it is not web-structured, it is heavier, and agents are less fluent in it.

## More Information

Bun is used only as the package manager and script runner. `bun test` is blocked on purpose (see
`bunfig.toml`) because the test suite is written for Vitest.
