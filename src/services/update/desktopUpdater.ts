import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { isDesktopApp } from '@/services/platform';

/**
 * Thin wrapper over the Tauri updater (ADR-0007). The updater reads `latest.json` from the latest
 * GitHub Release, compares versions and verifies the update's signature before installing.
 */

export interface AvailableUpdate {
  version: string;
  notes: string;
  /** Download, verify and install, reporting progress 0..1 (or null if size unknown). */
  install: (onProgress?: (fraction: number | null) => void) => Promise<void>;
}

function wrap(update: Update): AvailableUpdate {
  return {
    version: update.version,
    notes: update.body ?? '',
    async install(onProgress) {
      let total: number | undefined;
      let received = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') total = event.data.contentLength;
        if (event.event === 'Progress') {
          received += event.data.chunkLength;
          onProgress?.(total ? received / total : null);
        }
      });
    },
  };
}

/** Resolves null when up to date, or when not running inside the desktop app. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktopApp()) return null;
  const update = await check();
  return update ? wrap(update) : null;
}

export async function restartApp(): Promise<void> {
  await relaunch();
}
