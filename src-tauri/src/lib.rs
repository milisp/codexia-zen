use tauri_plugin_log::log;

mod codex;
mod codex_discovery;
mod commands;
mod config;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(AppState::new())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            config::read_codex_config,
            config::read_providers,
            commands::codex_initialize,
            commands::thread_start,
            commands::thread_resume,
            commands::turn_start,
            commands::turn_interrupt,
            commands::respond_to_approval,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
