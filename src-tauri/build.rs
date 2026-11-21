//! Compiles the Google OAuth client into the binary (see src/config.rs).
//! Values come from the environment (CI) or, for local development, from ../.env.local.

const VARS: [&str; 2] = [
    "TRACKWORTH_GOOGLE_CLIENT_ID",
    "TRACKWORTH_GOOGLE_CLIENT_SECRET",
];

fn main() {
    println!("cargo:rerun-if-changed=../.env.local");
    // tauri-build only watches the config files, but `generate_context!` embeds the icons
    // (the dev-mode Dock icon and the window icon). Rebuild when any icon changes.
    println!("cargo:rerun-if-changed=icons");
    let local = std::fs::read_to_string("../.env.local").unwrap_or_default();
    for var in VARS {
        println!("cargo:rerun-if-env-changed={var}");
        let value = std::env::var(var)
            .ok()
            .filter(|v| !v.is_empty())
            .or_else(|| {
                local.lines().find_map(|line| {
                    let (key, value) = line.split_once('=')?;
                    (key.trim() == var).then(|| value.trim().trim_matches('"').to_string())
                })
            });
        if let Some(value) = value.filter(|v| !v.is_empty()) {
            println!("cargo:rustc-env={var}={value}");
        }
    }
    tauri_build::build();
}
