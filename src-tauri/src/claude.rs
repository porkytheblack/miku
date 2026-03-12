use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::commands::MikuError;

/// Events emitted to the frontend
#[derive(Clone, Serialize)]
struct ClaudeStdoutEvent {
    id: String,
    line: String,
}

#[derive(Clone, Serialize)]
struct ClaudeStderrEvent {
    id: String,
    text: String,
}

#[derive(Clone, Serialize)]
struct ClaudeExitEvent {
    id: String,
    code: Option<i32>,
}

/// Tracks running claude processes so we can kill them
pub struct ClaudeProcesses {
    handles: Mutex<HashMap<String, tokio::process::Child>>,
}

impl ClaudeProcesses {
    pub fn new() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

/// Find the claude binary path
fn find_claude_binary() -> Result<String, MikuError> {
    // Try to find claude in PATH
    if let Ok(path) = which::which("claude") {
        return Ok(path.to_string_lossy().to_string());
    }

    // Common install locations
    let home = dirs::home_dir().unwrap_or_default();
    let candidates = [
        home.join(".npm-global/bin/claude"),
        home.join(".local/bin/claude"),
        home.join(".nvm/versions/node").join("*").join("bin/claude"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Err(MikuError::Path(
        "Could not find 'claude' binary. Make sure Claude Code is installed and in your PATH."
            .to_string(),
    ))
}

/// Spawn a claude process and stream stdout/stderr as Tauri events.
///
/// Returns the process ID string used for event namespacing and cancellation.
#[tauri::command]
pub async fn claude_prompt(
    app: AppHandle,
    state: tauri::State<'_, Arc<ClaudeProcesses>>,
    id: String,
    prompt: String,
    cwd: String,
    session_id: Option<String>,
    skip_permissions: Option<bool>,
    allowed_tools: Option<Vec<String>>,
) -> Result<(), MikuError> {
    let claude_bin = find_claude_binary()?;

    let mut args = vec![
        "--verbose".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    if skip_permissions.unwrap_or(false) {
        args.push("--dangerously-skip-permissions".to_string());
    }
    if let Some(tools) = &allowed_tools {
        if !tools.is_empty() {
            args.push("--allowedTools".to_string());
            args.push(tools.join(","));
        }
    }
    if let Some(sid) = &session_id {
        args.push("--resume".to_string());
        args.push(sid.clone());
    }
    args.push("-p".to_string());
    args.push(prompt);

    let mut child = Command::new(&claude_bin)
        .args(&args)
        .current_dir(&cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| MikuError::Io(e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Store child for cancellation
    {
        let mut handles = state.handles.lock().await;
        handles.insert(id.clone(), child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let id_stdout = id.clone();
    let id_stderr = id.clone();

    // Stream stdout line by line
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit(
                "claude:stdout",
                ClaudeStdoutEvent {
                    id: id_stdout.clone(),
                    line,
                },
            );
        }
    });

    // Stream stderr
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit(
                "claude:stderr",
                ClaudeStderrEvent {
                    id: id_stderr.clone(),
                    text: line,
                },
            );
        }
    });

    // Wait for process to exit in background
    let state_clone = state.inner().clone();
    let id_exit = id.clone();
    tokio::spawn(async move {
        // Wait for stdout/stderr to drain
        let _ = stdout_handle.await;
        let _ = stderr_handle.await;

        // Get exit code
        let code = {
            let mut handles = state_clone.handles.lock().await;
            if let Some(mut child) = handles.remove(&id_exit) {
                child.wait().await.ok().and_then(|s| s.code())
            } else {
                None
            }
        };

        let _ = app.emit(
            "claude:exit",
            ClaudeExitEvent {
                id: id_exit,
                code,
            },
        );
    });

    Ok(())
}

/// Cancel a running claude process
#[tauri::command]
pub async fn claude_cancel(
    state: tauri::State<'_, Arc<ClaudeProcesses>>,
    id: String,
) -> Result<(), MikuError> {
    let mut handles = state.handles.lock().await;
    if let Some(mut child) = handles.remove(&id) {
        let _ = child.kill().await;
    }
    Ok(())
}

/// Quick check: find claude and return its version
#[tauri::command]
pub async fn claude_version() -> Result<String, MikuError> {
    let claude_bin = find_claude_binary()?;

    let output = Command::new(&claude_bin)
        .arg("--version")
        .output()
        .await
        .map_err(|e| MikuError::Io(e))?;

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Ok(stderr)
    } else {
        Ok(version)
    }
}
