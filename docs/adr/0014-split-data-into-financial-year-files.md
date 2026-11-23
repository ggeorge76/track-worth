---
status: Accepted
date: 2026-11-23
decision-makers: [project owner]
---

# Split the Drive data into one file per financial year, with a local copy on each device

Supersedes [ADR-0005](0005-google-drive-json-file-storage.md) (single JSON file). Builds on
[ADR-0006](0006-data-file-schema-and-migrations.md) (schema versioning) and introduces data-file
schema version 3.

## Context and Problem Statement

All data currently lives in one file, `My Drive/TrackWorth/trackworth-data.json`, and every save
rewrites and re-uploads the whole file. That was fine for a new app, but:

- The owner has **16 years of history** to import, and the data grows every month. At 20–40
  accounts updated monthly to weekly, 16 years is about 4,000–33,000 entries (0.6–5 MB), and it
  keeps growing.
- **Every small edit re-uploads all of it.** That is slow on mobile connections, wasteful, and
  gets worse every year.
- **Reports and charts are next.** They need fast access by account, date range, tag and
  financial year across many years.
- It is a **single-user app**, used on one device at a time. There's no need for live
  multi-device merging, only protection against a stale device overwriting newer data.

How should the data be stored so that saves stay small, start-up stays fast and reports can query
years of history, without giving up "your data is a readable file in your own Drive"
(SOUL.md)?

## Decision Drivers

- **Small writes.** An edit's upload size must not grow with the length of history.
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

Chosen option: **4. One JSON file per financial year, plus a local copy on each device.**

### Drive layout

```
My Drive/TrackWorth/
  settings.json        schemaVersion, settings, and the period of every balance file
  accounts.json        all accounts
  balances/
    2010.json          the financial year starting in 2010 (period recorded in settings.json)
    …
    2025.json          1 Apr 2025 – 31 Mar 2026 (with an April financial year)
    2026.json          current financial year
```

- **`settings.json`** (small) holds `schemaVersion: 3`, the settings (financial-year start month,
  custom tags, base currency), and a `balanceFiles` list. Each entry records a file and its
  **exact period**, e.g. `{ "file": "balances/2025.json", "from": "2025-04-01", "to": "2026-03-31" }`.
  Periods never overlap, and every balance date belongs to exactly one file.
- **`accounts.json`** holds the accounts.
- **Each balance file is named after the year its period starts**, e.g. `2025.json` for a period
  starting on 1 April 2025. It holds only the entries dated within its period, plus its own
  `schemaVersion` and period so it is self-describing.

### Periods, and changing the financial year

- New balance files follow the **current financial-year setting**. When a new financial year
  begins, its file starts the day after the previous file ends.
- **A file only owns the entries dated within its recorded period** (from `settings.json`).
  Readers ignore any entry outside its file's period, and the next write of that file removes it.
  This makes moving entries between files safe even if a save is interrupted (see below).
- **Changing the financial-year setting applies from the current financial year onwards:**
  1. The **current financial year under the new setting** (the one containing today) gets its own
     file, named by the year it starts, covering exactly that year. All entries dated from its
     start onwards move into it.
  2. The **immediately previous file** is shortened or lengthened so it ends the day before the
     new current year starts. Entries in the gap move between these two files.
  3. **Every older file stays exactly as it is.** Only the current and previous files (plus
     `settings.json`) are ever rewritten.
  4. **Name clash:** a shortened previous file could start in the same year as the new current
     file. In that case its leftover months join the file before it instead, which then becomes
     longer than 12 months. This happens when moving the financial year start later in the
     calendar.
- **Example A, Apr–Mar → Jan–Dec**, changed in Nov 2026:

  | File                  | Before (Apr–Mar)    | After (Jan–Dec)                              |
  | --------------------- | ------------------- | -------------------------------------------- |
  | `2024.json` and older | Apr 2024 – Mar 2025 | unchanged                                    |
  | `2025.json`           | Apr 2025 – Mar 2026 | **Apr 2025 – Dec 2025** (shortened)          |
  | `2026.json` (current) | Apr 2026 – Mar 2027 | **Jan 2026 – Dec 2026** (gains Jan–Mar 2026) |

- **Example B, Jan–Dec → Apr–Mar**, changed in Nov 2026:

  | File                  | Before (Jan–Dec)    | After (Apr–Mar)                                         |
  | --------------------- | ------------------- | ------------------------------------------------------- |
  | `2024.json` and older | Jan 2024 – Dec 2024 | unchanged                                               |
  | `2025.json`           | Jan 2025 – Dec 2025 | **Jan 2025 – Mar 2026** (15 months, gains Jan–Mar 2026) |
  | `2026.json` (current) | Jan 2026 – Dec 2026 | **Apr 2026 – Mar 2027**                                 |

  Here the leftover Jan–Mar 2026 can't stay in its own file, because that file would also be
  named `2026`. So it joins `2025.json` (rule 4).

- **Write order for a change:** first the file that gains entries, then the file that loses
  them, then `settings.json` with the new periods. Until `settings.json` is written, the old
  periods decide ownership, so an interrupted change shows the data exactly as before, with no
  duplicates and no gaps. Repeating the change completes it.
- **Earlier history** (dates before the first file, e.g. during an import) gets files of 12
  months each under the current setting, working backwards from the earliest existing file's
  start date.
- Stats such as "This financial year" always use the **current setting**. The file split is a
  storage detail only.

### Writes

- **Editing a balance rewrites only its year file**, a few KB to tens of KB regardless of total
  history. Past years are almost never touched.
- **Account changes rewrite only `accounts.json`.** **Settings changes rewrite only `settings.json`**, except a financial-year change, which also rewrites the current and previous balance files (see above).
- **Multi-file changes** (creating an account with an opening balance, creating a new year file,
  an import) write in this order: **balance files, then `accounts.json`, then `settings.json`**.
  If a save is interrupted, the worst case is an entry whose account isn't listed yet, or a new
  year file not yet listed in `settings.json`. Readers ignore both, and the next successful save
  tidies them up. Nothing is ever referenced before it exists.
- **Stale-device protection is per file.** Each file's Drive `version` is checked before writing
  (as before). A device holding old data gets "Reload to see the latest" instead of overwriting.
  No merging is needed for one-device-at-a-time use.
- **Imports** write all year files, then `accounts.json`, then `settings.json`, once.

### Local copy on the device

- After download, each file is kept in a **local cache together with its Drive `version`**.
- At start-up the app lists the folder (one request, which returns each file's version) and
  **downloads only files whose version changed**. Normally that is nothing, or the current year,
  so start-up stays fast with any amount of history.
- **Where:** the webview's IndexedDB. It needs no new dependency and is private to the app. The
  cache is **cleared on sign-out**, and Drive always remains the source of truth.
- This also enables **viewing offline** (N-8). Saving still needs a connection.
- **Privacy policy:** the policy currently says loaded data is "held in memory only". It is
  updated in the same release to describe the on-device copy and that it is removed on sign-out.

### Queries for reports and charts

- Data for the loaded years is held **in memory**, indexed by account and date. Even 50,000
  entries are processed in milliseconds.
- Reports call a small **query layer** in `src/domain/` (by account, date range, tag, financial
  year) instead of scanning raw arrays. If a future report ever needs a real database, that layer
  can be backed by a local SQLite database without changing the screens. Doing that would need
  its own ADR.

### Migration from v2

1. On first load of a v2 `trackworth-data.json`, the app splits its balances into year files
   using the current financial-year setting.
2. It writes the balance files, then `accounts.json`, then `settings.json` (v3), and reads them
   back to verify.
3. **Only after successful verification is the old file deleted.** It is moved to Drive's trash,
   which Drive empties automatically after 30 days, so it stays recoverable for a while.

A v2 fixture test covers the split, including entries on both sides of a financial-year boundary.

### Consequences

- Good, because a save's size stays small no matter how much history exists, and start-up only
  fetches what changed.
- Good, because data stays as plain readable JSON in the user's Drive, browsable by year, with
  Drive version history per file.
- Good, because changing the financial-year setting rewrites at most two balance files. Older
  history is never touched.
- Good, because reports get fast in-memory queries through one layer that can be swapped later.
- Good, because it needs no new dependencies and works the same on desktop and Android.
- Bad, because the code is more complex than one file: separate settings and accounts files,
  file periods, multi-file write ordering, a cache and a migration. It is mitigated by keeping
  it in one well-tested storage module.
- Bad, because saves that touch several files are not atomic. The write order makes
  interruptions harmless but not invisible. An orphan entry or unlisted file can exist until the
  next save.
- Bad, because the local cache stores financial data on the device. That needs the
  privacy-policy update above.

### Confirmation

- Tests for the storage module:
  - which file a date belongs to, including financial-year boundaries;
  - financial-year changes in both directions (examples A and B): only the current and
    previous files change, there is no overlap, gap or name clash, and an interrupted change
    shows the data unchanged;
  - backwards file creation for imports;
  - write ordering and orphan handling;
  - per-file conflict refusal;
  - cache hits and misses by Drive version;
  - v2 → v3 migration from a fixture, with the old file trashed only after verification.
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

**Owner decisions (2026-11-23):**

1. Files per **financial year**, using the current setting. Files are **named by the year their
   period starts**, with the periods recorded in a **separate settings file**. A
   financial-year change applies from the **current financial year** onwards. The current year
   follows the new setting immediately, the previous file is shortened or lengthened to meet it,
   and all older files remain intact (examples A and B).
2. **Local copy on the device**, with the matching privacy-policy update.
3. **Delete the old v2 file** after a successful migration (moved to Drive's trash).

**Order of work:**

1. The storage module plus the v2 → v3 migration (one PR).
2. The importer for the 16 years of history.
3. Reports and charts on top of the query layer.
