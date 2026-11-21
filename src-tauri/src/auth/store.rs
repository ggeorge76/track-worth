//! Refresh token storage in the OS secure store (macOS Keychain, Windows Credential Manager,
//! Linux Secret Service). Never written to disk by us, never sent to the webview.

use super::error::AuthError;

const SERVICE: &str = "com.trackworth.desktop";
const ACCOUNT: &str = "google-refresh-token";

fn entry() -> Result<keyring::Entry, AuthError> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| AuthError::Keychain(e.to_string()))
}

pub fn load() -> Result<Option<String>, AuthError> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AuthError::Keychain(e.to_string())),
    }
}

pub fn save(token: &str) -> Result<(), AuthError> {
    entry()?
        .set_password(token)
        .map_err(|e| AuthError::Keychain(e.to_string()))
}

pub fn clear() -> Result<(), AuthError> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AuthError::Keychain(e.to_string())),
    }
}
