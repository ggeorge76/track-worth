/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** "true" when the Tauri CLI builds or runs a debug build (desktop or Android). */
  readonly TAURI_ENV_DEBUG?: string;
}
