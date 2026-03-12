/**
 * Claude Code CLI Bridge
 *
 * Manages communication between Miku and the Claude Code CLI via Tauri commands.
 * Handles spawning processes, parsing NDJSON events, and permission delegation.
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  ClaudeEvent,
  ClaudeMessageEvent,
  ClaudePermissionRequestEvent,
  ClaudeInitEvent,
  ClaudeResultEvent,
  ClaudeErrorEvent,
  isInitEvent,
  isMessageEvent,
  isPermissionRequestEvent,
  isResultEvent,
  isErrorEvent,
  createPermissionResponse,
  TauriStdoutEvent,
  TauriExitEvent,
  TauriErrorEvent,
  SpawnClaudeOptions,
  ClaudeProcessInfo,
  ClaudeTextBlock,
  ClaudeThinkingBlock,
} from './claude-events';
import {
  AgentApprovalRequest,
  AgentApprovalType,
  generateAgentId,
} from '@/types/agent';

// ============================================
// Event Handler Types
// ============================================

export interface ClaudeBridgeHandlers {
  /** Called when session is initialized */
  onInit?: (event: ClaudeInitEvent) => void;
  /** Called when a message chunk is received */
  onMessage?: (event: ClaudeMessageEvent) => void;
  /** Called when a permission request is received */
  onPermissionRequest?: (event: ClaudePermissionRequestEvent) => void;
  /** Called when Claude finishes processing */
  onResult?: (event: ClaudeResultEvent) => void;
  /** Called when the response is complete */
  onCompletion?: () => void;
  /** Called when an error occurs */
  onError?: (event: ClaudeErrorEvent) => void;
  /** Called when the process exits */
  onExit?: (code: number | null) => void;
  /** Called for raw stderr output (for debugging) */
  onStderr?: (line: string) => void;
  /** Called for any event (for logging/debugging) */
  onAnyEvent?: (event: ClaudeEvent) => void;
}

export interface StartOptions {
  workingDirectory: string;
  prompt: string;
  model?: string;
  sessionId?: string;
  systemPrompt?: string;
  maxTokens?: number;
}

// ============================================
// Claude Bridge Class
// ============================================

/**
 * Bridge class for managing Claude Code CLI communication
 */
export class ClaudeBridge {
  private processId: number | null = null;
  private handlers: ClaudeBridgeHandlers = {};
  private unlisteners: UnlistenFn[] = [];
  private sessionId: string | null = null;
  private _isActive = false;

  constructor() {
    // No-arg constructor for flexibility
  }

  /**
   * Set event handlers (can be called before start)
   */
  setHandlers(handlers: ClaudeBridgeHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Start a new Claude session
   */
  async start(options: StartOptions): Promise<void> {
    if (this._isActive) {
      throw new Error('Claude session already running. Stop it first.');
    }

    // Set up event listeners before spawning
    await this.setupListeners();

    try {
      const spawnOptions: SpawnClaudeOptions = {
        prompt: options.prompt,
        working_dir: options.workingDirectory,
        model: options.model || 'sonnet',
        session_id: options.sessionId,
        delegate_permissions: true,
        system_prompt: options.systemPrompt,
      };

      this.processId = await invoke<number>('spawn_claude', { options: spawnOptions });
      this._isActive = true;
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Send a permission response
   */
  async respondToPermission(requestId: string, granted: boolean): Promise<void> {
    if (this.processId === null) {
      throw new Error('No Claude session running');
    }

    const response = createPermissionResponse(requestId, granted);
    await invoke('send_to_claude', {
      processId: this.processId,
      message: JSON.stringify(response),
    });
  }

  /**
   * Stop the current Claude session
   */
  async stop(): Promise<void> {
    if (this.processId !== null) {
      try {
        await invoke('kill_claude', { processId: this.processId });
      } catch {
        // Ignore errors when killing (process might have already exited)
      }
    }
    await this.cleanup();
  }

  /**
   * Check if a session is currently active
   */
  isActive(): boolean {
    return this._isActive;
  }

  /**
   * Alias for isActive (for backward compatibility)
   */
  isRunning(): boolean {
    return this._isActive;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  private async setupListeners(): Promise<void> {
    // Listen for stdout (NDJSON events)
    const stdoutUnlisten = await listen<TauriStdoutEvent>('claude:stdout', (event) => {
      if (event.payload.process_id !== this.processId) return;
      this.handleStdoutLine(event.payload.line);
    });
    this.unlisteners.push(stdoutUnlisten);

    // Listen for stderr
    const stderrUnlisten = await listen<TauriStdoutEvent>('claude:stderr', (event) => {
      if (event.payload.process_id !== this.processId) return;
      this.handlers.onStderr?.(event.payload.line);
    });
    this.unlisteners.push(stderrUnlisten);

    // Listen for exit
    const exitUnlisten = await listen<TauriExitEvent>('claude:exit', (event) => {
      if (event.payload.process_id !== this.processId) return;
      this.handlers.onExit?.(event.payload.code);
      this.cleanup();
    });
    this.unlisteners.push(exitUnlisten);

    // Listen for errors
    const errorUnlisten = await listen<TauriErrorEvent>('claude:error', (event) => {
      if (event.payload.process_id !== this.processId) return;
      this.handlers.onError?.({
        type: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: event.payload.message,
        },
      });
    });
    this.unlisteners.push(errorUnlisten);
  }

  private handleStdoutLine(line: string): void {
    if (!line.trim()) return;

    try {
      const event = JSON.parse(line) as ClaudeEvent;
      this.dispatchEvent(event);
    } catch {
      // Not valid JSON, might be debug output
      console.debug('[ClaudeBridge] Non-JSON stdout:', line);
    }
  }

  private dispatchEvent(event: ClaudeEvent): void {
    // Call generic handler first
    this.handlers.onAnyEvent?.(event);

    if (isInitEvent(event)) {
      this.sessionId = event.session_id;
      this.handlers.onInit?.(event);
    } else if (isMessageEvent(event)) {
      this.handlers.onMessage?.(event);
      // If message is complete (not partial), trigger completion
      if (!event.partial && event.message.stop_reason) {
        this.handlers.onCompletion?.();
      }
    } else if (isPermissionRequestEvent(event)) {
      this.handlers.onPermissionRequest?.(event);
    } else if (isResultEvent(event)) {
      this.handlers.onResult?.(event);
      this.handlers.onCompletion?.();
    } else if (isErrorEvent(event)) {
      this.handlers.onError?.(event);
    }
  }

  private async cleanup(): Promise<void> {
    this.processId = null;
    this._isActive = false;
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
    this.unlisteners = [];
  }
}

// ============================================
// Singleton Instance Management
// ============================================

let bridgeInstance: ClaudeBridge | null = null;

/**
 * Create a new Claude bridge instance (no-arg version for context initialization)
 */
export function createClaudeBridge(): ClaudeBridge {
  if (bridgeInstance) {
    bridgeInstance.stop().catch(console.error);
  }
  bridgeInstance = new ClaudeBridge();
  return bridgeInstance;
}

/**
 * Get the current bridge instance
 */
export function getClaudeBridge(): ClaudeBridge | null {
  return bridgeInstance;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Result of converting a permission request to an approval
 */
export interface ConvertedApproval {
  approval: AgentApprovalRequest;
  requestId: string;
}

/**
 * Convert a Claude permission request to a Miku approval request
 * Returns both the approval and the original Claude request ID for mapping
 */
export function convertPermissionToApproval(
  event: ClaudePermissionRequestEvent
): ConvertedApproval {
  const tool = event.tool;
  const approvalType = toolToApprovalType(tool.name);

  const approval: AgentApprovalRequest = {
    id: generateAgentId('approval'),
    type: approvalType,
    status: 'pending',
    description: event.message,
    details: {
      filePath: tool.file_path,
      diff: tool.diff,
      command: tool.command,
      url: tool.url,
      context: tool.params ? JSON.stringify(tool.params, null, 2) : undefined,
    },
    createdAt: new Date().toISOString(),
    messageId: event.request_id,
  };

  return {
    approval,
    requestId: event.request_id,
  };
}

/**
 * Map Claude tool names to Miku approval types
 */
export function toolToApprovalType(toolName: string): AgentApprovalType {
  const name = toolName.toLowerCase();

  if (name.includes('edit') || name === 'write') {
    return 'file_edit';
  }
  if (name.includes('create') || name === 'write') {
    return 'file_create';
  }
  if (name.includes('delete') || name.includes('remove')) {
    return 'file_delete';
  }
  if (name === 'bash' || name.includes('command') || name.includes('shell')) {
    return 'command';
  }
  if (name.includes('fetch') || name.includes('web') || name.includes('http')) {
    return 'web_fetch';
  }

  return 'other';
}

/**
 * Extract text content from a Claude message
 */
export function extractMessageText(event: ClaudeMessageEvent): string {
  const textBlocks = event.message.content.filter(
    (block): block is ClaudeTextBlock => block.type === 'text'
  );
  return textBlocks.map((block) => block.text).join('\n');
}

/**
 * Extract thinking content from a Claude message
 */
export function extractThinkingText(event: ClaudeMessageEvent): string | null {
  const thinkingBlocks = event.message.content.filter(
    (block): block is ClaudeThinkingBlock => block.type === 'thinking'
  );
  if (thinkingBlocks.length === 0) return null;
  return thinkingBlocks.map((block) => block.thinking).join('\n');
}

/**
 * Check if Claude CLI is available
 */
export async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    await invoke<ClaudeProcessInfo[]>('list_claude_processes');
    return true; // If the command succeeds, CLI is available
  } catch {
    return false;
  }
}

/**
 * List running Claude processes
 */
export async function listClaudeProcesses(): Promise<ClaudeProcessInfo[]> {
  return invoke<ClaudeProcessInfo[]>('list_claude_processes');
}
