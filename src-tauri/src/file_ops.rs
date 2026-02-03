// File operations module for Miku
// This module contains additional file operation utilities

#![allow(dead_code)]

use std::path::Path;

/// Check if a file exists
pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Check if a path is a markdown file
pub fn is_markdown_file(path: &str) -> bool {
    let path = Path::new(path);
    match path.extension() {
        Some(ext) => {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            ext_lower == "md" || ext_lower == "markdown" || ext_lower == "mdown"
        }
        None => false,
    }
}

/// Get the file name from a path
pub fn get_file_name(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
}

/// Get the directory containing a file
pub fn get_parent_dir(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_markdown_file() {
        assert!(is_markdown_file("/path/to/file.md"));
        assert!(is_markdown_file("/path/to/file.markdown"));
        assert!(is_markdown_file("/path/to/file.mdown"));
        assert!(is_markdown_file("file.MD"));
        assert!(!is_markdown_file("/path/to/file.txt"));
        assert!(!is_markdown_file("/path/to/file.rs"));
        assert!(!is_markdown_file("/path/to/file"));
    }

    #[test]
    fn test_get_file_name() {
        assert_eq!(get_file_name("/path/to/file.md"), Some("file.md".to_string()));
        assert_eq!(get_file_name("file.md"), Some("file.md".to_string()));
        // Paths ending with / still get the last component on most systems
        assert_eq!(get_file_name("/path/to/"), Some("to".to_string()));
        // Root path returns None
        assert_eq!(get_file_name("/"), None);
    }

    #[test]
    fn test_get_parent_dir() {
        assert_eq!(get_parent_dir("/path/to/file.md"), Some("/path/to".to_string()));
        assert_eq!(get_parent_dir("file.md"), Some("".to_string()));
    }
}
