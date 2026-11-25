---
status: Accepted
date: 2026-11-24
decision-makers: [project owner]
---

# Keep earlier net-worth history as monthly totals, apart from accounts

## Context and Problem Statement

People switching to TrackWorth often have years of history in a spreadsheet, but only as a
monthly **total** (net worth per month), not per account. The account model can't hold a total
without inventing accounts, tags and liquidity. Faking it (a "history" account zeroed on the
switch-over day) would clutter the account list and Insights, and break if archived. How do we
keep that long view honestly?

## Decision Drivers

- Honest numbers: never mix imported totals with account data for the same period, and never
  split a total into parts we don't know (SOUL.md).
- The user owns their data: the history lives in their Drive files, readable as JSON.
- Data-file contract (ADR-0006): a shape change bumps the version, with a migration.
- Small: one field, used by one chart.

## Considered Options

1. **A `netWorthHistory` list of monthly totals** (date, amount, currency), stored in
   `settings.json`, shown only on the net-worth chart before the first account entry.
2. A synthetic "history" account, zeroed when real accounts start.
3. No import; keep the history in the spreadsheet.

## Decision Outcome

Chosen option: **1**.

- **Data:** `DataFile.netWorthHistory: { date, amountMinor, currency }[]`. `date` is a month-end
  `YYYY-MM-DD`, and there is at most one item per currency per date. Data format **v4**.
  - v3 files load as v4 with an empty list.
  - Older apps refuse v4 files ("saved by a newer version"), so they can never drop the list.
- **Storage:** it goes in `settings.json`, which stays small at ~12 items a year. Other files
  keep their shape; v3 accounts and balance files are still read and are rewritten as v4 the
  next time they change.
- **Sync (ADR-0015):** it's part of "settings" for three-way merge, so a conflict asks the user
  to choose, like other settings.
- **Display:** only the start-page net-worth chart (R-D3) uses it.
  - Imported totals fill months **before** the first account entry in that currency.
  - From the first entry on, account data always wins.
  - The imported part is drawn lighter.
  - Hidden while a tag or liquidity filter is on, because totals can't be split.
  - The change line under the chart measures from the first value shown, imported or not,
    since both are the same quantity (net worth).
  - Not used by account pages, Insights or the headline number.
- **Import (for now):** a one-time import in development builds only (Settings, behind
  `import.meta.env.DEV`). It takes a CSV of month and closing net worth, shows a preview and
  replaces the list. A user-facing importer comes with the full import work (#2).

### Consequences

- Good: the long view survives without fake accounts, and the JSON stays readable.
- Good: other files keep their shape, so the version bump is cheap and safe.
- Bad: one more field in the data contract, forever. It is deliberately minimal.
- Bad: an older app on another device must be updated before it can open the data again.

### Confirmation

- Fixture test loads v3 stored files and a v3 single file.
- `domain/trend.ts` tests cover the hand-over from imported totals to account data.
- Merge tests cover history changes on one side and both sides.

## Pros and Cons of the Options

### Option 2

- Good, because it needs no data-format change.
- Bad, because it pollutes the account list, Insights and filters, and archiving it erases the
  history from charts.

### Option 3

- Good, because it's zero work.
- Bad, because the app can't show the long-term trend.

## More Information

- Requirements: R-D3 (net worth over time). Full CSV import: issue #2.
