# Product requirements

The source of truth for _what_ TrackWorth does. Agents implement what's here and don't invent
features. Changes to this file need the owner's approval. IDs (`R-…`) are stable, so reference
them in issues and PRs.

Status key: ✅ done · 🚧 in progress · ⬜ planned · 💭 idea (not committed)

## Vision

A calm, private net-worth tracker that runs as an installed desktop app. Users manually record balances for their accounts and see
how each account and their total net worth change over time. All data lives in one JSON file
in the user's own Google Drive. See [SOUL.md](../../SOUL.md).

## Users

- **Primary:** an individual tracking personal finances across banks, investments, property and
  debts, updating balances weekly or monthly on their computer (and later on their phone).

## Functional requirements

### Authentication & storage

| ID   | Requirement                                                                                            | Status                       |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| R-A1 | Sign in with Google in the system browser. The app is unusable without sign-in.                        | ✅                           |
| R-A2 | Show the signed-in user's name (from the OAuth profile) in the header.                                 | ✅                           |
| R-A3 | After sign-in, load the data file from `My Drive/TrackWorth/trackworth-data.json`.                     | ✅                           |
| R-A4 | If the file doesn't exist, create it (with the folder) as an empty data file.                          | ✅                           |
| R-A5 | Sign out revokes the token and clears all in-memory data.                                              | ✅                           |
| R-A6 | Saving never silently overwrites changes made on another device. Detect the conflict and offer reload. | 🚧 (client done, UI pending) |
| R-A7 | Access tokens are refreshed automatically before they expire, so sessions never break mid-use.         | ✅                           |
| R-A8 | Stay signed in across app restarts (refresh token in the OS keychain), until the user signs out.       | ✅                           |

### Accounts

| ID   | Requirement                                                                                         | Status |
| ---- | --------------------------------------------------------------------------------------------------- | ------ |
| R-C1 | Create an account: name, kind (asset/liability), category, currency, optional note.                 | ⬜     |
| R-C2 | Edit account details.                                                                               | ⬜     |
| R-C3 | Archive or unarchive an account. Archived accounts are excluded from totals but keep their history. | ⬜     |
| R-C4 | Delete an account and its history, with confirmation.                                               | ⬜     |
| R-C5 | Accounts are grouped by category on the dashboard.                                                  | ⬜     |

### Balances

| ID   | Requirement                                                                                         | Status |
| ---- | --------------------------------------------------------------------------------------------------- | ------ |
| R-B1 | Record a balance for an account on a date (defaults to today), with an optional note.               | ⬜     |
| R-B2 | "Update all" flow: step through every active account, entering today's balances quickly.            | ⬜     |
| R-B3 | Edit or delete a past balance entry.                                                                | ⬜     |
| R-B4 | Account detail: history list and line chart of balance over time, with change since previous entry. | ⬜     |

### Dashboard & insights

| ID   | Requirement                                                 | Status |
| ---- | ----------------------------------------------------------- | ------ |
| R-D1 | Show current net worth (assets − liabilities) per currency. | ✅     |
| R-D2 | Show total assets and total liabilities.                    | ⬜     |
| R-D3 | Net-worth-over-time chart with ranges (1M, 6M, 1Y, All).    | ⬜     |
| R-D4 | Change versus previous period (absolute and %).             | ⬜     |
| R-D5 | Breakdown by category.                                      | ⬜     |

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
| R-S2 | Export the data file (download JSON) and export balances as CSV.                          | ⬜     |
| R-S3 | Light and dark theme, following the system by default.                                    | ⬜     |
| R-S4 | "Open existing file" via Google Picker, to restore a manually uploaded backup (ADR-0005). | 💭     |
| R-S5 | Multi-currency net worth with user-entered exchange rates.                                | 💭     |

## Non-functional requirements

| ID  | Requirement                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------- |
| N-1 | No server, analytics, telemetry or third-party trackers (ADR-0003, SOUL.md).                                            |
| N-2 | No bank or aggregator integrations, ever. Manual entry only.                                                            |
| N-3 | The refresh token is stored only in the OS keychain and never reaches the UI. Access tokens are memory-only (ADR-0004). |
| N-4 | Responsive. Usable in a 380 px wide window (the same UI will run on Android).                                           |
| N-5 | WCAG 2.2 AA: keyboard accessible, labelled controls, sufficient contrast.                                               |
| N-6 | Money is exact (integer minor units, ADR-0006).                                                                         |
| N-7 | Starts and is interactive in under 2 s on a mid-range laptop. Installer under 15 MB. JS bundle under 250 kB gzip.       |
| N-8 | Viewing the last loaded data offline (planned). Writes require connectivity.                                            |

## Out of scope

Budgeting, transactions, bank sync, investment advice, sharing or social features, and a
TrackWorth server or account system.
