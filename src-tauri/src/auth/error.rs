use serde::ser::{Serialize, SerializeStruct, Serializer};

/// Errors returned to the frontend as `{ code, message }`.
/// Messages are shown to users: keep them plain, and never include tokens.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Google sign-in isn't set up in this build.")]
    NotConfigured,
    #[error("Sign-in was cancelled or took too long. Please try again.")]
    Cancelled,
    #[error("Google sign-in was declined ({0}).")]
    Denied(String),
    #[error(
        "TrackWorth needs access to Google Drive to store your data. Please allow it and try again."
    )]
    ScopeDenied,
    #[error("Your Google session has expired. Please sign in again.")]
    SessionExpired,
    #[error("You're not signed in.")]
    NotSignedIn,
    #[error("Couldn't access the system keychain: {0}")]
    Keychain(String),
    #[error("Couldn't reach Google. Check your internet connection. ({0})")]
    Network(String),
    #[error("Sign-in failed: {0}")]
    Failed(String),
}

impl AuthError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotConfigured => "not-configured",
            Self::Cancelled => "cancelled",
            Self::Denied(_) => "denied",
            Self::ScopeDenied => "scope-denied",
            Self::SessionExpired => "session-expired",
            Self::NotSignedIn => "not-signed-in",
            Self::Keychain(_) => "keychain",
            Self::Network(_) => "network",
            Self::Failed(_) => "failed",
        }
    }
}

impl Serialize for AuthError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AuthError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_code_and_message() {
        let json = serde_json::to_value(AuthError::ScopeDenied).unwrap();
        assert_eq!(json["code"], "scope-denied");
        assert!(json["message"].as_str().unwrap().contains("Google Drive"));
    }
}
