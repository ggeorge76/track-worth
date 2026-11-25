//! Google sign-in. The webview only ever receives short-lived access tokens.
//!
//! - Desktop (ADR-0004): PKCE + loopback redirect in the user's browser; the refresh token lives
//!   in the OS keychain.
//! - Android (ADR-0019): Google Play services' `AuthorizationClient` via our own plugin. Google
//!   keeps the grant, so a fresh token can be requested silently; the app stores only a
//!   "signed in" flag, no secret.

mod error;
mod google;
#[cfg(desktop)]
mod loopback;
#[cfg(desktop)]
mod pkce;
#[cfg(desktop)]
mod store;

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_http::reqwest;
use tokio::sync::Mutex;

pub use error::AuthError;

/// Refresh a little early so a token never expires mid-request.
const EXPIRY_MARGIN_MS: u64 = 60_000;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessToken {
    access_token: String,
    /// Epoch milliseconds.
    expires_at: u64,
}

pub struct AuthState {
    http: reqwest::Client,
    cached: Mutex<Option<AccessToken>>,
    /// Only one refresh at a time, so concurrent requests don't each refresh.
    refresh_lock: Mutex<()>,
    #[cfg(desktop)]
    secret: store::CachedSecret<store::KeychainStore>,
}

impl AuthState {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("HTTP client builds with static config");
        Self {
            http,
            cached: Mutex::new(None),
            refresh_lock: Mutex::new(()),
            #[cfg(desktop)]
            secret: store::CachedSecret::new(store::KeychainStore),
        }
    }

    async fn remember(&self, access_token: String, expires_in: u64) -> AccessToken {
        let token = AccessToken {
            access_token,
            expires_at: now_ms() + expires_in * 1000,
        };
        *self.cached.lock().await = Some(token.clone());
        token
    }

    async fn valid_cached(&self) -> Option<AccessToken> {
        self.cached
            .lock()
            .await
            .as_ref()
            .filter(|t| t.expires_at > now_ms() + EXPIRY_MARGIN_MS)
            .cloned()
    }

    /// A new access token without asking the user; `NotSignedIn` if that's not possible.
    async fn refresh(&self, app: &AppHandle) -> Result<AccessToken, AuthError> {
        let _one_at_a_time = self.refresh_lock.lock().await;
        // Another caller may have refreshed while we waited.
        if let Some(token) = self.valid_cached().await {
            return Ok(token);
        }
        platform::refresh(self, app).await
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

/// Interactive sign-in: the browser on desktop, Google's account picker on Android.
#[tauri::command]
pub async fn auth_sign_in(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<AccessToken, AuthError> {
    platform::sign_in(&state, &app).await
}

/// Silent sign-in at startup. `None` = show the sign-in screen.
#[tauri::command]
pub async fn auth_restore(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<Option<AccessToken>, AuthError> {
    match state.refresh(&app).await {
        Ok(token) => Ok(Some(token)),
        Err(AuthError::NotSignedIn | AuthError::SessionExpired | AuthError::NotConfigured) => {
            Ok(None)
        }
        Err(e) => Err(e),
    }
}

/// A valid access token, refreshed if it is about to expire.
#[tauri::command]
pub async fn auth_access_token(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<AccessToken, AuthError> {
    if let Some(token) = state.valid_cached().await {
        return Ok(token);
    }
    state.refresh(&app).await
}

/// Revoke Google access and forget all tokens.
#[tauri::command]
pub async fn auth_sign_out(app: AppHandle, state: State<'_, AuthState>) -> Result<(), AuthError> {
    platform::sign_out(&state, &app).await
}

#[cfg(desktop)]
mod platform {
    use std::time::Duration;

    use tauri::{AppHandle, Manager};

    use super::{AccessToken, AuthError, AuthState, google, loopback, pkce};
    use crate::config;

    const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);

    pub async fn sign_in(state: &AuthState, app: &AppHandle) -> Result<AccessToken, AuthError> {
        let client = config::oauth_client().ok_or(AuthError::NotConfigured)?;
        let pkce = pkce::Pkce::generate();
        let csrf_state = pkce::random_token();
        let (listener, port) = loopback::bind()
            .await
            .map_err(|e| AuthError::Failed(e.to_string()))?;
        let redirect_uri = format!("http://127.0.0.1:{port}");

        let url = google::authorization_url(client.id, &redirect_uri, &pkce.challenge, &csrf_state);
        tauri_plugin_opener::open_url(url, None::<&str>)
            .map_err(|e| AuthError::Failed(e.to_string()))?;

        let code = loopback::wait_for_code(listener, &csrf_state, SIGN_IN_TIMEOUT)
            .await
            .map_err(|e| match e {
                loopback::CallbackError::Denied(reason) => AuthError::Denied(reason),
                loopback::CallbackError::Timeout => AuthError::Cancelled,
                loopback::CallbackError::StateMismatch => {
                    AuthError::Failed("security check failed".into())
                }
                loopback::CallbackError::Malformed => {
                    AuthError::Failed("unexpected redirect".into())
                }
                loopback::CallbackError::Io(msg) => AuthError::Failed(msg),
            })?;

        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }

        let tokens =
            google::exchange_code(&state.http, &client, &code, &pkce.verifier, &redirect_uri)
                .await?;
        if !google::has_scope(tokens.scope.as_deref(), google::DRIVE_SCOPE) {
            google::revoke(&state.http, &tokens.access_token).await;
            return Err(AuthError::ScopeDenied);
        }
        if let Some(refresh_token) = &tokens.refresh_token {
            state.secret.save(refresh_token)?;
        }
        Ok(state.remember(tokens.access_token, tokens.expires_in).await)
    }

    pub async fn refresh(state: &AuthState, _app: &AppHandle) -> Result<AccessToken, AuthError> {
        let client = config::oauth_client().ok_or(AuthError::NotConfigured)?;
        let refresh_token = state.secret.load()?.ok_or(AuthError::NotSignedIn)?;
        match google::refresh(&state.http, &client, &refresh_token).await {
            Ok(tokens) => Ok(state.remember(tokens.access_token, tokens.expires_in).await),
            Err(AuthError::SessionExpired) => {
                state.secret.clear()?;
                Err(AuthError::SessionExpired)
            }
            Err(e) => Err(e),
        }
    }

    pub async fn sign_out(state: &AuthState, _app: &AppHandle) -> Result<(), AuthError> {
        state.cached.lock().await.take();
        // Usually already in memory, so signing out touches the keychain only to delete it.
        if let Some(refresh_token) = state.secret.load()? {
            google::revoke(&state.http, &refresh_token).await;
        }
        state.secret.clear()
    }
}

// iOS will get its own implementation (ADR-0019, "iOS later").
#[cfg(target_os = "android")]
mod platform {
    use std::path::PathBuf;

    use tauri::{AppHandle, Manager};
    use tauri_plugin_google_auth::{AuthorizeError, GoogleAuthExt};

    use super::{AccessToken, AuthError, AuthState, google};

    /// Play services doesn't say when a token expires; Google access tokens last an hour, so
    /// assume a bit less and ask again (silently) after that.
    const ASSUMED_LIFETIME_SECS: u64 = 50 * 60;
    /// Remembers that this device signed in, so startup asks silently instead of showing the
    /// sign-in page. Holds nothing secret (ADR-0019).
    const SIGNED_IN_FLAG: &str = "signed-in";

    fn flag(app: &AppHandle) -> Option<PathBuf> {
        app.path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join(SIGNED_IN_FLAG))
    }

    /// Runs the (blocking) plugin call off the async runtime.
    async fn authorize(app: &AppHandle, interactive: bool) -> Result<String, AuthorizeError> {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            app.google_auth().authorize(interactive, &google::SCOPES)
        })
        .await
        .unwrap_or_else(|e| Err(AuthorizeError::Failed(e.to_string())))
    }

    fn to_auth_error(e: AuthorizeError) -> AuthError {
        match e {
            AuthorizeError::NeedsConsent => AuthError::NotSignedIn,
            AuthorizeError::Cancelled => AuthError::Cancelled,
            AuthorizeError::Failed(message) => AuthError::Failed(message),
        }
    }

    pub async fn sign_in(state: &AuthState, app: &AppHandle) -> Result<AccessToken, AuthError> {
        let token = authorize(app, true).await.map_err(to_auth_error)?;
        if let Some(path) = flag(app) {
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(path, b"1");
        }
        Ok(state.remember(token, ASSUMED_LIFETIME_SECS).await)
    }

    pub async fn refresh(state: &AuthState, app: &AppHandle) -> Result<AccessToken, AuthError> {
        if !flag(app).is_some_and(|p| p.exists()) {
            return Err(AuthError::NotSignedIn);
        }
        // Drop the old token from Play services' cache so the new one is really fresh.
        if let Some(old) = state.cached.lock().await.take() {
            let app = app.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                app.google_auth().clear_token(&old.access_token);
            })
            .await;
        }
        match authorize(app, false).await {
            Ok(token) => Ok(state.remember(token, ASSUMED_LIFETIME_SECS).await),
            Err(AuthorizeError::NeedsConsent) => {
                // The grant was removed (e.g. at myaccount.google.com): sign in again.
                if let Some(path) = flag(app) {
                    let _ = std::fs::remove_file(path);
                }
                Err(AuthError::SessionExpired)
            }
            Err(e) => Err(to_auth_error(e)),
        }
    }

    pub async fn sign_out(state: &AuthState, app: &AppHandle) -> Result<(), AuthError> {
        if let Some(path) = flag(app) {
            let _ = std::fs::remove_file(path);
        }
        if let Some(token) = state.cached.lock().await.take() {
            // Revoking removes the whole grant, so the next sign-in asks again.
            google::revoke(&state.http, &token.access_token).await;
            let app = app.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                app.google_auth().clear_token(&token.access_token);
            })
            .await;
        }
        Ok(())
    }
}
