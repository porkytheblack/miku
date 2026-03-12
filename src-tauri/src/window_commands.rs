use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::commands::MikuError;

static WINDOW_COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

/// Toggle always-on-top for the calling window
#[tauri::command]
pub async fn set_always_on_top(window: tauri::WebviewWindow, on_top: bool) -> Result<(), MikuError> {
    window
        .set_always_on_top(on_top)
        .map_err(|e| MikuError::Path(e.to_string()))?;
    Ok(())
}

/// Get current always-on-top state
#[tauri::command]
pub async fn get_always_on_top(window: tauri::WebviewWindow) -> Result<bool, MikuError> {
    window
        .is_always_on_top()
        .map_err(|e| MikuError::Path(e.to_string()))
}

/// Minimize the window to system tray (hide it)
#[tauri::command]
pub async fn minimize_to_tray(window: tauri::WebviewWindow) -> Result<(), MikuError> {
    window
        .hide()
        .map_err(|e| MikuError::Path(e.to_string()))?;
    Ok(())
}

/// Create a new window
#[tauri::command]
pub async fn create_new_window(app: AppHandle) -> Result<(), MikuError> {
    create_new_window_inner(&app);
    Ok(())
}

pub fn create_new_window_inner(app: &AppHandle) {
    let count = WINDOW_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let label = format!("miku-{}", count);

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:3000".parse().unwrap())
    } else {
        WebviewUrl::App("index.html".into())
    };

    let _ = WebviewWindowBuilder::new(app, &label, url)
        .title("Miku")
        .inner_size(1200.0, 800.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .center()
        .build();
}
