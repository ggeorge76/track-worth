# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Copilot, Cursor, Gemini, …) working on
TrackWorth. This file follows the [agents.md](https://agents.md) convention. Humans should read
[CONTRIBUTING.md](CONTRIBUTING.md). If you read only one other file, read [SOUL.md](SOUL.md).

## Project in one paragraph

TrackWorth is a personal net-worth tracker. Users **manually** enter account balances (assets
and liabilities) and watch them change over time. It is an **installed desktop app** (Tauri 2:
Rust shell + React UI in the OS webview), with **no server** of any kind. Users sign in with
Google in their browser, and all data lives in their own Google Drive as readable JSON files in
`My Drive/TrackWorth/` (`settings.json`, `accounts.json`, one `balances/<year>.json` per financial
year; ADR-0014), with a local copy on the device. New GitHub Releases are offered in-app as signed
updates that install only after the user confirms. Android comes later, via Tauri mobile.

## Commands

Run these from the repo root. You need **Bun** and the **Rust toolchain**. On macOS, Xcode
Command Line Tools are also required.

| Task                                            | Command                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| Install                                         | `bun install`                                                       |
| Run the desktop app (hot reload)                | `bun run app:dev`                                                   |
| Run the UI only in a browser (no sign-in)       | `bun run dev` → http://localhost:5173                               |
| **Full verification (run before every commit)** | `bun run check`                                                     |
| UI checks only / Rust checks only               | `bun run check:web` / `bun run check:rust`                          |
| Unit tests (Vitest)                             | `bun run test` (watch: `bun run test:watch`)                        |
| Single test file                                | `bunx vitest run src/domain/money.test.ts`                          |
| Rust tests                                      | `cargo test --manifest-path src-tauri/Cargo.toml`                   |
| Lint / autofix                                  | `bun run lint` / `bun run lint:fix`                                 |
| Format (Prettier + rustfmt)                     | `bun run format`                                                    |
| E2E smoke (UI in a browser)                     | `bun run test:e2e` (first time: `bunx playwright install chromium`) |
| Build installers for this OS                    | `bun run app:build`                                                 |

> ⚠️ Use **`bun run test`**, never `bun test`. `bun test` starts Bun's own runner, which is
> deliberately blocked (`bunfig.toml`). Our tests are written for Vitest.

`bun run check` = Prettier check + ESLint + typecheck + Vitest + Vite build + rustfmt check +
Clippy (`-D warnings`) + cargo test. CI runs the same steps. If it fails, fix the root cause.
Never disable a rule, skip a test, add `@ts-ignore`, or add `#[allow(...)]` just to get green.

## Tech stack

Tauri 2 (Rust) · React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · TanStack Query · Zod ·
Recharts · Vitest + Testing Library · Playwright · ESLint (typescript-eslint strict) · Prettier ·
Clippy (pedantic) · Bun. Reasons: [ADR-0002](docs/adr/0002-technology-stack.md).

Don't add a dependency (JS package or Rust crate) without a good reason, and say why in the PR.
Framework-level dependencies (router, state library, UI kit, new Tauri plugin) need an ADR first.

## Repository map

```
src/                     React UI (runs in the Tauri webview)
  app/                   Router (hash routes + back button, ADR-0013), Routes, useToday
  components/            Shared UI: Sheet (popup), Chip, Segmented, LiquidityPicker, icons
  test/                  Builders (made-up data), renderWithData, mockStore, fakeDriveApi
  config.ts              Frontend constants: fixed Drive path, GitHub repo
  domain/                Pure TypeScript: schema (Zod), money, net-worth math. No React, no I/O.
    storage/             How data maps to Drive files: year-file periods, split/assemble, write order
    sync/                Three-way merge for offline changes (ADR-0015)
  services/              Side effects, each with an injectable fetch for tests:
    platform.ts          isDesktopApp(), httpFetch (routes through the Rust HTTP plugin)
    auth/                Calls the Rust auth commands; fetches the user's profile
    drive/               Drive v3 REST client (folders, JSON files, version checks, trash)
    storage/             Data store: load (only changed files), save (only touched files), v2 upgrade
    sync/                Offline-first sync engine: save on device, upload, merge or ask (ADR-0015)
    cache/               On-device storage (IndexedDB): local copy of Drive files + workspace
                         (last synced data, pending changes, display name); cleared on sign-out
    update/              Wraps the Tauri updater + relaunch
  features/data/         useDataFile (load) + useUpdateDataFile (optimistic, serial, conflict-safe save)
  features/<feature>/    Screens + hooks for one feature (accounts, auth, data, settings, update)
  App.tsx, main.tsx      Composition root
src-tauri/               Rust app shell
  src/auth/              Google OAuth: loopback + PKCE, keychain storage, token refresh
  src/config.rs          OAuth client compiled in by build.rs
  capabilities/          What the UI may do: URL allow-lists for HTTP/opener, updater, restart
  tauri.conf.json        Window, CSP, bundle targets, updater public key + endpoint
site/                    Public website on GitHub Pages: homepage, privacy policy, terms
assets/branding/         Logo + symbol masters and exports (see its README)
e2e/                     Playwright specs (UI in a browser, signed-out flows only)
docs/adr/                Architecture Decision Records (MADR 4). Read these before big changes.
docs/                    Requirements, architecture, data model, setup and release guides, roadmap
.github/                 CI, release (multi-OS installers), Dependabot, issue/PR templates
```

Dependency direction: `features → services → domain`, and `features → domain`. `domain/` imports
nothing from the app, `services/` never imports React, and only `services/` imports
`@tauri-apps/*` (except `UpdatePrompt`'s `openUrl`).

## Code conventions

**TypeScript (UI)**

- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Don't use
  `any`. Use `unknown` plus Zod parsing at every trust boundary (Drive JSON, API responses, Rust
  command errors, user input).
- **Money is integer minor units** (`amountMinor`, i.e. cents) plus an ISO 4217 currency. Never
  use floats for money. Use `domain/money.ts`.
- Dates: balance dates are `YYYY-MM-DD`. Timestamps are ISO-8601 UTC.
- Named exports only. Function components plus hooks. Keep logic in hooks or `domain/`.
- Tailwind utilities. Layouts must work from a 380 px wide window (future Android) up to
  desktop.
- Accessibility: semantic elements, labelled controls, keyboard reachable, `role="alert"` for
  errors. Query tests by role or label.
- The UI must keep working in a plain browser (`bun run dev`, e2e). Guard Tauri-only calls
  with `isDesktopApp()`.

**Rust (src-tauri)**

- Keep Rust minimal: only things the webview can't or shouldn't do (OAuth, keychain, updater).
  Product logic belongs in TypeScript.
- Commands return `Result<T, AuthError>`-style errors that serialize to `{ code, message }`.
  Messages are user-facing, plain and token-free.
- No `unwrap()`/`expect()` on runtime data. `expect` is allowed only for static invariants,
  with a message.
- `unsafe` is forbidden (`[lints.rust] unsafe_code = "forbid"`).

**Both:** comments explain _why_, not _what_. Link the ADR when code exists because of a
decision. User-facing errors are plain language and suggest a next step.

## Testing rules

- Every behaviour change needs a test. Bug fixes start with a failing test.
- `domain/`: plain unit tests, aiming for 100% branch coverage.
- `services/`: inject a fake `fetch` (see `src/services/drive/driveClient.test.ts`).
- Tauri APIs in UI tests: `vi.mock('@tauri-apps/api/core')` etc. (see
  `src/features/auth/AuthProvider.test.tsx`).
- Rust: unit-test pure functions in a `#[cfg(test)] mod tests` beside the code.
- Never call real Google or GitHub APIs from tests. Fixtures use made-up data only.

## Data-file contract (read before touching `src/domain/schema.ts`)

The JSON file in the user's Drive is the database, and real users' financial history lives in
it. See [ADR-0006](docs/adr/0006-data-file-schema-and-migrations.md) and
[docs/data-model.md](docs/data-model.md).

- Any shape change bumps `SCHEMA_VERSION` and adds a migration from the previous version, with
  tests that load a fixture of the old version.
- Never rename or remove a field in place. Never change what a field means.
- The app must refuse to write a file whose `schemaVersion` is newer than it understands.
- Writes use optimistic concurrency (Drive `version` check). Never "fix" a conflict by
  overwriting.
- Change data only through `useUpdateDataFile()` with a pure function from `src/domain/`
  (e.g. `createAccount`, `updateAccount`, `upsertBalance`). Never write Drive files directly: the
  data store decides which files to write and in which order (ADR-0014).

## Boundaries

**Always**

- Run `bun run check` before you say a task is done, and report the actual result.
- Keep PRs small and focused on one issue. Update the docs and ADRs your change affects.
- Use Conventional Commits for commit messages and PR titles (`feat(dashboard): …`).

**Ask the human first**

- Adding or upgrading a major dependency or Tauri plugin.
- Changing the privacy policy or terms (`site/`). These are legal commitments linked from
  Google's consent screen. If you change what data the app accesses, flag that the policy
  needs updating.
- Changing OAuth scopes, the Drive folder or file name, the CSP, **capabilities** (URL
  allow-lists, permissions), the updater config, or the release workflow.
- Changing the data-file schema.
- Writing a new ADR or superseding one. Propose it with status `Proposed`.
- Anything in `.github/workflows/`.

**Never**

- Add a server, analytics, telemetry, crash reporting to third parties, ads or trackers.
- Integrate with banks, aggregators (Plaid, etc.) or scrape financial sites. Manual entry is
  the product.
- Expose the refresh token to the UI, or store any token outside the OS keychain (Rust) or
  memory.
- Log or send tokens, emails, account names or balances anywhere (including `console` and
  `log::`).
- Commit secrets, `.env*` (except `.env.example`), `*.key` files or real user data. The updater
  private key lives only in `~/.tauri/` and GitHub secrets.
- Give the webview direct network access (`connect-src` must stay IPC-only), or widen
  capabilities to wildcards.
- Request the full `drive` scope, or touch Drive files the app didn't create.
- Push directly to `main` or `dev`, force-push shared branches, or merge your own PR.

## Git workflow

- Branch from `dev`, using `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>` or
  `chore/<short-name>`.
- Open PRs into `dev`. `dev` is merged into `main` for releases. release-please then cuts the
  version, CHANGELOG and GitHub Release, and CI uploads signed installers. Installed apps then
  offer the update ([ADR-0007](docs/adr/0007-user-confirmed-updates-from-github.md),
  [ADR-0010](docs/adr/0010-versioning-and-release.md)).
- Commit types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
  Breaking changes use `feat!:` or a `BREAKING CHANGE:` footer.
- Fill in the PR template, including the AI disclosure box.

## Definition of done

1. The acceptance criteria in the issue are met.
2. `bun run check` passes, and so does `bun run test:e2e` if the UI shell changed.
3. New or changed behaviour has tests (TypeScript and/or Rust).
4. Docs, ADRs and `.env.example` are updated where relevant.
5. No new lint warnings and no TODOs without a linked issue.
6. The PR description says what changed, why, and how it was verified, including a note if you
   ran the real app with `bun run app:dev`.

## When you're unsure

Read the relevant ADR in `docs/adr/` first. If the answer isn't there, choose the simplest option
that follows SOUL.md, state your assumption in the PR, and flag it for the human. Don't invent
requirements. [docs/product/requirements.md](docs/product/requirements.md) is the source of
truth for features.
