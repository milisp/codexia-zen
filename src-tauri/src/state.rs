use std::future::Future;
use std::pin::Pin;

use anyhow::{Context, Result};
use tokio::sync::Mutex;

use crate::codex_client::CodexClient;
use codex_bindings::codex_discovery::discover_codex_command;

/// Shared Codex client state to keep spawn/initialize logic in one place.
pub struct ClientState {
    inner: Mutex<Option<CodexClient>>,
}

impl Default for ClientState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl ClientState {
    pub async fn with_ready_client<F, T>(&self, operation: F) -> Result<T>
    where
        F: for<'a> FnOnce(
            &'a mut CodexClient,
        ) -> Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>,
    {
        let mut guard = self.inner.lock().await;

        if guard.is_none() {
            let codex_bin_path = discover_codex_command()
                .context("failed to discover codex binary")?
                .to_string_lossy()
                .to_string();
            let client = CodexClient::spawn(codex_bin_path).await?;
            *guard = Some(client);
        }

        let client = guard
            .as_mut()
            .context("codex client not started; initialize first")?;

        client.ensure_initialized().await?;
        operation(client).await
    }
}
