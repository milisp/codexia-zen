use std::sync::Mutex;
use crate::codex::client::CodexClientHandle;

pub struct AppState {
    pub codex_client: Mutex<Option<CodexClientHandle>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            codex_client: Mutex::new(None),
        }
    }
}
