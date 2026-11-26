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

Then: first release v0.1.0 (release secrets configured 2026-11-25; installers to be tested on macOS,
Windows and Linux).

## M2: Insights and polish

- [x] Net worth over time (R-D3), change over the period (R-D4), assets and liabilities (R-D2)
- [x] Balance over time on account details (R-B4)
- [x] Breakdown by tag and liquidity on an Insights page (R-D5)
- [x] "Update all" quick-entry screen (R-B2)
- [x] Export JSON and CSV (R-S2)
- [x] Dark mode and a brighter visual refresh (R-S3)
- [x] Offline use: shows the device copy and keeps editing offline, uploads later (N-8, ADR-0015)
- [ ] Publish releases only after all OS builds finish (draft → publish) (ADR-0007 follow-up)
- [ ] OS code signing: Apple Developer ID + notarization, Windows signing (ADR-0008 follow-up)

## M3: Android

- [x] `tauri android init`, package `com.trackworth.app`, phone layout (safe areas, bottom menu)
- [x] Android sign-in behind the same `auth_*` commands (ADR-0019)
- [x] Export on Android ("Save to…" picker) and release signing with the Play upload key
- [x] Distribution: Google Play (store listing drafted in `docs/store/google-play.md`)
- [ ] CI build of the signed AAB (needs approval: workflow change)
- [ ] Play Console: app created, internal test, Play App Signing SHA-1 in the OAuth client,
      12-tester closed test for 14 days, then production
- [ ] Android updates through Google Play (no in-app updater on Android)

## Done beyond the plan

- Base currency and conversion with Frankfurter rates, own rates, Currencies page (R-S1, R-S5,
  ADR-0018)
- Earlier net-worth history (monthly totals) on the chart (ADR-0017)
- Main menu (header tabs / bottom bar), light/dark/system theme

## Later / ideas

- TypeScript 7, once typescript-eslint supports it (typescript-eslint/typescript-eslint#10940;
  Dependabot holds back TypeScript majors until then)

- Full CSV importer (#2)

- Google Picker "open existing file" (R-S4)
- ESLint import-boundary rule to enforce `features → services → domain`
- PR-title lint for Conventional Commits
