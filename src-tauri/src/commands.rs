use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MikuError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Path error: {0}")]
    Path(String),
}

impl Serialize for MikuError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditorSettings {
    pub theme: String,
    pub font_size: u32,
    pub line_height: f32,
    pub editor_width: u32,
    pub font_family: String,
    pub review_mode: String,
    pub aggressiveness: String,
    pub writing_context: String,
    #[serde(default = "default_sound_enabled")]
    pub sound_enabled: bool,
}

fn default_sound_enabled() -> bool {
    true
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            font_size: 16,
            line_height: 1.6,
            editor_width: 720,
            font_family: "mono".to_string(),
            review_mode: "manual".to_string(),
            aggressiveness: "balanced".to_string(),
            writing_context: String::new(),
            sound_enabled: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub path: Option<String>,
    pub content: String,
    pub is_modified: bool,
}

impl Default for Document {
    fn default() -> Self {
        Self {
            path: None,
            content: String::new(),
            is_modified: false,
        }
    }
}

/// Get the app data directory for Miku
fn get_app_data_dir() -> Result<PathBuf, MikuError> {
    dirs::data_dir()
        .map(|p| p.join("miku"))
        .ok_or_else(|| MikuError::Path("Could not determine app data directory".to_string()))
}

#[tauri::command]
pub async fn load_settings() -> Result<EditorSettings, MikuError> {
    let settings_path = get_app_data_dir()?.join("settings.json");

    if settings_path.exists() {
        let content = tokio::fs::read_to_string(&settings_path).await?;
        let settings: EditorSettings = serde_json::from_str(&content)?;
        Ok(settings)
    } else {
        Ok(EditorSettings::default())
    }
}

#[tauri::command]
pub async fn save_settings(settings: EditorSettings) -> Result<(), MikuError> {
    let app_dir = get_app_data_dir()?;
    tokio::fs::create_dir_all(&app_dir).await?;

    let settings_path = app_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings)?;
    tokio::fs::write(&settings_path, content).await?;

    Ok(())
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<Document, MikuError> {
    let content = tokio::fs::read_to_string(&path).await?;
    Ok(Document {
        path: Some(path),
        content,
        is_modified: false,
    })
}

#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), MikuError> {
    tokio::fs::write(&path, &content).await?;
    Ok(())
}

#[tauri::command]
pub fn new_document() -> Document {
    Document::default()
}

#[tauri::command]
pub async fn get_recent_files() -> Result<Vec<String>, MikuError> {
    let recent_path = get_app_data_dir()?.join("recent_files.json");

    if recent_path.exists() {
        let content = tokio::fs::read_to_string(&recent_path).await?;
        let files: Vec<String> = serde_json::from_str(&content)?;
        Ok(files)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn add_recent_file(path: String) -> Result<(), MikuError> {
    let app_dir = get_app_data_dir()?;
    tokio::fs::create_dir_all(&app_dir).await?;

    let recent_path = app_dir.join("recent_files.json");

    let mut files: Vec<String> = if recent_path.exists() {
        let content = tokio::fs::read_to_string(&recent_path).await?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Remove if already exists and add to front
    files.retain(|f| f != &path);
    files.insert(0, path);

    // Keep only last 10 files
    files.truncate(10);

    let content = serde_json::to_string_pretty(&files)?;
    tokio::fs::write(&recent_path, content).await?;

    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = EditorSettings::default();
        assert_eq!(settings.theme, "system");
        assert_eq!(settings.font_size, 16);
        assert_eq!(settings.line_height, 1.6);
        assert_eq!(settings.editor_width, 720);
        assert_eq!(settings.font_family, "mono");
        assert_eq!(settings.review_mode, "manual");
        assert_eq!(settings.aggressiveness, "balanced");
        assert!(settings.writing_context.is_empty());
        assert!(settings.sound_enabled);
    }

    #[test]
    fn test_default_document() {
        let doc = Document::default();
        assert!(doc.path.is_none());
        assert!(doc.content.is_empty());
        assert!(!doc.is_modified);
    }

    #[test]
    fn test_new_document_command() {
        let doc = new_document();
        assert!(doc.path.is_none());
        assert!(doc.content.is_empty());
        assert!(!doc.is_modified);
    }

    #[test]
    fn test_get_app_version() {
        let version = get_app_version();
        assert!(!version.is_empty());
        assert_eq!(version, "0.1.0");
    }

    #[test]
    fn test_settings_serialization() {
        let settings = EditorSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: EditorSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(settings.theme, deserialized.theme);
        assert_eq!(settings.font_size, deserialized.font_size);
        assert_eq!(settings.line_height, deserialized.line_height);
    }

    #[test]
    fn test_document_serialization() {
        let doc = Document {
            path: Some("/test/path.md".to_string()),
            content: "# Test Content".to_string(),
            is_modified: true,
        };

        let json = serde_json::to_string(&doc).unwrap();
        let deserialized: Document = serde_json::from_str(&json).unwrap();

        assert_eq!(doc.path, deserialized.path);
        assert_eq!(doc.content, deserialized.content);
        assert_eq!(doc.is_modified, deserialized.is_modified);
    }

    #[test]
    fn test_error_serialization() {
        let error = MikuError::Path("test error".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("test error"));
    }
}
