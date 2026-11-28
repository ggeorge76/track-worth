# Releasing

How a change reaches installed apps (ADR-0007, ADR-0008, ADR-0010).

## One-time setup

1. **Updater signing key.** Generated once on the owner's machine:

   ```bash
   bunx tauri signer generate -w ~/.tauri/trackworth.key
   ```

   - The **public key** (`~/.tauri/trackworth.key.pub`) is in `src-tauri/tauri.conf.json` →
     `plugins.updater.pubkey`.
   - The **private key** must **never** be committed. Back it up somewhere safe and offline
     (for example, a password manager). **If it is lost, installed apps can never auto-update
     again.** If it leaks, anyone could sign updates for your users. Rotate it by shipping a
     release with a new public key, signed with the old key.

2. **GitHub repository secrets** (Settings → Secrets and variables → Actions):

   | Secret                               | Value                                      |
   | ------------------------------------ | ------------------------------------------ |
   | `TAURI_SIGNING_PRIVATE_KEY`          | contents of `~/.tauri/trackworth.key`      |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the key's password (empty if none was set) |
   | `TRACKWORTH_GOOGLE_CLIENT_ID`        | Google OAuth Desktop client ID             |
   | `TRACKWORTH_GOOGLE_CLIENT_SECRET`    | Google OAuth Desktop client secret         |

   With the GitHub CLI: `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/trackworth.key`.

3. **Workflow permissions:** Settings → Actions → General → Workflow permissions →
   **Read and write**, and tick **Allow GitHub Actions to create and approve pull requests**
   (needed by release-please).

## Each release

1. Merge `dev` into `main` (via PR).
2. release-please opens or updates a PR named `chore(main): release X.Y.Z`. Review the
   generated CHANGELOG.
3. Before merging, tidy the release PR: remove duplicate CHANGELOG entries (merge commits repeat
   them) and set `src-tauri/Cargo.lock`'s `trackworth` version to the new one (release-please
   doesn't update the lock file).
4. Merge it with a merge commit. This creates tag `vX.Y.Z` and the GitHub Release **as a draft**
   (`draft` + `force-tag-creation` in `release-please-config.json`; the tag is created right
   away so release-please finds it next time).
5. The `desktop` job builds installers for macOS (universal), Windows and Linux, signs the update
   bundles, and uploads them plus `latest.json`. The `android` job uploads the signed AAB and
   APK. This takes about 15–25 minutes.
6. When every build has succeeded, the `publish` job makes the release public and marks it
   latest. If a build fails, the release stays a draft that users can't see. Re-run the failed
   job ("Re-run failed jobs"), and `publish` runs after it.
7. Installed desktop apps see the update within an hour (or on next launch) and offer it to the
   user. Upload the AAB to Google Play yourself (closed testing or production).
8. Sync `main` back into `dev` with a PR from a branch made from `main`, merged with a merge
   commit.

## Smoke test before announcing

On at least one OS: install the new version from the release page, sign in, check the data
loads, and confirm an older install offers the update and restarts into the new version.

## Local release build

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/trackworth.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  bun run app:build
```

Output goes to `src-tauri/target/release/bundle/`.
