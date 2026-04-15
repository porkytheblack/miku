mod claude;
mod commands;
mod file_ops;
mod workspace;
mod window_commands;

pub use commands::*;
pub use workspace::*;

use tauri::{Emitter, Manager};

/// Event name fired on the main window whenever the OS asks Miku to open a
/// file (via file association double-click, single-instance forwarding, or
/// macOS `RunEvent::Opened`). Payload is the absolute file path.
const OPEN_FILE_EVENT: &str = "miku://open-file";

/// Heuristic check that an OS-supplied argument is a file path we should
/// open. Skips Tauri/webview flags (which start with `--`) and the
/// executable name itself.
fn looks_like_openable_path(arg: &str) -> bool {
    if arg.is_empty() || arg.starts_with("--") || arg.starts_with('-') {
        return false;
    }
    std::path::Path::new(arg).is_file()
}

/// Pull file paths out of an argv-style list, skipping the program name.
fn collect_paths_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .skip(1) // program name
        .map(|s| s.as_ref().to_string())
        .filter(|s| looks_like_openable_path(s))
        .collect()
}

/// Send the file-open event to the main window, focusing it first.
fn emit_open_file(app: &tauri::AppHandle, path: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    if let Err(err) = app.emit(OPEN_FILE_EVENT, path) {
        log::warn!("failed to emit {OPEN_FILE_EVENT}: {err}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // On Windows/Linux, the OS opens a "new" Miku process per file. Forward
    // those requests into the original instance instead of spawning a
    // duplicate. macOS handles this natively via `RunEvent::Opened`.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, argv, _cwd| {
                for path in collect_paths_from_args(argv.iter().map(|s| s.as_str())) {
                    emit_open_file(app, &path);
                }
            },
        ));
    }

    builder = builder
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

            // Cold-start: if Miku was launched with a file path argument
            // (e.g. via the OS file association on Windows/Linux), forward
            // it to the frontend once the window is mounted.
            let initial_paths = collect_paths_from_args(std::env::args());
            if !initial_paths.is_empty() {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Give the webview a moment to mount its event listeners.
                    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
                    for path in initial_paths {
                        emit_open_file(&app_handle, &path);
                    }
                });
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
        ]);

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // macOS / iOS deliver file-open requests (Finder double-click,
            // Dock drag, `open foo.md`) through `RunEvent::Opened` instead
            // of argv. The variant is cfg-gated by Tauri itself, so the
            // handler only exists on those targets.
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            {
                if let tauri::RunEvent::Opened { urls } = &_event {
                    for url in urls {
                        let path = if url.scheme() == "file" {
                            url.to_file_path()
                                .ok()
                                .and_then(|p| p.to_str().map(|s| s.to_string()))
                        } else {
                            Some(url.as_str().to_string())
                        };
                        if let Some(p) = path {
                            emit_open_file(_app_handle, &p);
                        }
                    }
                }
            }
        });
}
