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
3. Merge it. This creates tag `vX.Y.Z` and the GitHub Release.
4. The `desktop` job builds installers for macOS (universal), Windows and Linux, signs the update
   bundles, and uploads them plus `latest.json` to the release. This takes about 15–25 minutes.
5. Installed apps see the update within an hour (or on next launch) and offer it to the user.

## Smoke test before announcing

On at least one OS: install the new version from the release page, sign in, check the data
loads, and confirm an older install offers the update and restarts into the new version.

## Local release build

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/trackworth.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  bun run app:build
```

Output goes to `src-tauri/target/release/bundle/`.
