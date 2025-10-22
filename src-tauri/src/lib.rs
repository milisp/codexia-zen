use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::log;
use tokio::sync::Mutex;

mod codex;
mod codex_discovery;
mod config;
mod commands;
mod export_bindings;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            #[cfg(debug_assertions)]
            export_bindings::export_ts_types();

            app.manage(state::AppState {
                client: Arc::new(Mutex::new(None)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_chat_session,
            commands::send_message,
            commands::new_conversation,
            commands::exec_approval_request,
            commands::delete_file,
            config::read_codex_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
