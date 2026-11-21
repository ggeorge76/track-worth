//! Google sign-in for the desktop app (ADR-0004).
//!
//! Flow: PKCE + loopback redirect in the user's default browser. The refresh token lives in
//! the OS keychain; the webview only ever receives short-lived access tokens.

mod error;
mod google;
mod loopback;
mod pkce;
mod store;

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use tokio::sync::Mutex;

pub use error::AuthError;

use crate::config;

const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
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

    async fn refresh_from_store(&self) -> Result<AccessToken, AuthError> {
        let client = config::oauth_client().ok_or(AuthError::NotConfigured)?;
        let refresh_token = store::load()?.ok_or(AuthError::NotSignedIn)?;
        match google::refresh(&self.http, &client, &refresh_token).await {
            Ok(tokens) => Ok(self.remember(tokens.access_token, tokens.expires_in).await),
            Err(AuthError::SessionExpired) => {
                store::clear()?;
                Err(AuthError::SessionExpired)
            }
            Err(e) => Err(e),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

/// Interactive sign-in in the system browser.
#[tauri::command]
pub async fn auth_sign_in(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<AccessToken, AuthError> {
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
            loopback::CallbackError::Malformed => AuthError::Failed("unexpected redirect".into()),
            loopback::CallbackError::Io(msg) => AuthError::Failed(msg),
        })?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    let tokens =
        google::exchange_code(&state.http, &client, &code, &pkce.verifier, &redirect_uri).await?;
    if !google::has_scope(tokens.scope.as_deref(), google::DRIVE_SCOPE) {
        google::revoke(&state.http, &tokens.access_token).await;
        return Err(AuthError::ScopeDenied);
    }
    if let Some(refresh_token) = &tokens.refresh_token {
        store::save(refresh_token)?;
    }
    Ok(state.remember(tokens.access_token, tokens.expires_in).await)
}

/// Silent sign-in at startup using the stored refresh token. `None` = show the sign-in screen.
#[tauri::command]
pub async fn auth_restore(state: State<'_, AuthState>) -> Result<Option<AccessToken>, AuthError> {
    match state.refresh_from_store().await {
        Ok(token) => Ok(Some(token)),
        Err(AuthError::NotSignedIn | AuthError::SessionExpired | AuthError::NotConfigured) => {
            Ok(None)
        }
        Err(e) => Err(e),
    }
}

/// A valid access token, refreshed if it is about to expire.
#[tauri::command]
pub async fn auth_access_token(state: State<'_, AuthState>) -> Result<AccessToken, AuthError> {
    if let Some(token) = state.cached.lock().await.as_ref()
        && token.expires_at > now_ms() + EXPIRY_MARGIN_MS
    {
        return Ok(token.clone());
    }
    state.refresh_from_store().await
}

/// Revoke Google access and forget all tokens.
#[tauri::command]
pub async fn auth_sign_out(state: State<'_, AuthState>) -> Result<(), AuthError> {
    state.cached.lock().await.take();
    if let Some(refresh_token) = store::load()? {
        google::revoke(&state.http, &refresh_token).await;
    }
    store::clear()
}
