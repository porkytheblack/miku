# RFC-001: Claude Code CLI Integration for Miku Agent Editor

## Status
Draft

## Abstract

This RFC specifies the architecture and implementation details for integrating Claude Code CLI with Miku's `.miku-agent` file type. The integration enables bidirectional streaming communication between Miku's agent editor UI and Claude Code CLI, allowing users to interact with Claude Code through a native desktop interface with real-time response streaming, task tracking, and a delegated permission approval workflow.

## 1. Introduction

### 1.1 Problem Statement

Miku currently has a `.miku-agent` file type with UI components (AgentChat, AgentTaskList, AgentApprovalPanel) and state management (AgentEditorContext), but lacks actual integration with Claude Code CLI. The existing implementation includes placeholder bridge code that references non-existent modules (`claude-bridge.ts`, `claude-events.ts`). This RFC addresses how to bridge the gap between Miku's UI layer and Claude Code CLI's streaming JSON interface.

### 1.2 Goals

1. **G1**: Spawn and manage Claude Code CLI processes from within Miku via Tauri's shell API
2. **G2**: Implement bidirectional streaming communication using `--output-format stream-json` and `--input-format stream-json`
3. **G3**: Intercept permission requests via `--permission-mode delegate` and display them in the AgentApprovalPanel
4. **G4**: Support session persistence with `--resume <session-id>` and `--continue` flags
5. **G5**: Synchronize Claude's internal todo list with Miku's AgentTaskList component
6. **G6**: Handle edge cases including CLI absence, API errors, and unexpected process termination
7. **G7**: Support configurable auto-approval for low-risk operations

### 1.3 Non-Goals

- **NG1**: This RFC does not cover direct API integration with Anthropic's HTTP API (only CLI integration)
- **NG2**: This RFC does not specify cloud synchronization of agent sessions
- **NG3**: This RFC does not address multi-user collaboration on agent files
- **NG4**: This RFC does not specify integration with other AI providers (only Claude Code)

### 1.4 Success Criteria

| Criterion | Metric |
|-----------|--------|
| Response latency | First token visible within 500ms of submission |
| Stream throughput | Token updates at >= 30 Hz when available |
| Permission handling | Approval/rejection response delivered within 100ms |
| Session recovery | Successful resume of sessions after app restart |
| Error recovery | Graceful degradation on CLI errors with user feedback |

## 2. Background

### 2.1 Current State

Miku's agent editor exists with the following components:

**Frontend (React/TypeScript)**:
- `AgentEditor.tsx`: Main container with chat, tasks, and approvals panels
- `AgentChat.tsx`: Message display with markdown rendering and input
- `AgentTaskList.tsx`: Task list with status indicators
- `AgentApprovalPanel.tsx`: Approval cards with diff preview
- `AgentEditorContext.tsx`: State management with reducer pattern

**Type Definitions** (`src/types/agent.ts`):
- `AgentMessage`: Chat message with role, content, timestamp, metadata
- `AgentTask`: Task with status, content, activeForm, timestamps
- `AgentApprovalRequest`: Permission request with type, description, details
- `AgentConfig`: Working directory, model, auto-approve settings
- `MikuAgentDocument`: Complete document structure

**Backend (Rust/Tauri)**:
- `lib.rs`: Registers `claude_cli` module commands (module not yet implemented)
- Tauri plugins: `fs`, `dialog`, `shell`, `updater`, `process`, `log`

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **Claude Code CLI** | Anthropic's command-line interface for interacting with Claude in coding contexts |
| **NDJSON** | Newline-delimited JSON format used for streaming output |
| **Permission delegation** | Mode where Claude requests permission for actions via structured JSON instead of interactive prompts |
| **Session** | A Claude Code conversation with persistent context, identified by session ID |
| **Stream event** | A single JSON object in the NDJSON output stream |
| **Bridge** | TypeScript module that manages the Claude CLI process and event translation |

### 2.3 Prior Art

**Claude Code CLI Output Format**

From `claude --help` and empirical testing:

```bash
claude --print \
       --output-format stream-json \
       --include-partial-messages \
       --permission-mode delegate \
       --model sonnet \
       "Your prompt here"
```

The CLI outputs newline-delimited JSON events to stdout. Based on analysis of Claude Code's behavior, the event types include:

1. **System events**: `init`, `result`, `error`
2. **Message events**: Contains assistant response content
3. **Permission events**: Contains tool use requiring approval
4. **Completion events**: Indicates end of response

**Tauri Shell API**

Tauri provides `tauri-plugin-shell` for spawning child processes:
- `Command::new("claude")`: Create a new command
- `.args([...])`: Add command-line arguments
- `.spawn()`: Start process, returns handle
- Event-based stdout/stderr handling via channels
- Process termination via `kill()`

## 3. Algorithm Analysis

### 3.1 Candidate Approaches

#### 3.1.1 Tauri Rust-Side Process Management

**Description**: All Claude CLI process management occurs in Rust. The frontend communicates via Tauri commands and events.

**Architecture**:
```
Frontend (TS) --[invoke]--> Tauri Commands (Rust) --[spawn]--> Claude CLI
                  ^                                               |
                  |                                               v
              [events]<---------[channel]---------[stdout parser]
```

**Time Complexity**: O(n) where n is stream message count
**Space Complexity**: O(m) where m is buffer size for partial messages
**Advantages**:
- Native process control with proper signal handling
- Efficient binary parsing possible
- Better resource management
- Tauri's built-in security sandbox
**Disadvantages**:
- More complex IPC between Rust and TypeScript
- Rust async complexity
- Debugging across language boundary
**Best Suited For**: Production deployment with reliability requirements

#### 3.1.2 JavaScript-Side Process Management via Shell Plugin

**Description**: Use Tauri's shell plugin directly from JavaScript to spawn and manage the Claude process.

**Architecture**:
```
Frontend (TS) --[shell.Command]--> Claude CLI
      ^                               |
      |                               v
  [state]<------[stdout callback]-----
```

**Time Complexity**: O(n) where n is stream message count
**Space Complexity**: O(m + c) where m is message buffer, c is conversation history
**Advantages**:
- Simpler implementation (single language)
- Easier debugging
- Direct state management integration
**Disadvantages**:
- Less control over process signals
- Potential memory issues with large outputs
- May require sidecar for proper stdin handling
**Best Suited For**: Rapid prototyping, simpler deployments

#### 3.1.3 Hybrid Approach

**Description**: Rust handles process lifecycle and binary stdout parsing; TypeScript handles business logic and state management.

**Architecture**:
```
Frontend (TS) --[invoke spawn]--> Rust Process Manager --[spawn]--> Claude CLI
      |                                   |                            |
      |                                   |<----[raw stdout]-----------+
      |                                   |
      |<---[tauri events]---[JSON parse]--+
```

**Time Complexity**: O(n) for event processing
**Space Complexity**: O(b) for line buffer in Rust, O(s) for state in TS
**Advantages**:
- Separation of concerns
- Robust process management
- Efficient parsing
- Clean API boundary
**Disadvantages**:
- More code overall
- Need to maintain type alignment
**Best Suited For**: Balanced reliability and maintainability

### 3.2 Comparative Analysis

| Criterion | Rust-Side | JS-Side | Hybrid |
|-----------|-----------|---------|--------|
| Implementation complexity | High | Low | Medium |
| Process control | Excellent | Good | Excellent |
| Debugging ease | Low | High | Medium |
| Memory efficiency | High | Medium | High |
| Stdin handling | Native | Limited | Native |
| Type safety | Partial | Full in TS | Split |
| Maintenance burden | Medium | Low | Medium |

### 3.3 Recommendation

**Selected: Hybrid Approach (3.1.3)**

**Justification**:

1. **Stdin requirement**: Claude's `--permission-mode delegate` with `--input-format stream-json` requires writing JSON responses to stdin. Tauri's shell plugin has limited stdin support; Rust-side management enables proper bidirectional communication.

2. **Process lifecycle**: Rust provides reliable signal handling for graceful termination, essential when users close Miku mid-operation.

3. **Memory safety**: Rust's line-buffered stdout parsing prevents memory issues with large Claude responses.

4. **State management**: TypeScript's AgentEditorContext already provides robust state management; duplicating this in Rust would be wasteful.

5. **Existing patterns**: The codebase already follows this pattern (Tauri commands + frontend state).

## 4. Detailed Design

### 4.1 Architecture Overview

```
+------------------------------------------------------------------+
|                          Miku Frontend                            |
|  +------------------------+  +-------------------------------+   |
|  |   AgentEditorContext   |  |       UI Components          |   |
|  |  - state management    |  |  - AgentChat                 |   |
|  |  - event handlers      |  |  - AgentTaskList             |   |
|  |  - bridge integration  |  |  - AgentApprovalPanel        |   |
|  +----------+-------------+  +-------------------------------+   |
|             |                                                     |
|             v                                                     |
|  +------------------------+                                      |
|  |     Claude Bridge      |  (src/lib/agent/claude-bridge.ts)   |
|  |  - event parsing       |                                      |
|  |  - type conversion     |                                      |
|  |  - handler dispatch    |                                      |
|  +----------+-------------+                                      |
+-------------|------------------------------------------------+
              | Tauri invoke() / listen()
+-------------|------------------------------------------------+
|             v                          Miku Backend (Rust)        |
|  +------------------------+                                      |
|  |    Claude CLI Module   |  (src-tauri/src/claude_cli.rs)      |
|  |  - process spawning    |                                      |
|  |  - stdout parsing      |                                      |
|  |  - stdin writing       |                                      |
|  |  - lifecycle mgmt      |                                      |
|  +----------+-------------+                                      |
+-------------|------------------------------------------------+
              | spawn / stdin / stdout
              v
+------------------------------------------------------------------+
|                        Claude Code CLI                            |
|  claude --print --output-format stream-json                      |
|         --input-format stream-json --permission-mode delegate    |
+------------------------------------------------------------------+
```

### 4.2 Data Structures

#### 4.2.1 Claude CLI Event Types (TypeScript)

**Location**: `src/lib/agent/claude-events.ts`

```typescript
/**
 * Base event interface for all Claude CLI events
 */
interface ClaudeBaseEvent {
  type: string;
  timestamp?: string;
}

/**
 * Initialization event sent when Claude starts
 */
interface ClaudeInitEvent extends ClaudeBaseEvent {
  type: 'init';
  session_id: string;
  model: string;
  cwd: string;
  tools_available: string[];
}

/**
 * Message event containing assistant response content
 */
interface ClaudeMessageEvent extends ClaudeBaseEvent {
  type: 'message';
  message: {
    id: string;
    role: 'assistant';
    content: ClaudeContentBlock[];
    model: string;
    stop_reason: string | null;
  };
  /** True if this is a partial update during streaming */
  partial: boolean;
}

/**
 * Content block types in a message
 */
type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Permission request event from --permission-mode delegate
 */
interface ClaudePermissionRequestEvent extends ClaudeBaseEvent {
  type: 'permission_request';
  request_id: string;
  tool: ClaudeToolInfo;
  /** Human-readable description of the action */
  message: string;
}

/**
 * Tool information in a permission request
 */
interface ClaudeToolInfo {
  name: string;
  /** Tool-specific parameters */
  params: Record<string, unknown>;
  /** For file operations */
  file_path?: string;
  /** For edit operations */
  diff?: string;
  /** For bash operations */
  command?: string;
  /** For web operations */
  url?: string;
}

/**
 * Result event when Claude completes processing
 */
interface ClaudeResultEvent extends ClaudeBaseEvent {
  type: 'result';
  result: {
    success: boolean;
    session_id: string;
    /** Total tokens used */
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Error event from Claude
 */
interface ClaudeErrorEvent extends ClaudeBaseEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Todo list update event
 */
interface ClaudeTodoEvent extends ClaudeBaseEvent {
  type: 'todo';
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}

/**
 * Union type of all possible Claude events
 */
type ClaudeEvent =
  | ClaudeInitEvent
  | ClaudeMessageEvent
  | ClaudePermissionRequestEvent
  | ClaudeResultEvent
  | ClaudeErrorEvent
  | ClaudeTodoEvent;
```

**Invariants**:
- `type` field is always present and matches one of the defined event types
- `partial: true` messages may have incomplete content
- `permission_request` events block further processing until response is sent
- `session_id` is consistent across all events in a session

#### 4.2.2 Rust Process State

**Location**: `src-tauri/src/claude_cli.rs`

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::process::{Child, ChildStdin};

/// State for a single Claude CLI process
#[derive(Debug)]
pub struct ClaudeProcess {
    /// Unique process identifier (UUID)
    pub id: String,
    /// Session ID from Claude (for resume)
    pub session_id: Option<String>,
    /// Working directory for this session
    pub cwd: String,
    /// Model being used
    pub model: String,
    /// Process handle
    pub child: Child,
    /// Stdin handle for sending permission responses
    pub stdin: Option<ChildStdin>,
    /// Whether the process is currently waiting for permission
    pub awaiting_permission: bool,
    /// Pending permission request IDs
    pub pending_permissions: Vec<String>,
}

/// Global state managing all Claude processes
pub struct ClaudeCliState {
    /// Map from process ID to process state
    pub processes: HashMap<String, ClaudeProcess>,
}

impl ClaudeCliState {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }
}

/// Thread-safe wrapper for CLI state
pub type ClaudeCliStateHandle = Arc<Mutex<ClaudeCliState>>;
```

**Memory Layout**: Process handles are stored in a HashMap indexed by UUID. Each process owns its Child and ChildStdin handles.

#### 4.2.3 Permission Response Format

**Location**: Used by Rust stdin writer

```rust
/// JSON structure sent to Claude stdin for permission responses
#[derive(Debug, Serialize)]
pub struct PermissionResponse {
    /// "permission_response"
    #[serde(rename = "type")]
    pub response_type: String,
    /// Must match request_id from permission_request event
    pub request_id: String,
    /// true = approved, false = rejected
    pub granted: bool,
    /// Optional reason for rejection
    pub reason: Option<String>,
}
```

#### 4.2.4 Session Persistence Format

**Location**: Stored in `.miku-agent` file under new `session` field

```typescript
interface AgentSessionInfo {
  /** Claude session ID for resume */
  sessionId: string;
  /** When the session was started */
  startedAt: string;
  /** When last activity occurred */
  lastActivityAt: string;
  /** Whether the session ended normally */
  cleanExit: boolean;
  /** Model used in this session */
  model: string;
}

// Extended MikuAgentDocument
interface MikuAgentDocument {
  // ... existing fields ...
  /** Optional session info for resume capability */
  session?: AgentSessionInfo;
}
```

### 4.3 Algorithm Specification

#### 4.3.1 Process Spawning

**Location**: `src-tauri/src/claude_cli.rs`

```
PROCEDURE spawn_claude(cwd: String, prompt: String, model: String,
                       system_prompt: Option<String>, resume_session: Option<String>)
  REQUIRE: cwd is a valid directory path
  REQUIRE: prompt is non-empty
  ENSURE: Returns process ID on success, error on failure
  ENSURE: Process is registered in global state

  1. Generate unique process ID (UUID v4)

  2. Build command arguments:
     args = ["--print", "--output-format", "stream-json",
             "--input-format", "stream-json",
             "--permission-mode", "delegate",
             "--include-partial-messages"]

     IF resume_session is Some:
       args.append(["--resume", resume_session])
     ELSE:
       args.append(["--model", model])
       IF system_prompt is Some:
         args.append(["--system-prompt", system_prompt])

     args.append(prompt)

  3. Spawn process:
     command = Command::new("claude")
       .current_dir(cwd)
       .args(args)
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())

     child = command.spawn()?

  4. Extract stdin handle:
     stdin = child.stdin.take()

  5. Create process state:
     process = ClaudeProcess {
       id: process_id,
       session_id: None,  // Updated when init event received
       cwd: cwd,
       model: model,
       child: child,
       stdin: stdin,
       awaiting_permission: false,
       pending_permissions: vec![],
     }

  6. Register in global state:
     state.lock().processes.insert(process_id, process)

  7. Spawn stdout reader task:
     tokio::spawn(read_stdout(process_id, child.stdout, app_handle))

  8. Spawn stderr reader task:
     tokio::spawn(read_stderr(process_id, child.stderr, app_handle))

  9. RETURN process_id
```

#### 4.3.2 NDJSON Stdout Parsing

**Location**: `src-tauri/src/claude_cli.rs`

```
PROCEDURE read_stdout(process_id: String, stdout: ChildStdout, app_handle: AppHandle)
  REQUIRE: stdout is valid readable stream
  ENSURE: Events are emitted to frontend via Tauri events
  ENSURE: Process state is updated on init event

  1. Create buffered reader:
     reader = BufReader::new(stdout)
     lines = reader.lines()

  2. FOR EACH line IN lines:
     2.1 IF line is empty: CONTINUE

     2.2 TRY parse as JSON:
          event = serde_json::from_str::<ClaudeEvent>(&line)?

     2.3 MATCH event.type:
          "init" =>
            // Update session ID in state
            state.lock().processes.get_mut(process_id).session_id = event.session_id

          "permission_request" =>
            // Mark process as awaiting permission
            state.lock().processes.get_mut(process_id).awaiting_permission = true
            state.lock().processes.get_mut(process_id)
              .pending_permissions.push(event.request_id)

          _ => // No state update needed

     2.4 Emit event to frontend:
          app_handle.emit_all("claude:event", ClaudeEventPayload {
            process_id: process_id,
            event: event,
          })

  3. ON stream end:
     // Emit exit event
     app_handle.emit_all("claude:exit", ClaudeExitPayload {
       process_id: process_id,
       code: child.wait().code(),
     })

     // Clean up state
     state.lock().processes.remove(process_id)
```

#### 4.3.3 Permission Response Handling

**Location**: `src-tauri/src/claude_cli.rs`

```
PROCEDURE send_permission_response(process_id: String, request_id: String,
                                   granted: bool, reason: Option<String>)
  REQUIRE: process_id exists in state
  REQUIRE: request_id is in pending_permissions
  ENSURE: Response is written to stdin
  ENSURE: Process state is updated

  1. Acquire state lock:
     state = state.lock()
     process = state.processes.get_mut(process_id)?

  2. Validate request:
     IF request_id NOT IN process.pending_permissions:
       RETURN Err("Unknown request ID")

  3. Build response JSON:
     response = PermissionResponse {
       response_type: "permission_response",
       request_id: request_id,
       granted: granted,
       reason: reason,
     }
     json = serde_json::to_string(&response)?

  4. Write to stdin:
     stdin = process.stdin.as_mut()?
     stdin.write_all(json.as_bytes())?
     stdin.write_all(b"\n")?  // NDJSON newline
     stdin.flush()?

  5. Update state:
     process.pending_permissions.retain(|id| id != request_id)
     IF process.pending_permissions.is_empty():
       process.awaiting_permission = false

  6. RETURN Ok(())
```

#### 4.3.4 Frontend Event Handling

**Location**: `src/lib/agent/claude-bridge.ts`

```
PROCEDURE handleClaudeEvent(event: ClaudeEvent, dispatch: Dispatch,
                            state: AgentEditorState)
  REQUIRE: event is valid ClaudeEvent
  ENSURE: UI state is updated appropriately

  1. MATCH event.type:

     "init" =>
       dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' })
       // Store session ID for resume capability
       updateSessionInfo(state.document, event.session_id)

     "message" =>
       text = extractMessageText(event.message.content)
       thinking = extractThinkingText(event.message.content)

       IF event.partial:
         dispatch({ type: 'UPDATE_STREAMING_MESSAGE', content: text, thinking })
       ELSE:
         dispatch({ type: 'UPDATE_STREAMING_MESSAGE', content: text, thinking })
         // Check for tool_use blocks that might have been auto-approved
         handleToolUseBlocks(event.message.content, dispatch)

     "permission_request" =>
       approval = convertPermissionToApproval(event)
       dispatch({
         type: 'ADD_APPROVAL_WITH_REQUEST_ID',
         approval: approval,
         requestId: event.request_id
       })

     "todo" =>
       tasks = event.todos.map(todo => ({
         id: generateAgentId('task'),
         content: todo.content,
         activeForm: todo.activeForm || todo.content,
         status: mapTodoStatus(todo.status),
         createdAt: new Date().toISOString(),
       }))
       dispatch({ type: 'SET_TASKS', tasks })

     "result" =>
       dispatch({ type: 'END_STREAMING' })
       IF event.result.success:
         dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' })
       ELSE:
         dispatch({ type: 'SET_ERROR', error: 'Claude session ended unsuccessfully' })

     "error" =>
       dispatch({ type: 'SET_ERROR', error: event.error.message })
       dispatch({ type: 'END_STREAMING' })
```

#### 4.3.5 Session Resume Algorithm

**Location**: `src/context/AgentEditorContext.tsx`

```
PROCEDURE resumeSession(document: MikuAgentDocument)
  REQUIRE: document.session exists
  REQUIRE: document.session.cleanExit is false OR user explicitly requests resume
  ENSURE: Session is resumed or new session is started

  1. IF document.session is None OR document.session.cleanExit:
     RETURN false  // Nothing to resume

  2. sessionId = document.session.sessionId
     age = now() - document.session.lastActivityAt

  3. IF age > MAX_SESSION_AGE (24 hours):
     // Session too old, start fresh
     dispatch({ type: 'CLEAR_SESSION_INFO' })
     RETURN false

  4. TRY:
     processId = await invoke('spawn_claude', {
       cwd: document.config.workingDirectory,
       prompt: "--continue",  // Special flag for continuation
       model: document.config.model,
       resumeSession: sessionId,
     })

     dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' })
     RETURN true

  5. CATCH error:
     // Resume failed, clear session info and allow fresh start
     dispatch({ type: 'CLEAR_SESSION_INFO' })
     dispatch({ type: 'SET_ERROR', error: 'Failed to resume session' })
     RETURN false
```

### 4.4 Interface Definition

#### 4.4.1 Tauri Commands (Rust -> Frontend)

```rust
/// Spawn a new Claude CLI process
///
/// # Arguments
/// * `cwd` - Working directory for Claude
/// * `prompt` - Initial prompt to send
/// * `model` - Model to use (e.g., "sonnet", "opus", "haiku")
/// * `system_prompt` - Optional custom system prompt
/// * `resume_session` - Optional session ID to resume
///
/// # Returns
/// Process ID (UUID string) on success
#[tauri::command]
pub async fn spawn_claude(
    state: State<'_, ClaudeCliStateHandle>,
    app_handle: AppHandle,
    cwd: String,
    prompt: String,
    model: Option<String>,
    system_prompt: Option<String>,
    resume_session: Option<String>,
) -> Result<String, String>;

/// Send a permission response to a Claude process
///
/// # Arguments
/// * `process_id` - Process ID returned from spawn_claude
/// * `request_id` - Request ID from permission_request event
/// * `granted` - Whether permission is granted
/// * `reason` - Optional reason (for rejections)
#[tauri::command]
pub async fn send_to_claude(
    state: State<'_, ClaudeCliStateHandle>,
    process_id: String,
    request_id: String,
    granted: bool,
    reason: Option<String>,
) -> Result<(), String>;

/// Kill a Claude CLI process
///
/// # Arguments
/// * `process_id` - Process ID to kill
#[tauri::command]
pub async fn kill_claude(
    state: State<'_, ClaudeCliStateHandle>,
    process_id: String,
) -> Result<(), String>;

/// Check if a Claude process is running
///
/// # Arguments
/// * `process_id` - Process ID to check
///
/// # Returns
/// True if process is running and responsive
#[tauri::command]
pub async fn is_claude_running(
    state: State<'_, ClaudeCliStateHandle>,
    process_id: String,
) -> bool;

/// List all active Claude processes
///
/// # Returns
/// Array of process info objects
#[tauri::command]
pub async fn list_claude_processes(
    state: State<'_, ClaudeCliStateHandle>,
) -> Vec<ClaudeProcessInfo>;
```

#### 4.4.2 Tauri Events (Rust -> Frontend)

```typescript
// Event: claude:event
// Payload contains parsed NDJSON event
interface ClaudeEventPayload {
  processId: string;
  event: ClaudeEvent;
}

// Event: claude:exit
// Emitted when Claude process exits
interface ClaudeExitPayload {
  processId: string;
  code: number | null;
  signal: string | null;
}

// Event: claude:error
// Emitted on process-level errors
interface ClaudeProcessErrorPayload {
  processId: string;
  error: string;
}
```

#### 4.4.3 TypeScript Bridge API

```typescript
// src/lib/agent/claude-bridge.ts

export interface ClaudeBridgeConfig {
  workingDirectory: string;
  prompt: string;
  model?: string;
  systemPrompt?: string;
  resumeSession?: string;
  maxTokens?: number;
}

export interface ClaudeBridgeHandlers {
  onMessage: (event: ClaudeMessageEvent) => void;
  onPermissionRequest: (event: ClaudePermissionRequestEvent) => void;
  onTodoUpdate: (event: ClaudeTodoEvent) => void;
  onError: (event: ClaudeErrorEvent) => void;
  onResult: (event: ClaudeResultEvent) => void;
  onCompletion: () => void;
  onExit: (code: number | null) => void;
  onAnyEvent?: (event: ClaudeEvent) => void;
}

export interface ClaudeBridge {
  /** Start a Claude session with the given configuration */
  start(config: ClaudeBridgeConfig): Promise<void>;

  /** Stop the current session */
  stop(): Promise<void>;

  /** Respond to a permission request */
  respondToPermission(requestId: string, granted: boolean, reason?: string): Promise<void>;

  /** Check if a session is currently active */
  isActive(): boolean;

  /** Get the current process ID */
  getProcessId(): string | null;

  /** Get the current session ID (for resume) */
  getSessionId(): string | null;

  /** Set event handlers */
  setHandlers(handlers: Partial<ClaudeBridgeHandlers>): void;
}

/** Create a new Claude bridge instance */
export function createClaudeBridge(): ClaudeBridge;

/** Get the singleton bridge instance (for shared use) */
export function getClaudeBridge(): ClaudeBridge;
```

### 4.5 Error Handling

| Error Condition | Detection | Response |
|-----------------|-----------|----------|
| CLI not installed | `spawn` returns ENOENT | Display installation instructions |
| API key missing | Error event with auth error | Prompt user to configure API key |
| Network failure | Error event with network error | Retry with exponential backoff (3 attempts) |
| Process crash | Unexpected exit event | Mark session as dirty, offer resume |
| Permission timeout | 5 minute timeout on permission_request | Auto-reject with timeout reason |
| Invalid JSON | Parse error in stdout | Log warning, skip malformed line |
| Stdin write failure | IO error on permission response | Mark session as failed, notify user |
| Session not found | Resume fails with session error | Clear session, start fresh |

### 4.6 Edge Cases

#### Empty Inputs
- Empty prompt: Reject at validation layer before spawn
- Empty working directory: Default to app data directory

#### Single Element Inputs
- Single message conversation: Normal processing
- Single task in todo: Normal processing
- Single pending approval: Normal processing

#### Maximum Size Inputs
- Very long prompt (>100KB): Warn user, proceed (CLI handles limits)
- Many messages (>1000): Archive old messages, keep recent 100 in active conversation
- Large diff in approval (>50KB): Truncate display with "show more" option

#### Malformed Inputs
- Invalid JSON in stdin response: Rust validates before sending
- Invalid session ID: CLI returns error, caught and handled
- Non-existent process ID: Return error immediately

#### Concurrent Access
- Multiple rapid permission responses: Queue in order, process sequentially
- User closes app during generation: `kill_claude` called in cleanup
- Multiple agent files open: Each has independent bridge instance

#### Resource Exhaustion
- Process limit reached: Display error, suggest closing other sessions
- Memory pressure: Implement message pagination, clear old streaming data

## 5. Implementation Guide

### 5.1 Prerequisites

**Development Environment**:
- Rust 1.70+ with Cargo
- Node.js 18+ with npm/pnpm
- Claude Code CLI installed and authenticated (`claude --version` succeeds)
- Tauri CLI 2.0+

**Dependencies to Add**:

`src-tauri/Cargo.toml`:
```toml
[dependencies]
uuid = { version = "1.6", features = ["v4"] }
tokio = { version = "1", features = ["process", "io-util", "sync"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

`package.json` (no new dependencies required, uses existing Tauri APIs)

### 5.2 Implementation Order

**Phase 1: Rust Backend (3-4 days)**
1. Create `src-tauri/src/claude_cli.rs` with state structs
2. Implement `spawn_claude` command with basic stdout handling
3. Implement `kill_claude` and `is_claude_running` commands
4. Add NDJSON parsing and event emission
5. Implement `send_to_claude` for permission responses
6. Add `list_claude_processes` for debugging
7. Write unit tests for parsing and state management

**Phase 2: TypeScript Bridge (2-3 days)**
1. Create `src/lib/agent/claude-events.ts` with type definitions
2. Create `src/lib/agent/claude-bridge.ts` with bridge class
3. Implement Tauri event listeners in bridge
4. Add type conversion utilities (Claude events to Miku types)
5. Implement error handling and retry logic
6. Write unit tests for event parsing and conversion

**Phase 3: Context Integration (2-3 days)**
1. Update `AgentEditorContext.tsx` to use real bridge
2. Connect bridge events to reducer actions
3. Implement session persistence in document
4. Add session resume logic
5. Implement auto-approval for configured action types
6. Write integration tests

**Phase 4: UI Polish (1-2 days)**
1. Add CLI installation detection and guidance
2. Improve error messages and user feedback
3. Add loading states during connection
4. Test with various models and prompts
5. Performance optimization for large conversations

### 5.3 Testing Strategy

**Unit Tests**:
- Rust: NDJSON parsing, permission response serialization
- TypeScript: Event type conversion, state reducer actions

**Integration Tests**:
- Spawn process, receive init event
- Send prompt, receive streaming messages
- Permission request -> approval -> continuation
- Process termination cleanup

**End-to-End Tests**:
- Full conversation flow with file edit approval
- Session resume after app restart
- Error recovery scenarios

**Performance Benchmarks**:
- Token streaming latency measurement
- Memory usage during long conversations
- Multiple concurrent sessions

### 5.4 Common Pitfalls

1. **Forgetting newline in NDJSON**: Each JSON object must be followed by `\n`

2. **Stdin handle dropped**: Keep `ChildStdin` in process state; dropping it closes the pipe

3. **Event listener cleanup**: Unlisten from Tauri events when component unmounts

4. **Session ID timing**: Session ID arrives in `init` event, not immediately after spawn

5. **Permission response race**: User might respond while still streaming; handle gracefully

6. **Working directory validation**: Validate directory exists before spawning

7. **Model name mapping**: CLI uses "sonnet", "opus", "haiku"; map from full names

8. **Partial message handling**: Don't treat partial messages as final; accumulate content

## 6. Performance Characteristics

### 6.1 Complexity Analysis

**Process Spawning**: O(1) - single system call
**Event Parsing**: O(n) where n is JSON size per line
**State Updates**: O(1) amortized for HashMap operations
**Message Rendering**: O(m) where m is message count (virtualized)
**Permission Response**: O(1) - single stdin write

### 6.2 Benchmarking Methodology

```typescript
// Measure time to first token
const t0 = performance.now();
bridge.start({ prompt: "Hello" });
bridge.setHandlers({
  onMessage: (event) => {
    if (event.partial && event.message.content.length > 0) {
      const ttft = performance.now() - t0;
      console.log(`Time to first token: ${ttft}ms`);
    }
  }
});

// Measure token throughput
let tokenCount = 0;
let lastTime = performance.now();
bridge.setHandlers({
  onMessage: (event) => {
    if (event.partial) {
      const newTokens = countTokens(event.message.content) - tokenCount;
      tokenCount += newTokens;
      const now = performance.now();
      const rate = newTokens / ((now - lastTime) / 1000);
      lastTime = now;
      console.log(`Token rate: ${rate} tokens/sec`);
    }
  }
});
```

### 6.3 Expected Performance

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Process spawn | <100ms | Depends on CLI cold start |
| First token | <500ms | After prompt submission |
| Token updates | 30-60 Hz | Limited by CLI output rate |
| Permission display | <50ms | From event to UI |
| Approval response | <100ms | From click to stdin |
| Session resume | <200ms | Faster than fresh start |

### 6.4 Optimization Opportunities

1. **Message virtualization**: Only render visible messages for long conversations
2. **Diff caching**: Cache parsed diffs to avoid re-parsing in approval panel
3. **Batch state updates**: Debounce rapid partial message updates (16ms)
4. **Worker thread parsing**: Move JSON parsing to web worker for large events
5. **Binary protocol**: Future optimization - custom binary protocol instead of JSON

## 7. Security Considerations

### 7.1 Process Isolation

- Claude CLI runs in user context, not elevated
- Working directory is explicitly specified (no path traversal)
- No shell interpretation of commands (direct exec)

### 7.2 Permission Model

- All file/command operations require explicit approval
- Auto-approval is opt-in and configurable
- Approval UI shows full context (paths, diffs, commands)
- Rejection is always available

### 7.3 Data Handling

- API keys are handled by Claude CLI, not stored in Miku
- Session IDs stored locally are opaque identifiers
- Conversation content is stored in `.miku-agent` files (user-controlled)

### 7.4 Input Validation

- All Tauri commands validate inputs before processing
- Process IDs must be valid UUIDs
- Request IDs must match pending permissions
- JSON is validated before stdin write

## 8. Operational Considerations

### 8.1 Monitoring

**Metrics to Track**:
- Process spawn success/failure rate
- Average time to first token
- Permission approval/rejection ratio
- Session resume success rate
- Error event frequency by type

**Implementation**:
```typescript
// Log structured events for analytics
const logEvent = (type: string, data: object) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: type,
    ...data
  }));
};
```

### 8.2 Alerting

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Spawn failure rate | >10% in 5 min | Check CLI installation |
| API errors | >5 consecutive | Display API status |
| Process crashes | >3 in 10 min | Suggest restart |
| Memory usage | >500MB | Archive old messages |

### 8.3 Debugging

**Debug Mode**:
```typescript
// Enable verbose logging
if (process.env.MIKU_DEBUG_CLAUDE) {
  bridge.setHandlers({
    onAnyEvent: (event) => {
      console.log('[Claude Event]', JSON.stringify(event, null, 2));
    }
  });
}
```

**Process Inspection**:
```typescript
// List all active Claude processes
const processes = await invoke('list_claude_processes');
console.table(processes);
```

## 9. Migration Plan

### 9.1 From Placeholder to Real Implementation

1. **Phase 1**: Implement backend without breaking frontend
   - Add `claude_cli.rs` with all commands
   - Frontend continues to use existing (non-functional) bridge

2. **Phase 2**: Implement real bridge alongside placeholder
   - Create `claude-bridge.ts` and `claude-events.ts`
   - Feature flag to switch between implementations

3. **Phase 3**: Switch to real implementation
   - Update context to use real bridge
   - Remove feature flag
   - Keep placeholder for reference

4. **Phase 4**: Cleanup
   - Remove placeholder code
   - Update documentation

### 9.2 Document Format Migration

The `MikuAgentDocument` format gains an optional `session` field:

```typescript
// Version 1.0 -> 1.1
// Backward compatible: old files without session field work
// Forward compatible: new files with session field ignored by old readers
interface MikuAgentDocument {
  version: string; // "1.1"
  // ... existing fields ...
  session?: AgentSessionInfo; // New optional field
}
```

Migration is automatic: files without `session` are valid; on save, session info is added if active.

## 10. Open Questions

### 10.1 Resolved

- **Q**: How to handle multiple agent files open simultaneously?
  **A**: Each file gets its own bridge instance; process IDs are unique

- **Q**: What happens if Claude outputs invalid JSON?
  **A**: Log warning, skip malformed line, continue processing

### 10.2 Pending Investigation

- **Q**: What is the exact format of `--output-format stream-json`?
  **Status**: Needs empirical testing with Claude CLI
  **Plan**: Create test harness to capture and document all event types

- **Q**: How does `--permission-mode delegate` interact with tool_use blocks?
  **Status**: Documentation unclear
  **Plan**: Test with various tools (file edit, bash, web fetch)

- **Q**: Can session be resumed after CLI update?
  **Status**: Unknown
  **Plan**: Test cross-version resume behavior

- **Q**: What is the maximum prompt size Claude CLI accepts?
  **Status**: Unknown
  **Plan**: Test with progressively larger prompts

## 11. References

1. **Claude Code CLI Help**: `claude --help` output
2. **Tauri Shell Plugin**: https://v2.tauri.app/plugin/shell/
3. **Tauri Events**: https://v2.tauri.app/develop/calling-rust/#events
4. **NDJSON Specification**: http://ndjson.org/
5. **Miku Agent Types**: `src/types/agent.ts`
6. **Miku Agent Context**: `src/context/AgentEditorContext.tsx`

## Appendices

### A. Worked Examples

#### A.1 Simple Chat Flow

```
User opens agent.miku-agent
User types: "What files are in this directory?"
  1. Frontend calls sendToClaud("What files are in this directory?")
  2. Context dispatches ADD_MESSAGE (user message)
  3. Context calls startClaudeSession()
  4. Bridge invokes spawn_claude via Tauri
  5. Rust spawns: claude --print --output-format stream-json ...
  6. Rust receives init event, emits claude:event
  7. Bridge updates session ID
  8. Claude lists files using bash tool
  9. Rust receives permission_request event, emits claude:event
  10. Bridge converts to approval, dispatches ADD_APPROVAL_WITH_REQUEST_ID
  11. UI shows approval card with command "ls -la"
  12. User clicks Approve
  13. Context calls respondToPermission(approvalId, true)
  14. Bridge invokes send_to_claude via Tauri
  15. Rust writes {"type":"permission_response","request_id":"...","granted":true}
  16. Claude executes ls, streams response
  17. Rust receives message events, emits claude:event
  18. Bridge updates streaming message content
  19. Rust receives result event, emits claude:event
  20. Bridge dispatches END_STREAMING
  21. UI shows complete response with file listing
```

#### A.2 Session Resume Flow

```
User opens agent.miku-agent (has session info from previous use)
  1. Context loads document, sees session.cleanExit = false
  2. Context calls resumeSession()
  3. Bridge invokes spawn_claude with resumeSession = session.sessionId
  4. Rust spawns: claude --resume <session_id> ...
  5. If successful: Claude resumes context
  6. If failed: Context clears session, user starts fresh
```

### B. Proof of Correctness

#### B.1 Permission Handling Correctness

**Claim**: Permission requests are correctly matched with responses.

**Proof**:
1. Each permission_request has unique request_id
2. On permission_request, request_id is stored in approvalRequestMap
3. On user approval/rejection, we lookup request_id by our approval ID
4. Response includes exact request_id from map
5. Rust validates request_id exists in pending_permissions before writing
6. Therefore, response always matches request QED

#### B.2 State Consistency

**Claim**: UI state remains consistent with Claude process state.

**Proof by invariant maintenance**:
- Invariant I1: isGenerating iff process is running and awaiting response
- Invariant I2: pendingApprovals matches pending_permissions in Rust

I1 maintenance:
- Set true in START_STREAMING (before spawn completes)
- Set false in END_STREAMING (on result/error/exit events)
- Exit event always emitted (normal or crash)

I2 maintenance:
- ADD_APPROVAL_WITH_REQUEST_ID: Both states add entry
- RESOLVE_APPROVAL: Both states remove entry
- CLEAR_APPROVAL_MAP: Called on exit, syncs states

### C. Alternative Approaches Considered

#### C.1 WebSocket Server Approach

**Description**: Run a local WebSocket server that bridges to Claude CLI.

**Why Rejected**:
- Adds architectural complexity (another server process)
- Port conflicts possible
- No advantage over direct process management
- Tauri's shell API is sufficient

#### C.2 Claude API Direct Integration

**Description**: Call Anthropic's API directly instead of using CLI.

**Why Rejected**:
- Loses Claude Code's tool implementations
- Would need to reimplement file system, bash, etc.
- CLI provides permission delegation built-in
- Session management is handled by CLI

#### C.3 Electron-style Node Process

**Description**: Use Node.js child_process from renderer.

**Why Rejected**:
- Tauri doesn't expose Node.js in renderer
- Would require separate Node sidecar
- Rust process management is more robust
- Shell plugin provides cleaner API
