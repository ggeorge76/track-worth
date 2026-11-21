/**
 * Central app configuration for the frontend.
 * OAuth client details live in the Rust side (src-tauri/src/config.rs), not here.
 */
export const config = {
  appVersion: __APP_VERSION__,
  /** GitHub "owner/repo" that publishes releases (ADR-0007). */
  githubRepo: 'ggeorge76/track-worth',
  /**
   * Fixed location of the data file in the user's My Drive (ADR-0005).
   * Changing these is a breaking change for existing users and requires a migration plan.
   */
  drive: {
    folderName: 'TrackWorth',
    fileName: 'trackworth-data.json',
  },
} as const;

export function releaseNotesUrl(version: string): string {
  return `https://github.com/${config.githubRepo}/releases/tag/v${version}`;
}
