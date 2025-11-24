use tauri_plugin_log::log;

mod agent;
mod commands;
mod config;
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
        .setup(|_app| {
            #[cfg(debug_assertions)]
            codex_bindings::export_bindings::export_ts_types();

            Ok(())
        })
        .manage(agent::codex::CodexClientManager::default())
        .invoke_handler(tauri::generate_handler![
            config::read_codex_config,
            config::read_providers,
            commands::run_turn,
            commands::initialize_client,
            commands::new_conversation,
            commands::add_conversation_listener,
            commands::send_user_message,
            commands::turn_interrupt,

            commands::resume_thread,
            commands::respond_exec_command_approval,
            commands::respond_apply_patch_approval,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
