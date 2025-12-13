use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub request_id: String,
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub reason: Option<String>,
    #[serde(flatten)]
    pub kind: ApprovalRequestKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ApprovalRequestKind {
    CommandExecution {
        proposed_execpolicy_amendment: Option<Vec<String>>,
    },
    FileChange {
        grant_root: Option<String>,
    },
}
