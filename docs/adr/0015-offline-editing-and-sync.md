---
status: Proposed
date: 2026-11-23
decision-makers: [project owner]
---

# Offline editing: save on the device, upload when back online

Builds on [ADR-0014](0014-split-data-into-financial-year-files.md) (financial-year files and the
local copy) and [ADR-0004](0004-google-oauth-desktop-loopback-pkce.md) (sign-in).

## Context and Problem Statement

Since ADR-0014, each device keeps a local copy of the Drive files. The owner wants to **open the
app, view data and make changes without a connection**, with changes uploaded automatically once
the device is back online.

It's a single-user app used on one device at a time, so Drive rarely changes while a device is
offline. It can happen, though, for example after editing on a laptop, then on a phone, then
reconnecting the laptop. The rules must keep both sides' work without silent loss.

## Decision Drivers

- No data loss: offline changes must survive app restarts, and nothing is overwritten silently.
- Calm, honest UI (SOUL.md): always show whether changes are uploaded or waiting.
- Owner decisions: **balances merge automatically**; for **accounts and settings, ask the user
  to keep this device's version or Drive's version, with no merge option**.
- Reuse ADR-0014's store: the same files, write order and version checks.

## Considered Options

1. **A local working copy with a pending flag, synced by comparing three versions** (what was last
   synced, what this device has now, what Drive has now)
2. A log of individual operations replayed on reconnect
3. Offline viewing only

## Decision Outcome

Chosen option: **1. A local working copy with a pending flag and three-way sync.**

### The working copy

- The app keeps a **workspace** in the device's private storage (IndexedDB, next to the local copy
  of the files). It holds:
  - the current data, including unsynced changes;
  - the **base**: the data and file versions as last synced with Drive;
  - a pending-changes count;
  - the signed-in user's display name, so the header works offline.
- Every edit updates the workspace first, so **it survives closing the app**. Then the app tries
  to upload.
- **Uploaded** means the store's save succeeded against the base (ADR-0014's write order and
  version checks). After that, the base moves forward and the pending count resets.

### Going offline and coming back

- **Offline is detected from failed requests** (no connection, DNS failure, timeout), not just the
  operating system's network flag, which can be wrong. When a request fails that way, edits stay
  in the workspace marked "waiting to upload".
- **Retry:** when the system reports it is back online, every 30 seconds while changes are
  waiting, and on app start.
- **Starting offline:** sign-in normally refreshes the Google token over the network. If that
  fails for lack of a connection and a workspace exists, the app opens in **offline mode** with
  the cached display name. When the connection returns, it signs in silently with the refresh
  token from the OS keychain and syncs. A revoked or expired sign-in still sends the user to
  the sign-in screen, and pending changes are kept until the next successful sign-in to the same
  account.

### Syncing when Drive also changed (three-way)

When uploading, the app first loads Drive's current data (only changed files are downloaded). If
Drive still matches the base, it simply uploads. Otherwise it combines three versions: **base**
(last synced), **local** (this device) and **remote** (Drive now).

- **Balances: merge automatically, per entry.**
  - Entries changed or added on only one side are taken from that side.
  - If both sides changed the same entry, the later `recordedAt` wins.
  - If both sides added an entry for the same account and date, the later `recordedAt` wins
    (keeping the "one entry per account per day" rule).
  - An entry removed on one side and unchanged on the other is removed. This is for when
    deleting entries is added later.
- **Accounts: decide per account.**
  - Changed (or created) on only one side: taken from that side, no question asked.
  - Changed on both sides, differently: **ask the user to keep this device's version or Drive's
    version of that account.** There is no field-by-field merge.
- **Settings: decide as a whole.** If both sides changed settings differently, ask: keep this
  device's settings or Drive's.
- The question shows what differs, in plain language, and nothing is uploaded until it's
  answered. The merged result is then saved with the usual store rules (ADR-0014).

### Status the user sees

- A small status in the header:
  - "All changes saved";
  - "Offline · N changes waiting to upload";
  - "Uploading…";
  - "Needs your decision" (opens the question above).
- **Signing out with changes waiting** shows a warning first. Signing out deletes the workspace
  and the local copy (ADR-0014), so those changes would be lost.

### Consequences

- Good, because the app is fully usable without a connection, and changes upload by themselves.
- Good, because balances, by far the most frequent edit, never need a decision.
- Good, because it reuses the existing store, files, write order and version checks.
- Bad, because there is more state to get right: workspace, base, pending count, retry, offline
  sign-in. It is mitigated by keeping the merge as pure, heavily tested functions.
- Bad, because the workspace stores data and the display name on the device. The privacy policy
  must mention the display name, and that changes made offline are kept on the device until
  uploaded.
- Bad, because if the device is lost before reconnecting, its unsynced changes are lost.

### Confirmation

- Pure tests for the three-way merge:
  - balance changes on one side and on both sides;
  - same account and date added on both sides;
  - account changes on one side or both, producing a question;
  - settings conflicts.
- Store and hook tests:
  - edits while offline are kept, also across a simulated restart;
  - upload on reconnect with Drive unchanged;
  - merge when Drive changed;
  - the conflict question flow;
  - warning when signing out with pending changes;
  - offline start with the cached name.

## Pros and Cons of the Options

### 2. Operation log

- Good, because it records intent precisely.
- Bad, because it needs replay logic for every operation type, and ordering and compaction rules.
  That is more machinery than one user on one device at a time needs.

### 3. Offline viewing only

- Good, because it is simple.
- Bad, because it doesn't meet the requirement.

## More Information

**Owner decisions (2026-11-23):** offline **editing** is wanted; balances merge automatically;
accounts and settings ask "keep this device's / keep Drive's" with no merge option.

**Refinement for approval:** accounts are decided **per account**, so creating an account offline
never needs a question, and choosing Drive's version of one account doesn't discard others.

**Order of work:**

1. Offline viewing and offline start.
2. Offline editing with the workspace, upload queue and three-way sync.
