/**
 * Central app configuration for the frontend.
 * OAuth client details live in the Rust side (src-tauri/src/config.rs), not here.
 */
export const config = {
  appVersion: __APP_VERSION__,
  /** GitHub "owner/repo" that publishes releases (ADR-0007). */
  githubRepo: 'ggeorge76/track-worth',
  /**
   * Fixed folder in the user's My Drive that holds the data files (ADR-0014).
   * Changing these is a breaking change for existing users and requires a migration plan.
   */
  drive: {
    folderName: 'TrackWorth',
  },
} as const;

/**
 * App logo for the UI (256 px, shown at up to 128 CSS px). Relative so it resolves inside the
 * desktop app too. Source and other sizes: assets/branding/.
 */
export const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

/** Wordmark-free symbol for small spots (48 CSS px and below), e.g. the header. */
export const symbolUrl = `${import.meta.env.BASE_URL}symbol.png`;

export function releaseNotesUrl(version: string): string {
  return `https://github.com/${config.githubRepo}/releases/tag/v${version}`;
}
