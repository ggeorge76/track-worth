---
status: Accepted
date: 2026-11-23
decision-makers: [project owner]
---

# Save exports with the system "Save as…" dialog, written by Rust

## Context and Problem Statement

R-S2 asks for an export: everything as JSON, and the balances as CSV for a spreadsheet. The
webview can't write files, and a browser-style download doesn't work reliably inside the Tauri
webview. How should the app save an export to a place the user chooses, without giving the UI
more power than it needs?

## Decision Drivers

- Least privilege: capabilities stay narrow, with no wildcards (AGENTS.md "Never").
- The user picks where the file goes, as they would in any desktop app.
- Few dependencies, and only official Tauri plugins (SOUL.md "Boring technology").
- Must work later on Android (ADR-0009).

## Considered Options

1. **Rust command plus the dialog plugin.** The UI passes a suggested file name and the text.
   Rust shows the save dialog and writes to the chosen path.
2. **The dialog and fs plugins, called from the UI.** The UI shows the dialog, then writes through
   the fs plugin.
3. **Write the export into Drive** (`TrackWorth/exports/`) and let the user download it from
   there.

## Decision Outcome

Chosen option: **1**. It adds one official plugin (`tauri-plugin-dialog`, Rust crate only, no JS
package). The UI is granted **no** dialog or file-system permission. The only new ability it gets
is the `export_save` command, which:

- accepts only a plain `.json` or `.csv` file name (no folders), and
- writes only where the user picked in the dialog.

### Consequences

- Good: no capability changes, and the webview can't read or write arbitrary files.
- Good: a familiar "Save as…" flow, and a cancelled dialog is simply nothing happening.
- Bad: one more crate (and its `rfd` dependency) to keep updated.
- Neutral: in a plain browser (`bun run dev`, e2e) the file is downloaded instead.

### Confirmation

- `src-tauri/src/export.rs` unit tests cover the file-name checks.
- `src-tauri/capabilities/` gains no `dialog:` or `fs:` permissions.
- `src/services/export/saveExport.test.ts` covers the desktop and browser paths.

## Pros and Cons of the Options

### Option 2

- Good, because it's the usual Tauri recipe.
- Bad, because it needs two plugins and fs write permissions with a path scope. That is
  broader than one file the user picked.

### Option 3

- Good, because it needs no new plugins.
- Bad, because the user doesn't get a file on their computer directly. It also writes more
  files into Drive.

## More Information

- **Android** (done): the dialog returns a content URI rather than a file path, so our own
  plugin `src-tauri/plugins/android-files` opens Android's "Save to…" picker
  (`ACTION_CREATE_DOCUMENT`) and writes to the chosen document. As on desktop, only Rust calls
  it, so the UI gets no file-system access.
- The exported JSON has the same shape as the in-app data (schema v3). Restoring from it isn't
  built yet. That would be part of the importer work.
