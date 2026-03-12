/**
 * Claude Code CLI Event Types
 *
 * Type definitions for events emitted by Claude Code CLI when using
 * `--output-format stream-json` mode.
 *
 * EXPERIMENTAL: These types are based on observed CLI behavior and may
 * change with Claude Code updates.
 */

// ============================================
// Base Event Types
// ============================================

/**
 * Base interface for all Claude CLI events
 */
export interface ClaudeBaseEvent {
  type: string;
  timestamp?: string;
}

// ============================================
// Content Block Types
// ============================================

/**
 * Text content in a message
 */
export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

/**
 * Thinking/reasoning content (for extended thinking models)
 */
export interface ClaudeThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/**
 * Tool use request
 */
export interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result
 */
export interface ClaudeToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Union of all content block types
 */
export type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeThinkingBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;

// ============================================
// Event Types
// ============================================

/**
 * Initialization event sent when Claude starts
 */
export interface ClaudeInitEvent extends ClaudeBaseEvent {
  type: 'init';
  session_id: string;
  model: string;
  cwd: string;
  tools_available?: string[];
}

/**
 * Message event containing assistant response content
 */
export interface ClaudeMessageEvent extends ClaudeBaseEvent {
  type: 'message';
  message: {
    id: string;
    role: 'assistant';
    content: ClaudeContentBlock[];
    model: string;
    stop_reason: string | null;
  };
  /** True if this is a partial update during streaming */
  partial?: boolean;
}

/**
 * Tool information in a permission request
 */
export interface ClaudeToolInfo {
  name: string;
  /** Tool-specific parameters */
  params?: Record<string, unknown>;
  /** For file operations */
  file_path?: string;
  /** For edit operations - the diff or new content */
  diff?: string;
  /** For bash operations */
  command?: string;
  /** For web operations */
  url?: string;
}

/**
 * Permission request event from --permission-mode delegate
 */
export interface ClaudePermissionRequestEvent extends ClaudeBaseEvent {
  type: 'permission_request';
  request_id: string;
  tool: ClaudeToolInfo;
  /** Human-readable description of the action */
  message: string;
}

/**
 * Result event when Claude completes processing
 */
export interface ClaudeResultEvent extends ClaudeBaseEvent {
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
 * Error event when something goes wrong
 */
export interface ClaudeErrorEvent extends ClaudeBaseEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
  };
}

/**
 * System event for status updates
 */
export interface ClaudeSystemEvent extends ClaudeBaseEvent {
  type: 'system';
  message: string;
  level?: 'info' | 'warning' | 'error';
}

/**
 * Union of all Claude event types
 */
export type ClaudeEvent =
  | ClaudeInitEvent
  | ClaudeMessageEvent
  | ClaudePermissionRequestEvent
  | ClaudeResultEvent
  | ClaudeErrorEvent
  | ClaudeSystemEvent;

// ============================================
// Type Guards
// ============================================

export function isInitEvent(event: ClaudeEvent): event is ClaudeInitEvent {
  return event.type === 'init';
}

export function isMessageEvent(event: ClaudeEvent): event is ClaudeMessageEvent {
  return event.type === 'message';
}

export function isPermissionRequestEvent(
  event: ClaudeEvent
): event is ClaudePermissionRequestEvent {
  return event.type === 'permission_request';
}

export function isResultEvent(event: ClaudeEvent): event is ClaudeResultEvent {
  return event.type === 'result';
}

export function isErrorEvent(event: ClaudeEvent): event is ClaudeErrorEvent {
  return event.type === 'error';
}

export function isSystemEvent(event: ClaudeEvent): event is ClaudeSystemEvent {
  return event.type === 'system';
}

// ============================================
// Permission Response Types
// ============================================

/**
 * Permission response to send back to Claude
 */
export interface PermissionResponse {
  type: 'permission_response';
  request_id: string;
  granted: boolean;
}

/**
 * Create a permission response object
 */
export function createPermissionResponse(
  requestId: string,
  granted: boolean
): PermissionResponse {
  return {
    type: 'permission_response',
    request_id: requestId,
    granted,
  };
}

// ============================================
// Tauri Event Payloads
// ============================================

/**
 * Payload for claude:stdout events from Tauri
 */
export interface TauriStdoutEvent {
  process_id: number;
  line: string;
}

/**
 * Payload for claude:stderr events from Tauri
 */
export interface TauriStderrEvent {
  process_id: number;
  line: string;
}

/**
 * Payload for claude:exit events from Tauri
 */
export interface TauriExitEvent {
  process_id: number;
  code: number | null;
}

/**
 * Payload for claude:error events from Tauri
 */
export interface TauriErrorEvent {
  process_id: number;
  message: string;
}

// ============================================
// Session Types
// ============================================

/**
 * Information about a Claude session
 */
export interface ClaudeSessionInfo {
  sessionId: string;
  model: string;
  workingDir: string;
  startedAt: string;
  lastActiveAt: string;
}

/**
 * Options for spawning a Claude process
 */
export interface SpawnClaudeOptions {
  prompt: string;
  working_dir: string;
  model?: string;
  session_id?: string;
  delegate_permissions?: boolean;
  system_prompt?: string;
}

/**
 * Information about a running Claude process
 */
export interface ClaudeProcessInfo {
  process_id: number;
  working_dir: string;
  model: string;
  session_id: string | null;
  is_running: boolean;
}
