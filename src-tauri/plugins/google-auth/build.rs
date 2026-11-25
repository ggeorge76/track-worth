// No commands for the webview: only the app's Rust code calls this plugin (ADR-0019), so the UI
// gets no new permissions.
const COMMANDS: &[&str] = &[];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
