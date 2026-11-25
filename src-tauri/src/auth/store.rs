//! Refresh token storage in the OS secure store (macOS Keychain, Windows Credential Manager,
//! Linux Secret Service). Never written to disk by us, never sent to the webview.
//!
//! Every Keychain read can show a macOS permission prompt (always for unsigned dev builds, until
//! "Always Allow" for signed ones), so the token is read from the OS store at most once per run
//! and then kept in memory (`CachedSecret`).

use std::sync::Mutex;

use super::error::AuthError;

const SERVICE: &str = "com.trackworth.desktop";
const ACCOUNT: &str = "google-refresh-token";

/// Where the refresh token is kept. A trait so the caching can be tested without a real keychain.
pub trait SecretStore: Send + Sync {
    fn load(&self) -> Result<Option<String>, AuthError>;
    fn save(&self, token: &str) -> Result<(), AuthError>;
    fn clear(&self) -> Result<(), AuthError>;
}

/// The OS keychain.
pub struct KeychainStore;

fn entry() -> Result<keyring::Entry, AuthError> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| AuthError::Keychain(e.to_string()))
}

impl SecretStore for KeychainStore {
    fn load(&self) -> Result<Option<String>, AuthError> {
        match entry()?.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AuthError::Keychain(e.to_string())),
        }
    }

    fn save(&self, token: &str) -> Result<(), AuthError> {
        entry()?
            .set_password(token)
            .map_err(|e| AuthError::Keychain(e.to_string()))
    }

    fn clear(&self) -> Result<(), AuthError> {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AuthError::Keychain(e.to_string())),
        }
    }
}

/// What this run knows about the stored token.
enum Memory {
    /// Not read from the OS store yet.
    Unread,
    /// Read (or written) this run; `None` means nothing is stored.
    Known(Option<String>),
}

/// A `SecretStore` read at most once per run; later reads come from memory.
pub struct CachedSecret<S: SecretStore> {
    inner: S,
    memory: Mutex<Memory>,
}

impl<S: SecretStore> CachedSecret<S> {
    pub fn new(inner: S) -> Self {
        Self {
            inner,
            memory: Mutex::new(Memory::Unread),
        }
    }

    fn memory(&self) -> std::sync::MutexGuard<'_, Memory> {
        // A poisoned lock only means another thread panicked mid-update; the value is still usable.
        self.memory
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    pub fn load(&self) -> Result<Option<String>, AuthError> {
        let mut memory = self.memory();
        if let Memory::Known(value) = &*memory {
            return Ok(value.clone());
        }
        let value = self.inner.load()?;
        *memory = Memory::Known(value.clone());
        Ok(value)
    }

    pub fn save(&self, token: &str) -> Result<(), AuthError> {
        self.inner.save(token)?;
        *self.memory() = Memory::Known(Some(token.to_string()));
        Ok(())
    }

    pub fn clear(&self) -> Result<(), AuthError> {
        self.inner.clear()?;
        *self.memory() = Memory::Known(None);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Counts how often the "keychain" is actually touched.
    #[derive(Default)]
    struct CountingStore {
        value: Mutex<Option<String>>,
        loads: AtomicUsize,
    }

    impl SecretStore for &CountingStore {
        fn load(&self) -> Result<Option<String>, AuthError> {
            self.loads.fetch_add(1, Ordering::SeqCst);
            Ok(self.value.lock().unwrap().clone())
        }
        fn save(&self, token: &str) -> Result<(), AuthError> {
            *self.value.lock().unwrap() = Some(token.to_string());
            Ok(())
        }
        fn clear(&self) -> Result<(), AuthError> {
            *self.value.lock().unwrap() = None;
            Ok(())
        }
    }

    #[test]
    fn reads_the_keychain_once_per_run() {
        let store = CountingStore::default();
        store.value.lock().unwrap().replace("rt".into());
        let cached = CachedSecret::new(&store);
        for _ in 0..4 {
            assert_eq!(cached.load().unwrap().as_deref(), Some("rt"));
        }
        assert_eq!(store.loads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn remembers_saves_and_clears_without_reading_again() {
        let store = CountingStore::default();
        let cached = CachedSecret::new(&store);
        cached.save("new").unwrap();
        assert_eq!(cached.load().unwrap().as_deref(), Some("new"));
        cached.clear().unwrap();
        assert_eq!(cached.load().unwrap(), None);
        assert_eq!(store.loads.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn remembers_that_nothing_is_stored() {
        let store = CountingStore::default();
        let cached = CachedSecret::new(&store);
        assert_eq!(cached.load().unwrap(), None);
        assert_eq!(cached.load().unwrap(), None);
        assert_eq!(store.loads.load(Ordering::SeqCst), 1);
    }
}
