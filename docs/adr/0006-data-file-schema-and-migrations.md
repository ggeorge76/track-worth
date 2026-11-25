---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Versioned, Zod-validated data-file schema with forward-only migrations

## Context and Problem Statement

The JSON file in Drive is our only database, and it holds years of users' financial history.
Different devices may run different app versions. How do we evolve the format without
corrupting or losing data?

## Decision Drivers

- Data loss is the worst possible bug (SOUL.md).
- Old files must always load in new app versions.
- New files must never be damaged by old app versions.
- Money must be exact.

## Considered Options

- Explicit `schemaVersion` + Zod schema + forward-only migrations + refuse-newer
- Schemaless JSON, tolerate whatever is there
- JSON Schema files + AJV

## Decision Outcome

Chosen option: **explicit `schemaVersion` + Zod + forward-only migrations + refuse-newer.**

- `src/domain/schema.ts` defines the current schema and `SCHEMA_VERSION`.
- On load: if `schemaVersion > SCHEMA_VERSION`, show "update the app" and **don't write**.
  If it is older, run migrations `vN → vN+1` in sequence, then validate.
- Every shape change bumps `SCHEMA_VERSION` and adds a migration, plus a test that loads a
  checked-in fixture of the previous version.
- Fields are never renamed, removed or repurposed in place.
- Money: `amountMinor` (integer minor units) + ISO 4217 `currency` on the account.
  Liabilities store the positive amount owed.
- IDs are random UUIDs. Balance dates are `YYYY-MM-DD`, and timestamps are ISO-8601 UTC.
- The file is pretty-printed (2-space) so it is human-readable and diffable in Drive history.

### Consequences

- Good, because data compatibility is explicit and tested.
- Good, because one Zod schema gives runtime validation and TypeScript types together.
- Bad, because every format change costs a migration and a fixture. That's deliberate.

### Confirmation

`src/domain/schema.test.ts`. PR template checklist item for schema changes. AGENTS.md
"Ask first" rule.

## More Information

Field reference: `docs/data-model.md`.
