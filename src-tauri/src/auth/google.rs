//! Google OAuth endpoints for installed apps.
//! <https://developers.google.com/identity/protocols/oauth2/native-app>

use serde::Deserialize;
use tauri_plugin_http::reqwest;
use url::Url;

use super::error::AuthError;
use crate::config::OAuthClient;

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT: &str = "https://oauth2.googleapis.com/revoke";

pub const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
/// Least privilege (ADR-0004): profile for the user's name, drive.file for our one data file.
pub const SCOPES: [&str; 4] = ["openid", "email", "profile", DRIVE_SCOPE];

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: String,
    error_description: Option<String>,
}

pub fn authorization_url(
    client_id: &str,
    redirect_uri: &str,
    challenge: &str,
    state: &str,
) -> String {
    let mut url = Url::parse(AUTH_ENDPOINT).expect("static URL is valid");
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", &SCOPES.join(" "))
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        // Offline access + consent guarantees a refresh token, so users stay signed in.
        .append_pair("access_type", "offline")
        .append_pair("prompt", "select_account consent");
    url.into()
}

pub fn has_scope(granted: Option<&str>, scope: &str) -> bool {
    granted.is_some_and(|s| s.split_whitespace().any(|g| g == scope))
}

pub async fn exchange_code(
    http: &reqwest::Client,
    client: &OAuthClient,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<TokenResponse, AuthError> {
    post_token(
        http,
        &[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("code_verifier", verifier),
            ("redirect_uri", redirect_uri),
            ("client_id", client.id),
            ("client_secret", client.secret),
        ],
    )
    .await
}

pub async fn refresh(
    http: &reqwest::Client,
    client: &OAuthClient,
    refresh_token: &str,
) -> Result<TokenResponse, AuthError> {
    post_token(
        http,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client.id),
            ("client_secret", client.secret),
        ],
    )
    .await
}

/// Revoking the refresh token also invalidates its access tokens. Best effort.
pub async fn revoke(http: &reqwest::Client, token: &str) {
    let _ = http
        .post(REVOKE_ENDPOINT)
        .form(&[("token", token)])
        .send()
        .await;
}

async fn post_token(
    http: &reqwest::Client,
    params: &[(&str, &str)],
) -> Result<TokenResponse, AuthError> {
    let response = http
        .post(TOKEN_ENDPOINT)
        .form(params)
        .send()
        .await
        .map_err(|e| AuthError::Network(e.without_url().to_string()))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AuthError::Network(e.without_url().to_string()))?;
    parse_token_response(status.is_success(), &body)
}

pub fn parse_token_response(success: bool, body: &str) -> Result<TokenResponse, AuthError> {
    if success {
        return serde_json::from_str(body)
            .map_err(|_| AuthError::Failed("unexpected token response".into()));
    }
    match serde_json::from_str::<ErrorResponse>(body) {
        // Refresh token revoked, expired, or the user removed access in their Google account.
        Ok(e) if e.error == "invalid_grant" => Err(AuthError::SessionExpired),
        Ok(e) => Err(AuthError::Failed(e.error_description.unwrap_or(e.error))),
        Err(_) => Err(AuthError::Failed("unexpected error response".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorization_url_has_pkce_and_scopes() {
        let url = Url::parse(&authorization_url(
            "cid",
            "http://127.0.0.1:5000",
            "chal",
            "st",
        ))
        .unwrap();
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(q["client_id"], "cid");
        assert_eq!(q["redirect_uri"], "http://127.0.0.1:5000");
        assert_eq!(q["code_challenge"], "chal");
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["state"], "st");
        assert!(q["scope"].contains(DRIVE_SCOPE));
        assert!(
            !q["scope"]
                .split(' ')
                .any(|s| s == "https://www.googleapis.com/auth/drive")
        );
    }

    #[test]
    fn detects_granted_scopes() {
        assert!(has_scope(
            Some("openid https://www.googleapis.com/auth/drive.file"),
            DRIVE_SCOPE
        ));
        assert!(!has_scope(Some("openid email"), DRIVE_SCOPE));
        assert!(!has_scope(None, DRIVE_SCOPE));
    }

    #[test]
    fn parses_success() {
        let t = parse_token_response(
            true,
            r#"{"access_token":"a","expires_in":3599,"refresh_token":"r","scope":"openid","token_type":"Bearer"}"#,
        )
        .unwrap();
        assert_eq!(t.access_token, "a");
        assert_eq!(t.refresh_token.as_deref(), Some("r"));
    }

    #[test]
    fn maps_invalid_grant_to_session_expired() {
        let err = parse_token_response(false, r#"{"error":"invalid_grant"}"#).unwrap_err();
        assert!(matches!(err, AuthError::SessionExpired));
    }

    #[test]
    fn maps_other_errors_to_failed() {
        let err = parse_token_response(
            false,
            r#"{"error":"invalid_client","error_description":"bad"}"#,
        )
        .unwrap_err();
        assert!(matches!(err, AuthError::Failed(m) if m == "bad"));
    }
}
