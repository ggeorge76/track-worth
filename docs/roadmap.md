# Roadmap

Milestones in order. Each bullet should become one **Agent task** issue (one PR). Requirement IDs
refer to [product/requirements.md](product/requirements.md).

## M0: Scaffolding ✅

- Tauri 2 desktop app, React UI, Bun tooling, quality gates (UI + Rust), CI, release pipeline
- Google sign-in in the browser (loopback + PKCE), keychain-backed session, user name in header
- Drive load/create at the fixed path with conflict-safe save client
- Signed, user-confirmed self-update from the latest GitHub Release
- Agent docs and ADRs

## M1: Core tracking (MVP)

- [ ] Save pipeline: `useSaveDataFile` mutation with conflict handling UI (R-A6)
- [ ] Router (with an ADR): dashboard, account detail, settings
- [ ] Create, edit and archive accounts (R-C1–C3)
- [ ] Record a balance, and edit or delete entries (R-B1, R-B3)
- [ ] Dashboard grouped by category with totals (R-C5, R-D2)
- [ ] Account detail with history list and chart (R-B4)
- [ ] Base currency setting (R-S1)
- [ ] First release: secrets configured, installers tested on macOS, Windows and Linux

## M2: Insights and polish

- [ ] Net-worth-over-time chart with ranges (R-D3), change vs previous period (R-D4)
- [ ] Category breakdown (R-D5)
- [ ] "Update all" quick-entry flow (R-B2)
- [ ] Export JSON and CSV (R-S2)
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
