mod auth;
#[cfg(desktop)]
mod config;
mod export;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        // Rust-only: the save dialog for exports (ADR-0016). No dialog permission is granted to the UI.
        .plugin(tauri_plugin_dialog::init());

    // Self-update from GitHub Releases (ADR-0007). Desktop only.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    // Google sign-in through Play services (ADR-0019).
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_google_auth::init());

    builder
        .manage(auth::AuthState::new())
        .invoke_handler(tauri::generate_handler![
            auth::auth_sign_in,
            auth::auth_restore,
            auth::auth_access_token,
            auth::auth_sign_out,
            export::export_save,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TrackWorth");
}
