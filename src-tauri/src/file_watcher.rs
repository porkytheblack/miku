use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::future::Future;
use std::sync::Mutex;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use tauri::{AppHandle, Emitter, Manager};
use crate::commands::MikuError;

// ============================================
// Types
// ============================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileManifestEntry {
    pub path: String,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileMetadata {
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChangedEvent {
    pub path: String,
    #[serde(rename = "eventType")]
    pub event_type: String, // "create" | "modify" | "delete" | "rename"
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

// ============================================
// File Watcher State
// ============================================

pub struct FileWatcherState {
    watcher: Option<notify::RecommendedWatcher>,
    watched_path: Option<String>,
}

impl FileWatcherState {
    pub fn new() -> Self {
        Self {
            watcher: None,
            watched_path: None,
        }
    }
}

// ============================================
// Commands
// ============================================

#[tauri::command]
pub async fn watch_workspace(
    path: String,
    app_handle: AppHandle,
    watcher_state: tauri::State<'_, Mutex<FileWatcherState>>,
) -> Result<(), MikuError> {
    let watch_path = path.clone();

    // Stop existing watcher
    {
        let mut state = watcher_state.lock().map_err(|e| MikuError::Path(e.to_string()))?;
        state.watcher = None;
        state.watched_path = None;
    }

    let app = app_handle.clone();
    let workspace_root = path.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                let event_type = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "delete",
                    _ => return,
                };

                for path in &event.paths {
                    // Skip hidden files and common non-content directories
                    let path_str = path.to_string_lossy();
                    if path_str.contains("/.")
                        || path_str.contains("node_modules")
                        || path_str.contains("/target/")
                    {
                        continue;
                    }

                    // Get relative path from workspace root
                    let relative = path
                        .strip_prefix(&workspace_root)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .to_string();

                    let modified_at = std::fs::metadata(path)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or_else(|| {
                            std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as u64
                        });

                    let changed_event = FileChangedEvent {
                        path: relative,
                        event_type: event_type.to_string(),
                        modified_at,
                    };

                    let _ = app.emit("workspace:file_changed", &changed_event);
                }
            }
            Err(e) => {
                log::error!("File watcher error: {:?}", e);
            }
        }
    })
    .map_err(|e| MikuError::Path(format!("Failed to create file watcher: {}", e)))?;

    watcher
        .watch(Path::new(&watch_path), RecursiveMode::Recursive)
        .map_err(|e| MikuError::Path(format!("Failed to watch path: {}", e)))?;

    {
        let mut state = watcher_state.lock().map_err(|e| MikuError::Path(e.to_string()))?;
        state.watcher = Some(watcher);
        state.watched_path = Some(watch_path);
    }

    Ok(())
}

#[tauri::command]
pub async fn unwatch_workspace(
    watcher_state: tauri::State<'_, Mutex<FileWatcherState>>,
) -> Result<(), MikuError> {
    let mut state = watcher_state.lock().map_err(|e| MikuError::Path(e.to_string()))?;
    state.watcher = None;
    state.watched_path = None;
    Ok(())
}

#[tauri::command]
pub async fn get_workspace_manifest(
    workspace_path: String,
) -> Result<Vec<FileManifestEntry>, MikuError> {
    let path = Path::new(&workspace_path);

    if !path.exists() {
        return Err(MikuError::Path(
            "Workspace path does not exist".to_string(),
        ));
    }

    let mut entries = Vec::new();
    collect_manifest(path, path, &mut entries).await?;
    Ok(entries)
}

/// Recursively collect file manifest entries
fn collect_manifest<'a>(
    root: &'a Path,
    dir: &'a Path,
    entries: &'a mut Vec<FileManifestEntry>,
) -> Pin<Box<dyn Future<Output = Result<(), MikuError>> + Send + 'a>> {
    Box::pin(async move {
        let mut dir_entries = tokio::fs::read_dir(dir).await?;

        while let Some(entry) = dir_entries.next_entry().await? {
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and common non-content directories
            if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                continue;
            }

            let metadata = entry.metadata().await?;

            if metadata.is_dir() {
                collect_manifest(root, &entry_path, entries).await?;
            } else {
                let relative = entry_path
                    .strip_prefix(root)
                    .unwrap_or(&entry_path)
                    .to_string_lossy()
                    .to_string();

                let modified_at = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                entries.push(FileManifestEntry {
                    path: relative,
                    size: metadata.len(),
                    modified_at,
                });
            }
        }

        Ok(())
    })
}

#[tauri::command]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, MikuError> {
    let metadata = tokio::fs::metadata(&path).await?;

    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(FileMetadata {
        size: metadata.len(),
        modified_at,
    })
}
