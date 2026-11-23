import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

/** True inside the TrackWorth desktop app; false in a plain browser (dev server, e2e). */
export function isDesktopApp(): boolean {
  return isTauri();
}

/**
 * fetch for Google APIs. Inside the app, requests go through the Rust HTTP plugin: the webview
 * itself has no network access (CSP), and allowed URLs are listed in
 * src-tauri/capabilities/default.json.
 */
export const httpFetch: typeof fetch = (input, init) =>
  isDesktopApp() ? tauriFetch(input, init) : fetch(input, init);

/**
 * Open a web page in the user's browser. Inside the desktop app this goes through the opener
 * plugin, which only allows the URLs listed in src-tauri/capabilities/default.json.
 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktopApp()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
