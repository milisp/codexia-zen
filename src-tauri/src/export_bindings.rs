use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, AuthMode, ClientInfo,
    ConversationSummary, InitializeParams, InitializeResponse, InputItem,
    ListConversationsResponse, NewConversationParams, NewConversationResponse,
    SendUserMessageParams,
};
use codex_protocol::protocol::EventMsg;
use std::path::Path;
use ts_rs::TS;

#[cfg(debug_assertions)]
pub fn export_ts_types() {
    let out_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("bindings");
    std::fs::create_dir_all(&out_dir).unwrap();

    AuthMode::export_all_to(&out_dir).unwrap();
    NewConversationParams::export_all_to(&out_dir).unwrap();
    NewConversationResponse::export_all_to(&out_dir).unwrap();
    ConversationSummary::export_all_to(&out_dir).unwrap();
    EventMsg::export_all_to(&out_dir).unwrap();
    InitializeParams::export_all_to(&out_dir).unwrap();
    ClientInfo::export_all_to(&out_dir).unwrap();
    InitializeResponse::export_all_to(&out_dir).unwrap();
    SendUserMessageParams::export_all_to(&out_dir).unwrap();
    ListConversationsResponse::export_all_to(&out_dir).unwrap();
    AddConversationListenerParams::export_all_to(&out_dir).unwrap();
    AddConversationSubscriptionResponse::export_all_to(&out_dir).unwrap();
    InputItem::export_all_to(&out_dir).unwrap();
}
