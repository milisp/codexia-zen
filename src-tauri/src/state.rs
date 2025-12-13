use std::sync::{Mutex, MutexGuard};
use crate::codex::handles::CodexClientHandle;
use anyhow::{Context, Result};

pub struct AppState {
    pub codex_client: Mutex<Option<CodexClientHandle>>,
}

pub struct ClientGuard<'a> {
    _guard: MutexGuard<'a, Option<CodexClientHandle>>,
    handle: &'a CodexClientHandle,
}

impl<'a> std::ops::Deref for ClientGuard<'a> {
    type Target = CodexClientHandle;

    fn deref(&self) -> &Self::Target {
        self.handle
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            codex_client: Mutex::new(None),
        }
    }

    pub fn get_client(&self) -> Result<ClientGuard<'_>> {
        let guard = self.codex_client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;

        let handle = guard.as_ref()
            .context("Codex client not initialized")?;

        // SAFETY: We're extending the lifetime of the handle reference to match the guard.
        // This is safe because ClientGuard holds the guard, ensuring the handle stays valid.
        let handle_ref = unsafe {
            &*(handle as *const CodexClientHandle)
        };

        Ok(ClientGuard {
            _guard: guard,
            handle: handle_ref,
        })
    }

    pub fn get_or_init_client(&self, app: &tauri::AppHandle) -> Result<ClientGuard<'_>> {
        let mut guard = self.codex_client.lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire lock: {}", e))?;

        // Initialize if not already initialized
        if guard.is_none() {
            log::info!("Codex client not initialized, initializing now");
            let handle = CodexClientHandle::spawn_and_initialize(app.clone())
                .context("Failed to spawn and initialize Codex client")?;
            *guard = Some(handle);
            log::info!("Codex client initialization complete");
        }

        let handle = guard.as_ref().unwrap();

        // SAFETY: We're extending the lifetime of the handle reference to match the guard.
        // This is safe because ClientGuard holds the guard, ensuring the handle stays valid.
        let handle_ref = unsafe {
            &*(handle as *const CodexClientHandle)
        };

        Ok(ClientGuard {
            _guard: guard,
            handle: handle_ref,
        })
    }
}
