//! Saving an export on Android (ADR-0016): Android's "Save to…" picker
//! (`ACTION_CREATE_DOCUMENT`), then the text is written to the chosen document. Only the app's
//! Rust export code calls this; the webview has no access to it.

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveArgs<'a> {
    file_name: &'a str,
    mime_type: &'a str,
    contents: &'a str,
}

#[derive(Deserialize)]
struct SaveResult {
    saved: bool,
}

pub struct AndroidFiles<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> AndroidFiles<R> {
    /// Asks where to save, suggesting `file_name`, and writes `contents` there. `Ok(false)` if
    /// the user cancels. Blocks: call off the async runtime.
    pub fn save(&self, file_name: &str, mime_type: &str, contents: &str) -> Result<bool, String> {
        self.0
            .run_mobile_plugin::<SaveResult>(
                "save",
                SaveArgs {
                    file_name,
                    mime_type,
                    contents,
                },
            )
            .map(|r| r.saved)
            .map_err(|e| e.to_string())
    }
}

pub trait AndroidFilesExt<R: Runtime> {
    fn android_files(&self) -> &AndroidFiles<R>;
}

impl<R: Runtime, T: Manager<R>> AndroidFilesExt<R> for T {
    fn android_files(&self) -> &AndroidFiles<R> {
        self.state::<AndroidFiles<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-files")
        .setup(|app, api| {
            // Only built for Android (see the app's Cargo.toml).
            let handle =
                api.register_android_plugin("com.trackworth.androidfiles", "AndroidFilesPlugin")?;
            app.manage(AndroidFiles(handle));
            Ok(())
        })
        .build()
}
