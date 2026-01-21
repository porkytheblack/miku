use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::future::Future;
use crate::commands::MikuError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceFile {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<WorkspaceFile>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WorkspaceConfig {
    pub current_workspace: Option<String>,
    pub recent_workspaces: Vec<Workspace>,
}

/// Get the workspace config file path
fn get_workspace_config_path() -> Result<PathBuf, MikuError> {
    dirs::data_dir()
        .map(|p| p.join("miku").join("workspace_config.json"))
        .ok_or_else(|| MikuError::Path("Could not determine app data directory".to_string()))
}

/// Load workspace configuration
async fn load_workspace_config() -> Result<WorkspaceConfig, MikuError> {
    let config_path = get_workspace_config_path()?;

    if config_path.exists() {
        let content = tokio::fs::read_to_string(&config_path).await?;
        let config: WorkspaceConfig = serde_json::from_str(&content)?;
        Ok(config)
    } else {
        Ok(WorkspaceConfig::default())
    }
}

/// Save workspace configuration
async fn save_workspace_config(config: &WorkspaceConfig) -> Result<(), MikuError> {
    let config_path = get_workspace_config_path()?;

    if let Some(parent) = config_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let content = serde_json::to_string_pretty(config)?;
    tokio::fs::write(&config_path, content).await?;

    Ok(())
}

/// Get workspace info from a path
#[tauri::command]
pub async fn get_workspace_info(path: String) -> Result<Workspace, MikuError> {
    let path_obj = Path::new(&path);
    let name = path_obj
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Workspace".to_string());

    Ok(Workspace { path, name })
}

/// Get current workspace
#[tauri::command]
pub async fn get_current_workspace() -> Result<Option<Workspace>, MikuError> {
    let config = load_workspace_config().await?;

    if let Some(path) = config.current_workspace {
        // Verify the path still exists
        if Path::new(&path).exists() {
            let workspace = get_workspace_info(path).await?;
            return Ok(Some(workspace));
        }
    }

    Ok(None)
}

/// Set current workspace
#[tauri::command]
pub async fn set_workspace(path: String) -> Result<(), MikuError> {
    let mut config = load_workspace_config().await?;

    // Update current workspace
    config.current_workspace = Some(path.clone());

    // Add to recent workspaces if not already there
    let workspace = get_workspace_info(path).await?;
    config.recent_workspaces.retain(|w| w.path != workspace.path);
    config.recent_workspaces.insert(0, workspace);
    config.recent_workspaces.truncate(10);

    save_workspace_config(&config).await?;

    Ok(())
}

/// Get recent workspaces
#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<Workspace>, MikuError> {
    let config = load_workspace_config().await?;

    // Filter to only existing workspaces
    let valid_workspaces: Vec<Workspace> = config
        .recent_workspaces
        .into_iter()
        .filter(|w| Path::new(&w.path).exists())
        .collect();

    Ok(valid_workspaces)
}

/// List files in a workspace
#[tauri::command]
pub async fn list_workspace_files(workspace_path: String) -> Result<Vec<WorkspaceFile>, MikuError> {
    let path = Path::new(&workspace_path);

    if !path.exists() {
        return Err(MikuError::Path("Workspace path does not exist".to_string()));
    }

    list_directory(path, true).await
}

/// Recursively list directory contents
/// Uses Box::pin to handle async recursion
fn list_directory(path: &Path, is_root: bool) -> Pin<Box<dyn Future<Output = Result<Vec<WorkspaceFile>, MikuError>> + Send + '_>> {
    Box::pin(async move {
        let mut files = Vec::new();
        let mut entries = tokio::fs::read_dir(path).await?;

        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and common non-content directories
            if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                continue;
            }

            let metadata = entry.metadata().await?;
            let is_directory = metadata.is_dir();

            if is_directory {
                // Recursively list subdirectories
                let children = list_directory(&entry_path, false).await.ok();

                // Only include directories that have markdown files or subdirectories
                let has_content = children.as_ref().map(|c| !c.is_empty()).unwrap_or(false);

                if has_content || is_root {
                    files.push(WorkspaceFile {
                        name: file_name,
                        path: entry_path.to_string_lossy().to_string(),
                        is_directory: true,
                        children,
                    });
                }
            } else {
                // Only include markdown files
                if let Some(ext) = entry_path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "md" || ext_str == "markdown" || ext_str == "mdown" {
                        files.push(WorkspaceFile {
                            name: file_name,
                            path: entry_path.to_string_lossy().to_string(),
                            is_directory: false,
                            children: None,
                        });
                    }
                }
            }
        }

        // Sort: directories first, then alphabetically
        files.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(files)
    })
}

/// Create a new file
#[tauri::command]
pub async fn create_file(base_path: String, name: String) -> Result<String, MikuError> {
    let file_path = Path::new(&base_path).join(&name);

    if file_path.exists() {
        return Err(MikuError::Path("File already exists".to_string()));
    }

    tokio::fs::write(&file_path, "").await?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(base_path: String, name: String) -> Result<String, MikuError> {
    let folder_path = Path::new(&base_path).join(&name);

    if folder_path.exists() {
        return Err(MikuError::Path("Folder already exists".to_string()));
    }

    tokio::fs::create_dir(&folder_path).await?;

    Ok(folder_path.to_string_lossy().to_string())
}

/// Delete a file or folder
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), MikuError> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err(MikuError::Path("Path does not exist".to_string()));
    }

    if path_obj.is_dir() {
        tokio::fs::remove_dir_all(&path).await?;
    } else {
        tokio::fs::remove_file(&path).await?;
    }

    Ok(())
}

/// Rename a file or folder
#[tauri::command]
pub async fn rename_file(old_path: String, new_name: String) -> Result<String, MikuError> {
    let old_path_obj = Path::new(&old_path);

    if !old_path_obj.exists() {
        return Err(MikuError::Path("Path does not exist".to_string()));
    }

    let parent = old_path_obj.parent()
        .ok_or_else(|| MikuError::Path("Cannot determine parent directory".to_string()))?;

    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err(MikuError::Path("A file with that name already exists".to_string()));
    }

    tokio::fs::rename(&old_path, &new_path).await?;

    Ok(new_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_serialization() {
        let workspace = Workspace {
            path: "/path/to/workspace".to_string(),
            name: "My Workspace".to_string(),
        };

        let json = serde_json::to_string(&workspace).unwrap();
        let deserialized: Workspace = serde_json::from_str(&json).unwrap();

        assert_eq!(workspace.path, deserialized.path);
        assert_eq!(workspace.name, deserialized.name);
    }

    #[test]
    fn test_workspace_file_serialization() {
        let file = WorkspaceFile {
            name: "test.md".to_string(),
            path: "/path/to/test.md".to_string(),
            is_directory: false,
            children: None,
        };

        let json = serde_json::to_string(&file).unwrap();
        assert!(json.contains("\"isDirectory\":false"));

        let deserialized: WorkspaceFile = serde_json::from_str(&json).unwrap();
        assert_eq!(file.name, deserialized.name);
        assert!(!deserialized.is_directory);
    }

    #[test]
    fn test_workspace_config_default() {
        let config = WorkspaceConfig::default();
        assert!(config.current_workspace.is_none());
        assert!(config.recent_workspaces.is_empty());
    }
}
