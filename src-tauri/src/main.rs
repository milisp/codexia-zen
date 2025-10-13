// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::log;
use tokio::sync::Mutex;

mod codex;
mod commands;
mod state;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            #[cfg(debug_assertions)]
            commands::export_ts_types();

            app.manage(state::AppState {
                clients: Arc::new(Mutex::new(HashMap::new())),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_chat_session,
            commands::send_message,
            commands::new_conversation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}