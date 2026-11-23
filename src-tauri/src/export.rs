//! Saving an export (R-S2, ADR-0016). Rust shows the system "Save as…" dialog and writes the
//! file to the place the user picked. The webview never gets general file-system access: it can
//! only hand over a suggested file name and the text to save.

use serde::ser::{Serialize, SerializeStruct, Serializer};
use tauri_plugin_dialog::DialogExt;

/// Errors returned to the frontend as `{ code, message }`. Messages are shown to users.
#[derive(Debug, thiserror::Error)]
pub enum ExportError {
    #[error("That export can't be saved. Please try again.")]
    InvalidName,
    #[error("Couldn't save the file there. Try another folder. ({0})")]
    Write(String),
}

impl ExportError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidName => "invalid-name",
            Self::Write(_) => "write",
        }
    }
}

impl Serialize for ExportError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("ExportError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// Only plain `.json` / `.csv` names suggested by the app are accepted (no folders), so the UI
/// can't use this command to pick where a file goes; only the user can, in the dialog.
/// Returns the filter to show in the dialog.
fn filter_for(file_name: &str) -> Result<(&'static str, &'static str), ExportError> {
    let plain = !file_name.is_empty()
        && file_name.len() <= 100
        && !file_name.starts_with('.')
        && file_name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !plain {
        return Err(ExportError::InvalidName);
    }
    match file_name.rsplit_once('.') {
        Some((_, "json")) => Ok(("JSON", "json")),
        Some((_, "csv")) => Ok(("CSV", "csv")),
        _ => Err(ExportError::InvalidName),
    }
}

/// Asks where to save `contents`, suggesting `file_name`. Resolves `false` if the user cancels.
/// Async so the blocking dialog runs off the main thread.
#[tauri::command]
pub async fn export_save(
    app: tauri::AppHandle,
    file_name: String,
    contents: String,
) -> Result<bool, ExportError> {
    let (label, extension) = filter_for(&file_name)?;
    let Some(chosen) = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter(label, &[extension])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = chosen
        .into_path()
        .map_err(|e| ExportError::Write(e.to_string()))?;
    std::fs::write(&path, contents).map_err(|e| ExportError::Write(e.to_string()))?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_json_and_csv_names() {
        assert_eq!(
            filter_for("trackworth-backup-2026-11-23.json").ok(),
            Some(("JSON", "json"))
        );
        assert_eq!(
            filter_for("trackworth_balances.csv").ok(),
            Some(("CSV", "csv"))
        );
    }

    #[test]
    fn rejects_paths_other_types_and_odd_names() {
        for name in [
            "",
            "../evil.json",
            "/etc/passwd.csv",
            "dir/file.csv",
            "C:\\x.csv",
            ".json",
            "notes.txt",
            "script.sh",
            "no-extension",
            "space name.csv",
            &format!("{}.csv", "a".repeat(100)),
        ] {
            assert!(filter_for(name).is_err(), "{name} should be rejected");
        }
    }

    #[test]
    fn errors_serialize_with_a_code() {
        let json = serde_json::to_value(ExportError::Write("denied".into())).unwrap();
        assert_eq!(json["code"], "write");
        assert!(json["message"].as_str().unwrap().contains("denied"));
    }
}
