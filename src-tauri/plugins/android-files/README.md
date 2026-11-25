# tauri-plugin-android-files (TrackWorth, Android only)

"Save to…" for exports on Android (ADR-0016). Android's document picker
(`ACTION_CREATE_DOCUMENT`) lets the user choose where the file goes, and the Kotlin side writes
the text there. It registers no webview commands; `src-tauri/src/export.rs` calls it from Rust.
