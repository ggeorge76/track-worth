---
status: Proposed
date: 2026-11-23
decision-makers: [project owner]
---

# Split the Drive data into one file per financial year, with a local copy on each device

Refines [ADR-0005](0005-google-drive-json-file-storage.md) (single JSON file) and
[ADR-0006](0006-data-file-schema-and-migrations.md) (schema versioning). If accepted, ADR-0005 is
superseded and this introduces data-file schema version 3.

## Context and Problem Statement

Today all data lives in one file, `My Drive/TrackWorth/trackworth-data.json`, and every save
rewrites and re-uploads the whole file. That was fine for a new app, but:

- The owner has **16 years of history** to import, and the data grows every month. At 20–40
  accounts updated monthly to weekly, 16 years is about 4,000–33,000 entries (0.6–5 MB), and it
  keeps growing.
- **Every small edit re-uploads all of it.** That is slow on mobile connections and wasteful,
  and it gets worse each year.
- **Reports and charts are next.** They need fast access by account, date range and tag across
  many years.
- It is a **single-user app**, used on one device at a time. There's no need for live
  multi-device merging, only protection against a stale device overwriting newer data.

How should the data be stored so that saves stay small, start-up stays fast and reports can
query years of history, without giving up "your data is a readable file in your own Drive"
(SOUL.md)?

## Decision Drivers

- **Small writes.** An edit's upload size should not grow with the length of history.
- **Fast start-up** with decades of data.
- **Queryable** for reports: by account, date range, tag and financial year.
- **The user owns readable data.** Plain files in their Drive, usable without the app, with
  Drive version history (SOUL.md).
- **No server**, minimal new dependencies, works on desktop and (later) Android.
- **No data loss.** An interrupted save must never leave a broken or inconsistent dataset.

## Considered Options

1. **Keep one JSON file** (status quo), perhaps saved without pretty-printing.
2. **A SQLite database file in Drive.**
3. **A local SQLite database as the working copy, synced to Drive** (as a database file or a
   change log).
4. **JSON split into one file per financial year, plus a local copy on each device.**
5. **One file per account.**

## Decision Outcome

Proposed: **option 4, one JSON file per financial year plus a local copy on each device.**

### Drive layout

```
My Drive/TrackWorth/
  trackworth.json              index: schemaVersion, settings, accounts, list of year files
  balances/
    FY2010-11.json             balances dated 2010-04-01 … 2011-03-31
    …
    FY2025-26.json             balances dated 2025-04-01 … 2026-03-31
    FY2026-27.json             current financial year
```

- **`trackworth.json`** (small) holds `schemaVersion: 3`, `settings`, `accounts`, and a
  `balanceFiles` list. Each entry records the file name and its **exact date range**:
  `{ "file": "balances/FY2025-26.json", "from": "2025-04-01", "to": "2026-03-31" }`.
- **Each year file** holds only the balance entries dated within its range, plus its own
  `schemaVersion` and range for self-description.
- **Names follow the financial-year setting** when a file is created. With an April start the
  name is `FY2025-26`; with a January start it is `FY2026`.
- **Changing the financial-year setting never rewrites old files.** Existing files keep their
  recorded ranges. New files use the new setting, starting the day after the last existing file
  ends. A one-off transitional file may be shorter or longer than 12 months. Reports read
  ranges from the index, not from file names.
- **Every balance date maps to exactly one file** (ranges never overlap). Saving a balance
  dated before the first file creates a new file for that earlier financial year.

### Writes

- **Editing a balance rewrites only its year file**, a few KB to tens of KB regardless of total
  history. Past years are almost never touched.
- **Account and settings changes rewrite only `trackworth.json`.**
- **Multi-file changes** (for example, creating an account with an opening balance, or an
  import) write the **year files first and `trackworth.json` last**. If a save is interrupted,
  the worst case is an entry whose account isn't in the index yet. Readers ignore such orphan
  entries, and the next successful save cleans them up. A year file is never referenced before
  it exists.
- **Stale-device protection is per file.** Each file's Drive `version` is checked before
  writing (as today, ADR-0005). A device with old data gets "Reload to see the latest" instead of
  overwriting. No merging is needed for one-device-at-a-time use.
- **Imports** write all year files, then the index once.

### Local copy on the device

- After download, each file is kept in a **local cache together with its Drive `version`**.
- At start-up the app lists the folder (one request, which returns each file's version) and
  **downloads only files whose version changed**. Normally that is nothing, or the current
  year's file, so start-up is fast with any amount of history.
- **Where:** the webview's IndexedDB. It needs no new dependency and is private to the app. The
  cache is **cleared on sign-out**, and Drive always remains the source of truth.
- This also enables **viewing offline** (N-8). Saving still needs a connection.

### Queries for reports and charts

- All data for the loaded years is held **in memory**, indexed by account and date. Even 50,000
  entries are processed in milliseconds.
- Reports call a small **query layer** in `src/domain/` (by account, date range, tag, financial
  year) instead of scanning raw arrays. If a future report ever needs a real database, that layer
  can be backed by a local SQLite database without changing the screens. Doing that would need
  its own ADR.

### Migration from v2

- On first load of a v2 `trackworth-data.json`, the app splits its balances into year files
  using the current financial-year setting. It writes the year files, then
  `trackworth.json` (v3).
- The **old file is left untouched** as a backup. It is renamed to
  `trackworth-data.v2-backup.json` only after the v3 index is written successfully, so it isn't
  picked up again.
- A v2 fixture test covers the split, including entries on both sides of a financial-year
  boundary.

### Consequences

- Good, because a save's size stays small no matter how much history exists, and start-up only
  fetches what changed.
- Good, because data stays as plain readable JSON in the user's Drive, browsable by year, with
  Drive version history per file.
- Good, because reports get fast in-memory queries through one layer that can be swapped later.
- Good, because it needs no new dependencies and works the same on desktop and Android.
- Bad, because the code is more complex than one file: an index, file ranges, multi-file write
  ordering, a cache and a migration. It is mitigated by keeping it in one well-tested storage
  module.
- Bad, because saves that touch several files are not atomic. The write order above makes
  interruptions harmless but not invisible. An orphan entry can exist until the next save.
- Bad, because the local cache stores financial data on the device (in addition to memory).
  **This changes a statement in the privacy policy** ("loaded data is held in memory only"),
  which must be updated in the same release (see below).

### Confirmation

- Tests for the storage module:
  - which file a date belongs to, including FY boundaries and changing the FY setting;
  - write ordering and orphan handling;
  - per-file conflict refusal;
  - cache hits and misses by Drive version;
  - v2 → v3 migration from a fixture.
- A performance test: load and query a synthetic 30-year, 50-account dataset within a time
  budget.

## Pros and Cons of the Options

### 1. One JSON file (status quo)

- Good, because it is the simplest and already works.
- Bad, because every edit re-uploads the full, ever-growing history. That's the owner's main
  concern.

### 2. SQLite file in Drive

- Good, because it gives a real query engine.
- Bad, because Drive still uploads the whole file on every save, which doesn't fix the problem.
- Bad, because it is a binary format the user can't read without tools (against SOUL.md).
- Bad, because syncing a SQLite file as a whole through cloud storage is a known way to corrupt
  it.

### 3. Local SQLite plus sync to Drive

- Good, because it gives fast queries and small local writes.
- Bad, because syncing it as a database file brings back option 2's problems. Syncing it as a
  change log needs a sync engine (ordering, compaction, replay), which is much more complexity
  than a single-user app needs.
- Bad, because it adds a native SQL plugin on desktop and Android, and two schemas to keep in
  step.

### 5. One file per account

- Good, because edits touch one account's file.
- Bad, because one account's file still grows forever. Net-worth reports for a date need every
  file, and creating or deleting accounts means creating or deleting files.

## More Information

**Decisions for the owner before acceptance:**

1. **File period:** financial years (as proposed), using the current financial-year setting.
2. **Local cache:** accept storing a copy of the data on the device (IndexedDB, cleared on
   sign-out) for fast start-up and offline viewing, with the matching privacy-policy update.
   Alternative: no cache, downloading all year files at start-up (about 16 small files today).
   That is slower to start, but nothing is stored on the device.
3. **Old v2 file:** keep it as `trackworth-data.v2-backup.json` after migration (as
   proposed), or delete it.

**Order of work once accepted:**

1. The storage module plus the v2 → v3 migration (one PR).
2. The importer for the 16 years of history.
3. Reports and charts on top of the query layer.
