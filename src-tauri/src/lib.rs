mod commands;
mod file_ops;
mod workspace;

pub use commands::*;
pub use workspace::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                use tauri::Manager;
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Document commands
            commands::load_settings,
            commands::save_settings,
            commands::open_file,
            commands::save_file,
            commands::new_document,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::get_app_version,
            // Workspace commands
            workspace::get_workspace_info,
            workspace::get_current_workspace,
            workspace::set_workspace,
            workspace::get_recent_workspaces,
            workspace::list_workspace_files,
            workspace::create_file,
            workspace::create_folder,
            workspace::delete_file,
            workspace::rename_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
