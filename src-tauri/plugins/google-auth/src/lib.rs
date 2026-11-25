//! Google sign-in on Android (ADR-0019), using Google Play services' `AuthorizationClient`.
//! Only the app's Rust auth code calls this; the webview has no access to it.

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

/// Why an authorization didn't return a token.
#[derive(Debug)]
pub enum AuthorizeError {
    /// Silent request, but the user must pick an account or consent first.
    NeedsConsent,
    /// The user closed the account picker or consent screen.
    Cancelled,
    /// Anything else (no Play services, network, misconfigured OAuth client, …).
    Failed(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizeArgs<'a> {
    interactive: bool,
    scopes: &'a [&'a str],
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizeResult {
    access_token: String,
}

#[derive(Serialize)]
struct TokenArgs<'a> {
    token: &'a str,
}

#[derive(Deserialize)]
struct Empty {}

pub struct GoogleAuth<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> GoogleAuth<R> {
    /// An access token for `scopes`. With `interactive`, shows the account picker and consent
    /// when needed; without, fails with `NeedsConsent` instead. Blocks: call off the async
    /// runtime.
    pub fn authorize(&self, interactive: bool, scopes: &[&str]) -> Result<String, AuthorizeError> {
        self.0
            .run_mobile_plugin::<AuthorizeResult>("authorize", AuthorizeArgs { interactive, scopes })
            .map(|r| r.access_token)
            .map_err(|e| match e {
                tauri::plugin::mobile::PluginInvokeError::InvokeRejected(rejected) => {
                    match rejected.code.as_deref() {
                        Some("needs-consent") => AuthorizeError::NeedsConsent,
                        Some("cancelled") => AuthorizeError::Cancelled,
                        _ => AuthorizeError::Failed(rejected.message.unwrap_or_default()),
                    }
                }
                other => AuthorizeError::Failed(other.to_string()),
            })
    }

    /// Forget a token Google Play services cached (after it was rejected or revoked). Blocks.
    pub fn clear_token(&self, token: &str) {
        let _ = self.0.run_mobile_plugin::<Empty>("clearToken", TokenArgs { token });
    }
}

pub trait GoogleAuthExt<R: Runtime> {
    fn google_auth(&self) -> &GoogleAuth<R>;
}

impl<R: Runtime, T: Manager<R>> GoogleAuthExt<R> for T {
    fn google_auth(&self) -> &GoogleAuth<R> {
        self.state::<GoogleAuth<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("google-auth")
        .setup(|app, api| {
            // Only built for Android (see the app's Cargo.toml).
            let handle =
                api.register_android_plugin("com.trackworth.googleauth", "GoogleAuthPlugin")?;
            app.manage(GoogleAuth(handle));
            Ok(())
        })
        .build()
}
