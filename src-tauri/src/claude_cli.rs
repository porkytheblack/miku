//! Claude Code CLI Integration Module
//!
//! This module provides Tauri commands for spawning and managing Claude Code CLI
//! processes. It handles bidirectional streaming communication using NDJSON format.
//!
//! ## Architecture
//!
//! - Processes are spawned with `--output-format stream-json` for real-time streaming
//! - Permission delegation uses `--permission-mode delegate` with stdin responses
//! - Process state is tracked in a global HashMap for lifecycle management
//!
//! ## Events Emitted
//!
//! - `claude:stdout` - Raw stdout line (NDJSON)
//! - `claude:stderr` - Raw stderr line
//! - `claude:exit` - Process exit with code
//! - `claude:error` - Internal error

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter};

/// Global registry of active Claude CLI processes
static CLAUDE_PROCESSES: Lazy<Mutex<HashMap<u32, ClaudeProcess>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Counter for generating unique process IDs
static PROCESS_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

/// Represents an active Claude CLI process
struct ClaudeProcess {
    child: Child,
    working_dir: String,
    model: String,
    session_id: Option<String>,
}

/// Options for spawning a Claude CLI process
#[derive(Debug, Deserialize)]
pub struct SpawnOptions {
    /// The prompt to send to Claude
    pub prompt: String,
    /// Working directory for Claude operations
    pub working_dir: String,
    /// Model to use (e.g., "sonnet", "opus", "haiku")
    #[serde(default = "default_model")]
    pub model: String,
    /// Session ID to resume (optional)
    pub session_id: Option<String>,
    /// Whether to use permission delegation mode
    #[serde(default = "default_true")]
    pub delegate_permissions: bool,
    /// Custom system prompt to append
    pub system_prompt: Option<String>,
}

fn default_model() -> String {
    "sonnet".to_string()
}

fn default_true() -> bool {
    true
}

/// Event payload for stdout/stderr
#[derive(Clone, Serialize)]
struct OutputEvent {
    process_id: u32,
    line: String,
}

/// Event payload for process exit
#[derive(Clone, Serialize)]
struct ExitEvent {
    process_id: u32,
    code: Option<i32>,
}

/// Event payload for errors
#[derive(Clone, Serialize)]
struct ErrorEvent {
    process_id: u32,
    message: String,
}

/// Process info returned to frontend
#[derive(Serialize)]
pub struct ProcessInfo {
    pub process_id: u32,
    pub working_dir: String,
    pub model: String,
    pub session_id: Option<String>,
    pub is_running: bool,
}

/// Spawn a new Claude CLI process
///
/// Returns the process ID that can be used to send messages or kill the process.
#[tauri::command]
pub async fn spawn_claude(app: AppHandle, options: SpawnOptions) -> Result<u32, String> {
    // Check if claude CLI is available
    let claude_path = which_claude().ok_or_else(|| {
        "Claude CLI not found. Please install Claude Code: https://claude.ai/code".to_string()
    })?;

    // Build command arguments
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--model".to_string(),
        options.model.clone(),
    ];

    // Add permission delegation if enabled
    if options.delegate_permissions {
        args.push("--permission-mode".to_string());
        args.push("delegate".to_string());
        args.push("--input-format".to_string());
        args.push("stream-json".to_string());
    }

    // Add session resume if provided
    if let Some(ref session_id) = options.session_id {
        args.push("--resume".to_string());
        args.push(session_id.clone());
    }

    // Add custom system prompt if provided
    if let Some(ref system_prompt) = options.system_prompt {
        args.push("--append-system-prompt".to_string());
        args.push(system_prompt.clone());
    }

    // Add the prompt
    args.push(options.prompt.clone());

    // Generate process ID
    let process_id = {
        let mut counter = PROCESS_COUNTER.lock().unwrap();
        *counter += 1;
        *counter
    };

    // Spawn the process
    let mut child = Command::new(&claude_path)
        .args(&args)
        .current_dir(&options.working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // Store process info
    {
        let mut processes = CLAUDE_PROCESSES.lock().unwrap();
        processes.insert(
            process_id,
            ClaudeProcess {
                child,
                working_dir: options.working_dir.clone(),
                model: options.model.clone(),
                session_id: options.session_id.clone(),
            },
        );
    }

    // Spawn stdout reader thread
    let app_handle = app.clone();
    let pid = process_id;
    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let _ = app_handle.emit(
                        "claude:stdout",
                        OutputEvent {
                            process_id: pid,
                            line,
                        },
                    );
                }
                Err(e) => {
                    let _ = app_handle.emit(
                        "claude:error",
                        ErrorEvent {
                            process_id: pid,
                            message: format!("stdout read error: {}", e),
                        },
                    );
                    break;
                }
            }
        }
    });

    // Spawn stderr reader thread
    let app_handle = app.clone();
    let pid = process_id;
    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let _ = app_handle.emit(
                        "claude:stderr",
                        OutputEvent {
                            process_id: pid,
                            line,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Spawn exit watcher thread
    let app_handle = app.clone();
    let pid = process_id;
    thread::spawn(move || {
        // Wait a bit then start checking
        loop {
            thread::sleep(std::time::Duration::from_millis(100));

            let mut processes = CLAUDE_PROCESSES.lock().unwrap();
            if let Some(process) = processes.get_mut(&pid) {
                match process.child.try_wait() {
                    Ok(Some(status)) => {
                        let _ = app_handle.emit(
                            "claude:exit",
                            ExitEvent {
                                process_id: pid,
                                code: status.code(),
                            },
                        );
                        processes.remove(&pid);
                        break;
                    }
                    Ok(None) => {
                        // Still running
                    }
                    Err(e) => {
                        let _ = app_handle.emit(
                            "claude:error",
                            ErrorEvent {
                                process_id: pid,
                                message: format!("wait error: {}", e),
                            },
                        );
                        processes.remove(&pid);
                        break;
                    }
                }
            } else {
                // Process was removed (killed)
                break;
            }
        }
    });

    Ok(process_id)
}

/// Send a message to Claude's stdin (for permission responses)
///
/// The message should be valid JSON for permission responses:
/// ```json
/// {"type": "permission_response", "request_id": "...", "granted": true}
/// ```
#[tauri::command]
pub async fn send_to_claude(process_id: u32, message: String) -> Result<(), String> {
    let mut processes = CLAUDE_PROCESSES.lock().unwrap();
    let process = processes
        .get_mut(&process_id)
        .ok_or_else(|| format!("Process {} not found", process_id))?;

    if let Some(stdin) = process.child.stdin.as_mut() {
        // Write message with newline
        stdin
            .write_all(message.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin
            .write_all(b"\n")
            .map_err(|e| format!("Failed to write newline: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        Ok(())
    } else {
        Err("Process stdin not available".to_string())
    }
}

/// Kill a Claude CLI process
#[tauri::command]
pub async fn kill_claude(process_id: u32) -> Result<(), String> {
    let mut processes = CLAUDE_PROCESSES.lock().unwrap();
    if let Some(mut process) = processes.remove(&process_id) {
        process
            .child
            .kill()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
        Ok(())
    } else {
        Err(format!("Process {} not found", process_id))
    }
}

/// Check if a Claude CLI process is running
#[tauri::command]
pub async fn is_claude_running(process_id: u32) -> Result<bool, String> {
    let mut processes = CLAUDE_PROCESSES.lock().unwrap();
    if let Some(process) = processes.get_mut(&process_id) {
        match process.child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited
                processes.remove(&process_id);
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(e) => Err(format!("Failed to check process status: {}", e)),
        }
    } else {
        Ok(false)
    }
}

/// List all active Claude CLI processes
#[tauri::command]
pub async fn list_claude_processes() -> Result<Vec<ProcessInfo>, String> {
    let mut processes = CLAUDE_PROCESSES.lock().unwrap();
    let mut result = Vec::new();
    let mut to_remove = Vec::new();

    for (id, process) in processes.iter_mut() {
        let is_running = match process.child.try_wait() {
            Ok(Some(_)) => {
                to_remove.push(*id);
                false
            }
            Ok(None) => true,
            Err(_) => {
                to_remove.push(*id);
                false
            }
        };

        if is_running {
            result.push(ProcessInfo {
                process_id: *id,
                working_dir: process.working_dir.clone(),
                model: process.model.clone(),
                session_id: process.session_id.clone(),
                is_running,
            });
        }
    }

    // Clean up dead processes
    for id in to_remove {
        processes.remove(&id);
    }

    Ok(result)
}

/// Find the claude CLI executable
fn which_claude() -> Option<String> {
    // Try common locations
    let paths = [
        "claude",                                    // In PATH
        "/usr/local/bin/claude",                     // macOS/Linux common
        "/opt/homebrew/bin/claude",                  // macOS ARM homebrew
        &format!("{}/.local/bin/claude", std::env::var("HOME").unwrap_or_default()), // User local
    ];

    for path in paths {
        if Command::new(path)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Some(path.to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_model() {
        assert_eq!(default_model(), "sonnet");
    }

    #[test]
    fn test_default_true() {
        assert!(default_true());
    }
}
