mod claude;
mod commands;
mod file_ops;
mod workspace;
mod window_commands;

pub use commands::*;
pub use workspace::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System tray setup (only on desktop with tray-icon feature)
            #[cfg(all(desktop, feature = "tray-icon"))]
            {
                use tauri::Manager;
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                use tauri::menu::{MenuBuilder, MenuItemBuilder};

                let show = MenuItemBuilder::with_id("show", "Show Miku").build(app)?;
                let new_window = MenuItemBuilder::with_id("new_window", "New Window").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

                let menu = MenuBuilder::new(app)
                    .item(&show)
                    .item(&new_window)
                    .separator()
                    .item(&quit)
                    .build()?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().cloned().expect("default window icon must be set in tauri.conf.json"))
                    .tooltip("Miku")
                    .menu(&menu)
                    .on_menu_event(move |app_handle: &tauri::AppHandle, event| {
                        match event.id().as_ref() {
                            "show" => {
                                if let Some(w) = app_handle.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.unminimize();
                                    let _ = w.set_focus();
                                }
                            }
                            "new_window" => {
                                window_commands::create_new_window_inner(app_handle);
                            }
                            "quit" => {
                                app_handle.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app_handle = tray.app_handle();
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .manage(std::sync::Arc::new(claude::ClaudeProcesses::new()))
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
            commands::save_session,
            commands::load_session,
            // Workspace commands
            workspace::get_workspace_info,
            workspace::get_current_workspace,
            workspace::set_workspace,
            workspace::get_recent_workspaces,
            workspace::list_workspace_files,
            workspace::list_env_files,
            workspace::create_file,
            workspace::create_folder,
            workspace::delete_file,
            workspace::rename_file,
            // Claude commands
            claude::claude_prompt,
            claude::claude_cancel,
            claude::claude_version,
            // Window commands
            window_commands::set_always_on_top,
            window_commands::get_always_on_top,
            window_commands::minimize_to_tray,
            window_commands::create_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
