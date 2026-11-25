# tauri-plugin-google-auth (TrackWorth, Android only)

Google sign-in for the Android app (ADR-0019). The Kotlin side
(`android/src/main/java/com/trackworth/googleauth/GoogleAuthPlugin.kt`) uses Google Play
services' `AuthorizationClient`. The Rust side (`src/lib.rs`) exposes `authorize` and
`clear_token` to the app's auth code in `src-tauri/src/auth`.

The plugin registers no webview commands, so the UI can't call it and needs no permissions.
