# Data model

The user's data lives in their Google Drive as readable JSON files (ADR-0014). Source of truth for
the shapes: [`src/domain/schema.ts`](../src/domain/schema.ts) (the data as the app uses it) and
[`src/domain/storage/files.ts`](../src/domain/storage/files.ts) (the stored files). Evolution rules
are in [ADR-0006](adr/0006-data-file-schema-and-migrations.md); how data is split across files is in
[ADR-0014](adr/0014-split-data-into-financial-year-files.md).

**Current schema version:** `3`

## Stored files

```
My Drive/TrackWorth/
  settings.json            settings, the period of every balance file, earlier net-worth history
  accounts.json            all accounts
  balances/
    2025.json              entries dated 2025-04-01 … 2026-03-31 (April financial year)
    2026.json              the current financial year
```

Every file has `schemaVersion` and `updatedAt` (when it was last written). A file written by a
newer app version is refused, never overwritten.

### settings.json

```json
{
  "schemaVersion": 4,
  "updatedAt": "2026-11-23T09:30:00.000Z",
  "baseCurrency": "INR",
  "settings": { "financialYearStartMonth": 4, "customTags": ["🪙 Gold"] },
  "balanceFiles": [
    { "file": "balances/2025.json", "from": "2025-04-01", "to": "2026-03-31" },
    { "file": "balances/2026.json", "from": "2026-04-01", "to": "2027-03-31" }
  ],
  "netWorthHistory": [{ "date": "2011-04-30", "amountMinor": 157828533, "currency": "INR" }]
}
```

`balanceFiles` is **authoritative**: periods never overlap or leave gaps, every file is named after
the year its period starts, and a file only owns the entries dated within its period. Changing the
financial year re-periods only the current and previous files (ADR-0014).

`netWorthHistory` holds monthly totals from before the user had accounts in TrackWorth (ADR-0017).
It is usually empty.

### accounts.json

```json
{
  "schemaVersion": 4,
  "updatedAt": "2026-11-23T09:30:00.000Z",
  "accounts": [
    {
      "id": "6f1c2c1e-4b8a-4a59-9d0e-2a7f1f0b9c11",
      "name": "Savings 🏦",
      "kind": "asset",
      "tag": "Cash",
      "liquidity": 5,
      "currency": "INR",
      "balanceSource": "HDFC NetBanking",
      "archived": false,
      "createdAt": "2026-01-03T10:00:00.000Z"
    }
  ]
}
```

### balances/2026.json

```json
{
  "schemaVersion": 4,
  "updatedAt": "2026-11-23T09:30:00.000Z",
  "from": "2026-04-01",
  "to": "2027-03-31",
  "balances": [
    {
      "id": "c3d9…",
      "accountId": "6f1c2c1e-4b8a-4a59-9d0e-2a7f1f0b9c11",
      "date": "2026-11-01",
      "amountMinor": 52341200,
      "recordedAt": "2026-11-01T08:00:00.000Z"
    }
  ]
}
```

`from`/`to` are an informational copy of the period; `settings.json` decides. Entries are sorted
by date.

## Fields

In memory the app works with one combined dataset (`DataFile`): `schemaVersion`, `updatedAt`
(latest of the files), `baseCurrency`, `settings`, `accounts`, `balances`, `netWorthHistory`.

### Settings

| Field                     | Type     | Notes                                                                  |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `financialYearStartMonth` | 1–12     | Month the financial year starts. Default `4` (April–March).            |
| `customTags`              | string[] | Tags the user added. The built-in defaults are not stored (see below). |

### Account

| Field           | Type                    | Notes                                                                                                    |
| --------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`            | string (UUID)           | Never reused.                                                                                            |
| `name`          | string, 1–100 chars     | Free text, emoji allowed.                                                                                |
| `kind`          | `asset` \| `liability`  | Decides the default sign of new balances. Editable; changing it can optionally negate existing balances. |
| `tag`           | string, 1–40 chars      | One per account, free text, emoji allowed.                                                               |
| `liquidity`     | integer 1–5             | 1 = low (hard to turn into cash) … 5 = high (cash-like).                                                 |
| `currency`      | ISO 4217 code           | All balances of this account are in this currency.                                                       |
| `balanceSource` | string ≤ 60, optional   | Where the balance is read from. Orders accounts so one source's accounts are consecutive.                |
| `archived`      | boolean                 | Hidden from totals, history kept.                                                                        |
| `note`          | string ≤ 2000, optional | Notes.                                                                                                   |
| `createdAt`     | ISO-8601 UTC            |                                                                                                          |

**Default tags** (always offered, not stored): Equity, Fixed Income, Real Assets, Alternative
Assets, Cash. A tag typed for an account that isn't a default is added to
`settings.customTags`. Tags match case-insensitively; the first spelling is kept.

### BalanceEntry

| Field         | Type                   | Notes                                                                 |
| ------------- | ---------------------- | --------------------------------------------------------------------- |
| `id`          | string (UUID)          |                                                                       |
| `accountId`   | string                 | Must reference an existing `Account.id`.                              |
| `date`        | `YYYY-MM-DD`           | The user's calendar date. **At most one entry per account per date.** |
| `amountMinor` | integer (signed)       | Minor units (cents). Liabilities are normally negative.               |
| `note`        | string ≤ 500, optional |                                                                       |
| `recordedAt`  | ISO-8601 UTC           | When the entry was created or last changed.                           |

Saving a balance for a date that already has an entry **updates** that entry.

### HistoryPoint (earlier net-worth history, ADR-0017)

| Field         | Type             | Notes                                                        |
| ------------- | ---------------- | ------------------------------------------------------------ |
| `date`        | `YYYY-MM-DD`     | The month's last day. **At most one per currency per date.** |
| `amountMinor` | integer (signed) | Net worth on that date, in minor units.                      |
| `currency`    | ISO 4217 code    |                                                              |

Only the start-page net-worth chart uses these, for dates before the first account entry in that
currency, and not while a tag or liquidity filter is on.

## Derived values (never stored)

All in [`src/domain/`](../src/domain/):

- **Current balance:** the entry with the latest `date` (`latestBalance()`).
- **Changes** (`balanceStats()`), current balance minus:
  - the previous entry;
  - the last entry dated before the current month;
  - the last entry dated before the current financial year.
- **All-time high:** assets: highest balance. Liabilities: peak debt (most negative). Ties go to
  the earliest date.
- **Net worth:** sum of active accounts' current balances, per currency (`netWorthByCurrency()`).
- **Balance-source order:** grouped by source alphabetically (no source last), then by name
  (`orderByBalanceSource()`). Used for previous/next on the details page.

## History

| Version | Change                                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Initial. Fixed `category` list, liabilities stored as positive "amount owed".                                                                                                                                                                                                     |
| 2       | `category` → free-text `tag`; added `liquidity`, `balanceSource`, `settings`; balances signed (liabilities negated); one entry per account per day (the latest recorded is kept). Migration: `src/domain/migrations/v1ToV2.ts`.                                                   |
| 3       | Same fields; stored split across `settings.json`, `accounts.json` and one `balances/<year>.json` per financial year (ADR-0014). The old single file is upgraded on first load, verified, then moved to Drive's trash. Migration: `src/services/storage/dataStore.ts` (`migrate`). |
| 4       | Added `netWorthHistory` (in `settings.json`; ADR-0017). v3 data loads with an empty list; v3 stored files are read and rewritten as v4 when they next change. Migration: `src/domain/schema.ts` (step 3) and `src/domain/storage/files.ts` (`fromV3`).                            |
