mod chat;

use chat::{ChatState, InitRequest, SendRequest, SendResponse, StartRequest};

#[tauri::command]
async fn chatbox_init(
    app: tauri::AppHandle,
    state: tauri::State<'_, ChatState>,
    payload: Option<InitRequest>,
) -> Result<(), String> {
    let request = payload.unwrap_or(InitRequest {
        config_overrides: None,
    });
    state.init(&app, request).await
}

#[tauri::command]
async fn chatbox_start_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, ChatState>,
    payload: Option<StartRequest>,
) -> Result<(), String> {
    let request = payload.unwrap_or(StartRequest {
        config_overrides: None,
    });
    state.start(&app, request).await
}

#[tauri::command]
async fn chatbox_send(
    app: tauri::AppHandle,
    state: tauri::State<'_, ChatState>,
    payload: SendRequest,
) -> Result<SendResponse, String> {
    let SendRequest {
        prompt,
        config_overrides,
    } = payload;
    state.send(&app, prompt, config_overrides).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ChatState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            chatbox_init,
            chatbox_start_session,
            chatbox_send
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
