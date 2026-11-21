# Data model

The data file is the database. Source of truth for the shape is
[`src/domain/schema.ts`](../src/domain/schema.ts). This page explains it. Evolution rules are in
[ADR-0006](adr/0006-data-file-schema-and-migrations.md).

**Location:** `My Drive/TrackWorth/trackworth-data.json` (ADR-0005)
**Current schema version:** `1`

## Example

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-21T09:30:00.000Z",
  "baseCurrency": "USD",
  "accounts": [
    {
      "id": "6f1c2c1e-4b8a-4a59-9d0e-2a7f1f0b9c11",
      "name": "Everyday Checking",
      "kind": "asset",
      "category": "bank",
      "currency": "USD",
      "archived": false,
      "createdAt": "2026-01-03T10:00:00.000Z"
    },
    {
      "id": "0b7e4d8a-2f3c-4c1d-8e6b-5a9d3c2b1a00",
      "name": "Credit Card",
      "kind": "liability",
      "category": "credit_card",
      "currency": "USD",
      "archived": false,
      "note": "Pay in full monthly",
      "createdAt": "2026-01-03T10:05:00.000Z"
    }
  ],
  "balances": [
    {
      "id": "c3d9…",
      "accountId": "6f1c2c1e-4b8a-4a59-9d0e-2a7f1f0b9c11",
      "date": "2026-11-01",
      "amountMinor": 523412,
      "recordedAt": "2026-11-01T08:00:00.000Z"
    },
    {
      "id": "a81f…",
      "accountId": "0b7e4d8a-2f3c-4c1d-8e6b-5a9d3c2b1a00",
      "date": "2026-11-01",
      "amountMinor": 84950,
      "note": "Statement balance",
      "recordedAt": "2026-11-01T08:01:00.000Z"
    }
  ]
}
```

Net worth here = $5,234.12 − $849.50 = **$4,384.62**.

## Fields

### Root

| Field           | Type             | Notes                                                         |
| --------------- | ---------------- | ------------------------------------------------------------- |
| `schemaVersion` | integer          | Bumped on every shape change. The app refuses newer versions. |
| `updatedAt`     | ISO-8601 UTC     | Set on every save.                                            |
| `baseCurrency`  | ISO 4217 code    | Default currency for new accounts and totals.                 |
| `accounts`      | `Account[]`      |                                                               |
| `balances`      | `BalanceEntry[]` | Flat list. Order doesn't matter.                              |

### Account

| Field       | Type                    | Notes                                                                                                           |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`        | string (UUID)           | Never reused.                                                                                                   |
| `name`      | string, 1–100 chars     |                                                                                                                 |
| `kind`      | `asset` \| `liability`  | Determines the sign in net worth.                                                                               |
| `category`  | enum                    | `cash bank investment retirement property vehicle crypto other_asset credit_card loan mortgage other_liability` |
| `currency`  | ISO 4217 code           | All balances of this account are in this currency.                                                              |
| `archived`  | boolean                 | Hidden from totals, history kept.                                                                               |
| `note`      | string ≤ 1000, optional |                                                                                                                 |
| `createdAt` | ISO-8601 UTC            |                                                                                                                 |

### BalanceEntry

| Field         | Type                   | Notes                                                               |
| ------------- | ---------------------- | ------------------------------------------------------------------- |
| `id`          | string (UUID)          |                                                                     |
| `accountId`   | string                 | References `Account.id`.                                            |
| `date`        | `YYYY-MM-DD`           | The date the balance applies to (user's calendar date).             |
| `amountMinor` | integer                | Minor units (cents). Liabilities store the amount owed as positive. |
| `note`        | string ≤ 500, optional |                                                                     |
| `recordedAt`  | ISO-8601 UTC           | When it was entered. Breaks ties between same-day entries.          |

## Derived values (never stored)

- **Current balance** of an account = the entry with the latest `date` (ties broken by
  `recordedAt`). See `latestBalance()`.
- **Net worth** = Σ asset balances − Σ liability balances, per currency, excluding archived
  accounts. See `netWorthByCurrency()`.
