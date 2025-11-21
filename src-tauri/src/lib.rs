use tauri_plugin_log::log;

mod commands;
mod config;

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
        .invoke_handler(tauri::generate_handler![
            config::read_codex_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
