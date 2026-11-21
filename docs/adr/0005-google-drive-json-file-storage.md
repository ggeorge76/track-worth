---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Store all data as one JSON file at a fixed path in the user's Google Drive

## Context and Problem Statement

Requirement: data is a JSON file in the user's Google Drive, pulled from a fixed path after
sign-in. Where exactly, with which permissions, and how do we avoid losing data when two
devices edit?

## Decision Drivers

- The user can see, back up and download their own data.
- Least-privilege scope (`drive.file`, ADR-0004).
- All Drive calls go through the Rust HTTP plugin, limited to the Drive v3 URLs in
  `src-tauri/capabilities/default.json` (ADR-0003).
- No silent data loss with multiple devices.
- Simple enough to reason about. Data volume is tiny (hundreds of accounts, thousands of entries).

## Considered Options

- Visible file in My Drive: **`TrackWorth/trackworth-data.json`** with `drive.file`
- Hidden `appDataFolder` with the `drive.appdata` scope
- Any user-chosen path with the full `drive` scope
- One file per account or per year

## Decision Outcome

Chosen option: **visible `My Drive/TrackWorth/trackworth-data.json` with `drive.file`.**

- On first sign-in, the app creates the folder and the file (empty data file, ADR-0006).
- Lookup: find the folder by name under `root`, then the file by name in that folder, excluding
  trashed items. If there are duplicates, pick the oldest by `createdTime`.
- Read: `files.get?alt=media`. Write: `uploadType=media` PATCH.
- **Optimistic concurrency.** We keep the Drive `version` from the last read. Before each
  write, we re-read `version`. If it changed, another device saved, so we raise a `conflict`
  and ask the user to reload. We never overwrite blindly.
- Path constants live in `src/config.ts`. Changing them is a breaking change.

### Consequences

- Good, because the user can see the file in Drive and benefits from Drive's own version
  history, which works as a free backup.
- Good, because `drive.file` means the app can't see any other user files.
- Bad, because `drive.file` can't see a file the user creates or uploads by hand, even at the
  same path. If someone restores a backup by uploading it, the app won't find it. Mitigation
  (roadmap): an "Open existing file" action using the Google Picker, which grants `drive.file`
  access to the picked file.
- Bad, because if the user renames or moves the file, the app will create a new empty one.
  Mitigation (roadmap): remember the file ID locally and fall back to the path.
- Bad, because whole-file rewrites aren't granular. Acceptable at this data size.

### Confirmation

`src/services/drive/driveClient.test.ts` covers first-run creation, reading and conflict refusal.

## Pros and Cons of the Options

### appDataFolder

- Good, because the user can't accidentally break it.
- Bad, because the file is invisible to the user, which goes against "the user owns their data
  physically".

### Full `drive` scope

- Good, because it handles any path and manually uploaded files.
- Bad, because it is a restricted scope that needs a CASA security assessment, and it is far
  more access than the app needs.

### Multiple files

- Bad, because it complicates atomicity and conflict detection for no benefit at this size.
