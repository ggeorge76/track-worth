# Data model

The data file is the database. Source of truth for the shape is
[`src/domain/schema.ts`](../src/domain/schema.ts). This page explains it. Evolution rules are in
[ADR-0006](adr/0006-data-file-schema-and-migrations.md).

**Location:** `My Drive/TrackWorth/trackworth-data.json` (ADR-0005)
**Current schema version:** `2`

## Example

```json
{
  "schemaVersion": 2,
  "updatedAt": "2026-11-22T09:30:00.000Z",
  "baseCurrency": "INR",
  "settings": {
    "financialYearStartMonth": 4,
    "customTags": ["🪙 Gold"]
  },
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
    },
    {
      "id": "0b7e4d8a-2f3c-4c1d-8e6b-5a9d3c2b1a00",
      "name": "Home loan",
      "kind": "liability",
      "tag": "Debt",
      "liquidity": 1,
      "currency": "INR",
      "balanceSource": "HDFC NetBanking",
      "archived": false,
      "note": "20-year term",
      "createdAt": "2026-01-03T10:05:00.000Z"
    }
  ],
  "balances": [
    {
      "id": "c3d9…",
      "accountId": "6f1c2c1e-4b8a-4a59-9d0e-2a7f1f0b9c11",
      "date": "2026-11-01",
      "amountMinor": 52341200,
      "recordedAt": "2026-11-01T08:00:00.000Z"
    },
    {
      "id": "a81f…",
      "accountId": "0b7e4d8a-2f3c-4c1d-8e6b-5a9d3c2b1a00",
      "date": "2026-11-01",
      "amountMinor": -4500000000,
      "recordedAt": "2026-11-01T08:01:00.000Z"
    }
  ]
}
```

Net worth here = ₹5,23,412.00 + (−₹4,50,00,000.00): balances are **signed**, so net worth is a
plain sum.

## Fields

### Root

| Field           | Type             | Notes                                                         |
| --------------- | ---------------- | ------------------------------------------------------------- |
| `schemaVersion` | integer          | Bumped on every shape change. The app refuses newer versions. |
| `updatedAt`     | ISO-8601 UTC     | Set on every save.                                            |
| `baseCurrency`  | ISO 4217 code    | Default currency for new accounts.                            |
| `settings`      | `Settings`       | App-level settings (below).                                   |
| `accounts`      | `Account[]`      |                                                               |
| `balances`      | `BalanceEntry[]` | Flat list. Order doesn't matter.                              |

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

| Version | Change                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Initial. Fixed `category` list, liabilities stored as positive "amount owed".                                                                                                                                                   |
| 2       | `category` → free-text `tag`; added `liquidity`, `balanceSource`, `settings`; balances signed (liabilities negated); one entry per account per day (the latest recorded is kept). Migration: `src/domain/migrations/v1ToV2.ts`. |
