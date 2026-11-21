mod auth;
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init());

    // Self-update from GitHub Releases (ADR-0007). Desktop only.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(auth::AuthState::new())
        .invoke_handler(tauri::generate_handler![
            auth::auth_sign_in,
            auth::auth_restore,
            auth::auth_access_token,
            auth::auth_sign_out,
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
