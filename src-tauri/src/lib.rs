use tauri_plugin_log::log;

mod config;

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
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            config::read_codex_config,
            config::read_providers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
