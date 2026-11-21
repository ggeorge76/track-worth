//! Build-time configuration. Values are compiled in by `build.rs` from the environment
//! (CI secrets) or from `../.env.local` (local development).

/// Google OAuth "Desktop app" client (ADR-0004).
///
/// For installed apps Google does not treat the client secret as confidential: it ships inside
/// every copy of the app. Security comes from PKCE + the loopback redirect, not from the secret.
pub struct OAuthClient {
    pub id: &'static str,
    pub secret: &'static str,
}

pub fn oauth_client() -> Option<OAuthClient> {
    let id = option_env!("TRACKWORTH_GOOGLE_CLIENT_ID").filter(|s| !s.is_empty())?;
    let secret = option_env!("TRACKWORTH_GOOGLE_CLIENT_SECRET").unwrap_or("");
    Some(OAuthClient { id, secret })
}
