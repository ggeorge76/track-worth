---
status: Proposed
date: 2026-11-25
decision-makers: [project owner]
---

# Show totals in a base currency, with rates from Frankfurter

## Context and Problem Statement

Users hold accounts in several currencies (e.g. INR savings, a USD brokerage account). Net worth,
charts and insights showed one currency at a time, which can't answer "what am I worth?". How do
we combine currencies honestly, and where do the rates come from?

## Decision Drivers

- Honest numbers (SOUL.md): never combine currencies without saying how, and never invent a rate.
- No server of our own, and no API keys to ship or protect.
- Works offline with the last known rates.
- History should reflect the rates of its time.

## Considered Options

1. **Frankfurter** (https://frankfurter.dev): free, open source, no key; central-bank reference
   rates for 200+ currencies with daily history; can be self-hosted.
2. Rates typed in by the user only (the original roadmap idea, R-S5).
3. A commercial rates API (needs a key, which a desktop app can't keep secret).

## Decision Outcome

Chosen option: **1, with the user's own rates as an override** (option 2 as a complement).

- **Base currency:** the existing `baseCurrency` (settings.json), now chosen in Settings. No
  data-format change.
- **What converts:**
  - Converted: start-page net worth, the net-worth chart and its change line, assets/liabilities,
    and Insights.
  - Not converted: an account page shows its own currency, plus "≈ base at today's rate".
  - Balances are always stored in their own currency.
- **Which rate:**
  - A value **on a date** uses that date's rate: the latest daily rate for the current month, and
    the month's rate for earlier months (Frankfurter's monthly series, `group=month`).
  - If a month is missing, the nearest earlier month is used, then the current rate.
  - The user's own rate replaces the published rate for current values. Past months keep their
    published rate, and use the user's rate only when there's none.
- **No rate at all:** a currency with no rate is left out of totals, and the screen says so ("Not
  included: GBP (no exchange rate yet)").
- **Fetching** (`services/fx`):
  - At most once a day, and only when the data has other currencies (or the Currencies page is
    open).
  - Two requests: the latest rates for all currencies, and a monthly series from the first month
    needed, for the currencies in use.
  - Requests contain only currency codes and dates.
- **Storage:** rates and the user's own rates are kept on the device (IndexedDB store `fx`). They
  survive sign-out because they're not personal. If a refresh fails, the device copy is used and
  the screen says so.
- **Permissions:** `https://api.frankfurter.dev/v2/*` is added to the HTTP allow-list. The privacy
  policy names the service.
- **Money:** conversion multiplies once and rounds straight back to integer minor units
  (`convertMinor`). This is the only place a float touches money.

### Consequences

- Good: one honest total across currencies; history uses period-correct rates; no keys or server.
- Good: offline keeps working with the last rates, clearly flagged.
- Bad: depends on a free third-party service. Mitigations: device cache, the user's own rates,
  and Frankfurter can be self-hosted if it ever goes away.
- Neutral: the user's own rates are per device (not synced). Revisit if that proves annoying.

### Confirmation

- `domain/fx.ts`, `netWorth.ts`, `trend.ts` and `breakdown.ts` have tests for conversion, the
  fallbacks and unconverted currencies.
- `services/fx` has tests for the client, the once-a-day cache and offline fallback.
- No test reaches the network (`src/test/setup.ts`).

## More Information

- Requirements R-S1 (base currency) and R-S5 (multi-currency net worth).
