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
