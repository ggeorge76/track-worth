# Roadmap

Milestones in order. Each bullet should become one **Agent task** issue (one PR). Requirement IDs
refer to [product/requirements.md](product/requirements.md).

## M0: Scaffolding ✅

- Tauri 2 desktop app, React UI, Bun tooling, quality gates (UI + Rust), CI, release pipeline
- Google sign-in in the browser (loopback + PKCE), keychain-backed session, user name in header
- Drive load/create at the fixed path with conflict-safe save client
- Signed, user-confirmed self-update from the latest GitHub Release
- Agent docs and ADRs

## M1: Core tracking (MVP) ✅ (pending first release)

Delivered as three PRs, each merged before the next:

1. **Data format v2 + saving** ✅ (#2): tags, liquidity, balance source, signed balances, settings
   (financial year, custom tags), v1 → v2 migration, account/balance operations, balance
   stats, conflict-safe save pipeline (R-A6, R-B5, R-C1/2/5/6 data, R-S6 data, R-V2/3/8 logic).
2. **Start page + create account** ✅ (#3): account list with current balances, sort / filter popup /
   group by tag, add-account screen, hash-based navigation with back-button support (ADR)
   (R-P1–R-P6, R-C1, R-V9).
3. **Account details + update balance** ✅: details page with stats, click-to-edit fields,
   balance history, update-balance popup, swipe/keyboard previous/next, settings for the
   financial year (R-V1–R-V8, R-B1, R-C2, R-S6).

Then: first release (secrets configured, installers tested on macOS, Windows and Linux).

## M2: Insights and polish

- [x] Net worth over time (R-D3), change over the period (R-D4), assets and liabilities (R-D2)
- [ ] Balance over time on account details (R-B4)
- [ ] Breakdown by tag (R-D5)
- [ ] "Update all" quick-entry flow (R-B2)
- [x] Export JSON and CSV (R-S2)
- [ ] Dark mode (R-S3)
- [ ] Offline read-only mode from the last loaded data (N-8)
- [ ] Publish releases only after all OS builds finish (draft → publish) (ADR-0007 follow-up)
- [ ] OS code signing: Apple Developer ID + notarization, Windows signing (ADR-0008 follow-up)

## M3: Android

- [ ] `tauri android init`, CI build of a signed APK/AAB attached to the GitHub Release (ADR-0009)
- [ ] Android sign-in behind the same `auth_*` commands (ADR)
- [ ] Android update flow: Play In-App Updates or a GitHub-Release APK, user-confirmed (ADR-0007)
- [ ] Decide between Play Store and GitHub-only distribution (ADR)

## Later / ideas

- Google Picker "open existing file" (R-S4)
- Multi-currency totals with user-entered FX rates (R-S5)
- ESLint import-boundary rule to enforce `features → services → domain`
- PR-title lint for Conventional Commits
