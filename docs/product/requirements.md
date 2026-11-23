# Product requirements

The source of truth for _what_ TrackWorth does. Agents implement what's here and don't invent
features. Changes to this file need the owner's approval. IDs (`R-…`) are stable, so reference
them in issues and PRs.

Status key: ✅ done · 🚧 in progress · ⬜ planned · 💭 idea (not committed)

## Vision

A calm, private net-worth tracker that runs as an installed desktop app. Users manually record balances for their accounts and see
how each account and their total net worth change over time. All data lives in readable JSON files in the user's own Google Drive (ADR-0014). See [SOUL.md](../../SOUL.md).

## Users

- **Primary:** an individual tracking personal finances across banks, investments, property and
  debts, updating balances weekly or monthly on their computer (and later on their phone).

## Functional requirements

### Authentication & storage

| ID   | Requirement                                                                                                                                       | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R-A1 | Sign in with Google in the system browser. The app is unusable without sign-in.                                                                   | ✅     |
| R-A2 | Show the signed-in user's name (from the OAuth profile) in the header.                                                                            | ✅     |
| R-A3 | After sign-in, load the data from `My Drive/TrackWorth/` (settings, accounts, one file per financial year).                                       | ✅     |
| R-A4 | If no data exists, create the folder and empty files. An older single data file is upgraded automatically, verified, then moved to Drive's trash. | ✅     |
| R-A5 | Sign out revokes the token and clears all in-memory data.                                                                                         | ✅     |
| R-A6 | Saving never silently overwrites changes made on another device. Detect the conflict and offer reload.                                            | ✅     |
| R-A7 | Access tokens are refreshed automatically before they expire, so sessions never break mid-use.                                                    | ✅     |
| R-A8 | Stay signed in across app restarts (refresh token in the OS keychain), until the user signs out.                                                  | ✅     |

### Accounts

| ID   | Requirement                                                                                                                                                                                                                                                                                                                                                                | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R-C1 | Create an account with: **name** (free text, emoji allowed), **type** (asset / liability), **tag** (exactly one, free text, emoji allowed, used like a category), **liquidity** (1–5, low → high), **currency**, **notes** (free text, optional), **balance source** (optional, see R-C6) and an optional **opening balance** (+/− and amount, recorded as today's entry). | ✅     |
| R-C2 | Edit an account's name, tag, type, liquidity, currency, notes and balance source from the details page by clicking the value. **Type** (asset/liability) can also be changed, optionally flipping the sign of existing balances. Changing currency keeps the displayed amounts.                                                                                            | ✅     |
| R-C3 | Archive or unarchive an account. Archived accounts are excluded from totals but keep their history; the filter popup can show them.                                                                                                                                                                                                                                        | ✅     |
| R-C4 | Delete an account and its history, after typing its name to confirm (archiving is offered instead).                                                                                                                                                                                                                                                                        | ✅     |
| R-C5 | Default tags: Equity, Fixed Income, Real Assets, Alternative Assets, Cash. Users can type a new tag, which is then offered for other accounts too.                                                                                                                                                                                                                         | ✅     |
| R-C6 | **Balance source**: where the user reads the balance from. Free text, with a choice of previously entered sources. Accounts are ordered by balance source so all accounts from one source are consecutive when updating balances.                                                                                                                                          | ✅     |

### Start page

| ID   | Requirement                                                                                                                                | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| R-P1 | List accounts with their current balance (latest entry).                                                                                   | ✅     |
| R-P2 | Sort accounts by name, liquidity or tag (tap again to reverse). Names sort by their first letter or digit, ignoring a leading emoji.       | ✅     |
| R-P3 | Filter accounts by liquidity and/or tag, in a filter popup. Shows accounts matching any selected tag **and** any selected liquidity level. | ✅     |
| R-P4 | Group accounts by tag.                                                                                                                     | ✅     |
| R-P5 | Add a new account from the start page.                                                                                                     | ✅     |
| R-P6 | Clicking an account opens its details page.                                                                                                | ✅     |

### Account details

| ID   | Requirement                                                                                                                                                   | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R-V1 | Title: account name. Subtitle: tag.                                                                                                                           | ✅     |
| R-V2 | Current balance, with the change (+/−) since: the previous entry; the last entry of the previous month; the last entry of the previous financial year (R-S6). | ✅     |
| R-V3 | All-time high. For assets the highest balance; for liabilities the peak debt (most negative).                                                                 | ✅     |
| R-V4 | Show liquidity, currency and type (asset/liability).                                                                                                          | ✅     |
| R-V5 | "Update balance" opens the update-balance popup (R-B1).                                                                                                       | ✅     |
| R-V6 | Balance history: a short list, with an option to show all entries.                                                                                            | ✅     |
| R-V7 | Show the balance source (R-C6).                                                                                                                               | ✅     |
| R-V8 | Swipe left/right (and keyboard arrows / buttons on desktop) to go to the previous/next account, in balance-source order (R-C6).                               | ✅     |
| R-V9 | The back button (browser, desktop back gesture/keys, Android back) returns to the previous screen.                                                            | ✅     |

### Balances

| ID   | Requirement                                                                                                                                                                                                                                                  | Status            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| R-B1 | Update-balance popup: **date** (defaults to today), **positive/negative** (defaults to positive for assets, negative for liabilities), **amount** (typed as a positive number, saved with the chosen sign, with the account's currency shown), and **Save**. | ✅                |
| R-B2 | "Update all" flow: step through every active account, entering today's balances quickly.                                                                                                                                                                     | ⬜                |
| R-B3 | Delete a past balance entry (tap it in the history → Delete this entry → confirm; Undo for a few seconds). Editing works the same way.                                                                                                                       | ✅                |
| R-B4 | Balance-over-time chart on the details page.                                                                                                                                                                                                                 | ⬜ next iteration |
| R-B5 | Saving a balance on a date that already has an entry updates that entry instead of adding another.                                                                                                                                                           | ✅                |

### Dashboard & insights

| ID   | Requirement                                                           | Status            |
| ---- | --------------------------------------------------------------------- | ----------------- |
| R-D1 | Show current net worth (sum of signed balances) per currency.         | ✅                |
| R-D2 | Show total assets and total liabilities.                              | ✅                |
| R-D3 | Net-worth-over-time chart (1M, 6M, 1Y default, All), FY start marked. | ✅                |
| R-D4 | Change over the shown period (absolute and %).                        | ✅                |
| R-D5 | Breakdown by tag.                                                     | ⬜ next iteration |

### App updates

| ID   | Requirement                                                                                   | Status |
| ---- | --------------------------------------------------------------------------------------------- | ------ |
| R-U1 | Detect when a newer GitHub Release than the installed version exists (on start and hourly).   | ✅     |
| R-U2 | Show the new version with a link to its release notes. Install only after the user confirms.  | ✅     |
| R-U3 | Users can postpone ("Later"). The update is offered again when an even newer release appears. | ✅     |
| R-U4 | Show the running version in the app.                                                          | ✅     |
| R-U5 | Only install updates whose signature matches the app's embedded public key.                   | ✅     |

### Settings & data

| ID   | Requirement                                                                               | Status |
| ---- | ----------------------------------------------------------------------------------------- | ------ |
| R-S1 | Choose the base currency.                                                                 | ⬜     |
| R-S2 | Export everything as JSON and the balances as CSV, saved where the user picks (ADR-0016). | ✅     |
| R-S3 | Light and dark theme, following the system by default.                                    | ⬜     |
| R-S4 | "Open existing file" via Google Picker, to restore a manually uploaded backup (ADR-0005). | 💭     |
| R-S5 | Multi-currency net worth with user-entered exchange rates.                                | 💭     |
| R-S6 | Financial year start month (default April, i.e. April–March). Used by R-V2.               | ✅     |

## Non-functional requirements

| ID  | Requirement                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| N-1 | No server, analytics, telemetry or third-party trackers (ADR-0003, SOUL.md).                                                            |
| N-2 | No bank or aggregator integrations, ever. Manual entry only.                                                                            |
| N-3 | The refresh token is stored only in the OS keychain and never reaches the UI. Access tokens are memory-only (ADR-0004).                 |
| N-4 | Responsive. Usable in a 380 px wide window (the same UI will run on Android).                                                           |
| N-5 | WCAG 2.2 AA: keyboard accessible, labelled controls, sufficient contrast.                                                               |
| N-6 | Money is exact (integer minor units, ADR-0006).                                                                                         |
| N-7 | Starts and is interactive in under 2 s on a mid-range laptop. Installer under 15 MB. JS bundle under 250 kB gzip.                       |
| N-8 | Works offline: view and edit with no connection; changes are kept on the device and uploaded automatically when back online (ADR-0015). |

## Out of scope

Budgeting, transactions, bank sync, investment advice, sharing or social features, and a
TrackWorth server or account system.
