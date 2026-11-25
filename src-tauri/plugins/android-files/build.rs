// No commands for the webview: only the app's Rust export code calls this plugin, so the UI gets
// no new permissions (ADR-0016).
const COMMANDS: &[&str] = &[];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
