//! One-shot HTTP listener on 127.0.0.1 that receives Google's OAuth redirect
//! (the "loopback IP address" flow for installed apps).

use std::collections::HashMap;
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

#[derive(Debug, PartialEq, Eq)]
pub enum CallbackError {
    Denied(String),
    StateMismatch,
    Malformed,
    Timeout,
    Io(String),
}

const SUCCESS_PAGE: &str = "<!doctype html><meta charset=utf-8><title>TrackWorth</title>\
<body style=\"font-family:system-ui;text-align:center;margin-top:20vh\">\
<h1>You're signed in</h1><p>You can close this tab and return to TrackWorth.</p>";

const FAILURE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>TrackWorth</title>\
<body style=\"font-family:system-ui;text-align:center;margin-top:20vh\">\
<h1>Sign-in didn't complete</h1><p>Return to TrackWorth and try again.</p>";

/// Bind an ephemeral port on the loopback interface only.
pub async fn bind() -> std::io::Result<(TcpListener, u16)> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let port = listener.local_addr()?.port();
    Ok((listener, port))
}

/// Interpret the HTTP request line of a redirect.
/// `Ok(None)` means "not the OAuth callback" (e.g. /favicon.ico) and should be ignored.
pub fn parse_callback(
    request_line: &str,
    expected_state: &str,
) -> Result<Option<String>, CallbackError> {
    let mut parts = request_line.split_whitespace();
    let (Some("GET"), Some(target)) = (parts.next(), parts.next()) else {
        return Err(CallbackError::Malformed);
    };
    let url =
        Url::parse(&format!("http://127.0.0.1{target}")).map_err(|_| CallbackError::Malformed)?;
    if url.path() != "/" {
        return Ok(None);
    }
    let params: HashMap<String, String> = url.query_pairs().into_owned().collect();
    if let Some(error) = params.get("error") {
        return Err(CallbackError::Denied(error.clone()));
    }
    let Some(code) = params.get("code") else {
        return Ok(None);
    };
    if params.get("state").map(String::as_str) != Some(expected_state) {
        return Err(CallbackError::StateMismatch);
    }
    Ok(Some(code.clone()))
}

/// Wait for the browser to hit the redirect URI and return the authorization code.
pub async fn wait_for_code(
    listener: TcpListener,
    expected_state: &str,
    timeout: Duration,
) -> Result<String, CallbackError> {
    let io = |e: std::io::Error| CallbackError::Io(e.to_string());
    tokio::time::timeout(timeout, async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(io)?;
            let mut buf = vec![0u8; 8192];
            let n = stream.read(&mut buf).await.map_err(io)?;
            let request = String::from_utf8_lossy(&buf[..n]);
            let line = request.lines().next().unwrap_or_default();
            let result = parse_callback(line, expected_state);
            let (status, body) = match &result {
                Ok(Some(_)) => ("200 OK", SUCCESS_PAGE),
                Ok(None) => ("404 Not Found", ""),
                Err(_) => ("400 Bad Request", FAILURE_PAGE),
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            // Best effort: the code is what matters, not whether the browser got the page.
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.shutdown().await;
            match result {
                Ok(Some(code)) => return Ok(code),
                Ok(None) => {}
                Err(e) => return Err(e),
            }
        }
    })
    .await
    .map_err(|_| CallbackError::Timeout)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_code_when_state_matches() {
        let line = "GET /?state=abc&code=4%2F0Axyz&scope=openid HTTP/1.1";
        assert_eq!(parse_callback(line, "abc"), Ok(Some("4/0Axyz".to_string())));
    }

    #[test]
    fn rejects_state_mismatch() {
        let line = "GET /?state=evil&code=x HTTP/1.1";
        assert_eq!(
            parse_callback(line, "abc"),
            Err(CallbackError::StateMismatch)
        );
    }

    #[test]
    fn reports_user_denial() {
        let line = "GET /?error=access_denied&state=abc HTTP/1.1";
        assert_eq!(
            parse_callback(line, "abc"),
            Err(CallbackError::Denied("access_denied".into()))
        );
    }

    #[test]
    fn ignores_unrelated_requests() {
        assert_eq!(parse_callback("GET /favicon.ico HTTP/1.1", "abc"), Ok(None));
        assert_eq!(parse_callback("GET / HTTP/1.1", "abc"), Ok(None));
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(parse_callback("", "abc"), Err(CallbackError::Malformed));
        assert_eq!(
            parse_callback("POST / HTTP/1.1", "abc"),
            Err(CallbackError::Malformed)
        );
    }

    #[tokio::test]
    async fn receives_code_over_tcp_and_skips_favicon() {
        let (listener, port) = bind().await.unwrap();
        let server =
            tokio::spawn(
                async move { wait_for_code(listener, "s1", Duration::from_secs(5)).await },
            );
        for path in ["/favicon.ico", "/?code=the-code&state=s1"] {
            let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
                .await
                .unwrap();
            stream
                .write_all(format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").as_bytes())
                .await
                .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).await.unwrap();
        }
        assert_eq!(server.await.unwrap(), Ok("the-code".to_string()));
    }

    #[tokio::test]
    async fn times_out() {
        let (listener, _) = bind().await.unwrap();
        let result = wait_for_code(listener, "s", Duration::from_millis(50)).await;
        assert_eq!(result, Err(CallbackError::Timeout));
    }
}
