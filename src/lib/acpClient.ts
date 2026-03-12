/**
 * Claude Code Client for Miku
 *
 * Uses Tauri Rust commands to spawn the `claude` CLI process.
 * Stdout/stderr are streamed back as Tauri events in real-time.
 * Each prompt spawns a new `claude -p` process; multi-turn conversations
 * use `--resume <sessionId>` to continue the same session.
 *
 * Uses the user's existing Claude Code authentication — no API key needed.
 */

import { isTauri } from './tauri';

// ============================================
// Session Update Types for the UI
// ============================================

export type AcpSessionUpdateType =
  | 'agent_message_chunk'
  | 'agent_thought_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'current_mode_update'
  | 'session_info_update'
  | 'plan'
  | 'usage_update';

export interface AcpToolCallInfo {
  toolCallId: string;
  title: string;
  kind?: string;
  status?: 'in_progress' | 'completed' | 'failed';
  rawInput?: unknown;
  rawOutput?: unknown;
  content?: unknown[];
}

export interface AcpSessionUpdate {
  type: AcpSessionUpdateType;
  text?: string;
  toolCall?: AcpToolCallInfo;
  currentModeId?: string;
  title?: string;
}

export interface AcpPermissionRequest {
  sessionId: string;
  toolCall: AcpToolCallInfo;
  options: Array<{ optionId: string; name: string; kind: string }>;
}

// ============================================
// Claude Client (Tauri Rust backend)
// ============================================

export type PermissionMode = 'auto-approve' | 'allowed-tools';

export class AcpClient {
  private cwd: string = '';
  private sessionId: string | null = null;
  private currentPromptId: string | null = null;
  private _isConnected = false;
  private stderrBuffer: string[] = [];
  private eventUnlisteners: Array<() => void> = [];

  // Permission settings
  permissionMode: PermissionMode = 'auto-approve';
  allowedTools: string[] = [];

  // Streaming state (shared across event handlers)
  private toolCallMap = new Map<string, AcpToolCallInfo>();
  private toolInputBuffers = new Map<number, { id: string; name: string; partialJson: string }>();

  // Callbacks for UI
  onSessionUpdate: ((update: AcpSessionUpdate) => void) | null = null;
  onPermissionRequest: ((req: AcpPermissionRequest) => Promise<{ optionId: string } | 'cancelled'>) | null = null;
  onError: ((error: string) => void) | null = null;
  onStderr: ((text: string) => void) | null = null;
  onLog: ((msg: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  // Session state
  availableModes: Array<{ id: string; name: string }> = [];
  currentModeId: string | null = null;
  agentInfo: { name: string; version?: string } | null = null;

  /**
   * Connect to Claude Code by verifying the CLI is accessible via Rust backend.
   */
  async connect(cwd: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Requires Tauri desktop app to connect to Claude Code');
    }

    this.cwd = cwd;
    this.stderrBuffer = [];

    const { invoke } = await import('@tauri-apps/api/core');

    this.log('Checking claude version via Rust backend...');

    try {
      const version = await invoke<string>('claude_version');
      this.log(`Claude version: ${version}`);
      this.stderrBuffer.push(`Claude version: ${version}\n`);
      this.onStderr?.(`Claude version: ${version}\n`);
      this.agentInfo = { name: 'Claude Code', version };
    } catch (err) {
      throw new Error(
        `Could not find Claude Code.\n\n${err instanceof Error ? err.message : String(err)}\n\n` +
        'Make sure Claude Code is installed and in your PATH.\n' +
        'You can verify by running "claude --version" in your terminal.'
      );
    }

    this._isConnected = true;
  }

  /**
   * Send a prompt to Claude Code with real-time streaming via Tauri events.
   */
  async prompt(text: string): Promise<{ resultText: string }> {
    if (!this._isConnected) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    const promptId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.currentPromptId = promptId;

    // Reset streaming state
    this.toolCallMap.clear();
    this.toolInputBuffers.clear();

    this.log(`Starting prompt (id=${promptId}, session=${this.sessionId || 'new'})`);

    return new Promise<{ resultText: string }>(async (resolve, reject) => {
      let resultText = '';
      let rejected = false;

      // Listen for stdout lines (each line is a stream-json event)
      const unlistenStdout = await listen<{ id: string; line: string }>('claude:stdout', (event) => {
        if (event.payload.id !== promptId) return;

        const line = event.payload.line.trim();
        if (!line) return;

        try {
          const parsed = JSON.parse(line);
          this.handleStreamEvent(parsed);

          // Extract session ID
          if (parsed.type === 'system' && parsed.subtype === 'init' && parsed.session_id) {
            this.sessionId = parsed.session_id;
            this.log(`Session ID: ${this.sessionId}`);
          }

          // Collect result text
          if (parsed.type === 'result' && parsed.result) {
            resultText = parsed.result;
          }
        } catch {
          this.log(`Failed to parse: ${line.slice(0, 200)}`);
        }
      });

      // Listen for stderr
      const unlistenStderr = await listen<{ id: string; text: string }>('claude:stderr', (event) => {
        if (event.payload.id !== promptId) return;
        this.stderrBuffer.push(event.payload.text);
        this.onStderr?.(event.payload.text);
      });

      // Listen for process exit
      const unlistenExit = await listen<{ id: string; code: number | null }>('claude:exit', (event) => {
        if (event.payload.id !== promptId) return;

        // Cleanup listeners
        unlistenStdout();
        unlistenStderr();
        unlistenExit();
        this.currentPromptId = null;

        if (rejected) return;

        const code = event.payload.code;
        if (code === 0 || resultText) {
          this.log(`Prompt complete (session=${this.sessionId})`);
          resolve({ resultText });
        } else {
          const stderr = this.stderrBuffer.slice(-5).join('').trim();
          reject(new Error(stderr || `Claude exited with code ${code}`));
        }
      });

      // Start the process via Rust
      try {
        await invoke('claude_prompt', {
          id: promptId,
          prompt: text,
          cwd: this.cwd,
          sessionId: this.sessionId,
          skipPermissions: this.permissionMode === 'auto-approve',
          allowedTools: this.permissionMode === 'allowed-tools' ? this.allowedTools : undefined,
        });
      } catch (err) {
        unlistenStdout();
        unlistenStderr();
        unlistenExit();
        this.currentPromptId = null;
        rejected = true;
        reject(new Error(`Failed to start Claude: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  /**
   * Handle a single stream-json event from Claude CLI output.
   */
  private handleStreamEvent(event: Record<string, unknown>): void {
    if (event.type === 'system') {
      return;
    }

    if (event.type === 'stream_event') {
      const se = event.event as Record<string, unknown> | undefined;
      if (!se) return;

      // Text streaming
      if (se.type === 'content_block_delta' && se.delta) {
        const delta = se.delta as Record<string, unknown>;
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          this.onSessionUpdate?.({
            type: 'agent_message_chunk',
            text: delta.text,
          });
        } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
          this.onSessionUpdate?.({
            type: 'agent_thought_chunk',
            text: delta.thinking,
          });
        } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          const idx = (se.index as number) ?? 0;
          const buf = this.toolInputBuffers.get(idx);
          if (buf) {
            buf.partialJson += delta.partial_json;
          }
        }
      }

      // Tool use start
      if (se.type === 'content_block_start' && se.content_block) {
        const cb = se.content_block as Record<string, unknown>;
        if (cb.type === 'tool_use' && cb.id) {
          const idx = (se.index as number) ?? 0;
          this.toolInputBuffers.set(idx, {
            id: cb.id as string,
            name: (cb.name as string) || 'Tool',
            partialJson: '',
          });

          const tc: AcpToolCallInfo = {
            toolCallId: cb.id as string,
            title: (cb.name as string) || 'Tool',
            status: 'in_progress',
          };
          this.toolCallMap.set(tc.toolCallId, tc);

          this.onSessionUpdate?.({
            type: 'tool_call',
            toolCall: tc,
          });
        }
      }

      // Content block end — finalize tool input
      if (se.type === 'content_block_stop') {
        const idx = (se.index as number) ?? 0;
        const buf = this.toolInputBuffers.get(idx);
        if (buf) {
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(buf.partialJson);
          } catch {
            parsedInput = buf.partialJson || undefined;
          }

          const existing = this.toolCallMap.get(buf.id);
          if (existing) {
            existing.rawInput = parsedInput;
            this.onSessionUpdate?.({
              type: 'tool_call_update',
              toolCall: { ...existing },
            });
          }
          this.toolInputBuffers.delete(idx);
        }
      }

      return;
    }

    if (event.type === 'assistant') {
      const msg = (event as { message?: { content?: Array<Record<string, unknown>> } }).message;
      if (!msg?.content) return;

      for (const block of msg.content) {
        if (block.type === 'tool_use' && block.id) {
          const existing = this.toolCallMap.get(block.id as string);
          if (existing) {
            existing.rawInput = block.input;
            this.onSessionUpdate?.({
              type: 'tool_call_update',
              toolCall: { ...existing },
            });
          } else {
            const tc: AcpToolCallInfo = {
              toolCallId: block.id as string,
              title: (block.name as string) || 'Tool',
              status: 'in_progress',
              rawInput: block.input,
            };
            this.toolCallMap.set(tc.toolCallId, tc);
            this.onSessionUpdate?.({
              type: 'tool_call',
              toolCall: tc,
            });
          }
        }
      }
      return;
    }

    if (event.type === 'user') {
      const msg = (event as { message?: { content?: Array<Record<string, unknown>> } }).message;
      if (!msg?.content) return;

      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const existing = this.toolCallMap.get(block.tool_use_id as string);
          if (existing) {
            existing.status = 'completed';
            existing.rawOutput = block.content;
            this.onSessionUpdate?.({
              type: 'tool_call_update',
              toolCall: { ...existing },
            });
          }
        }
      }
      return;
    }
  }

  /**
   * Cancel the current prompt by killing the process
   */
  async cancel(): Promise<void> {
    if (!this.currentPromptId) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('claude_cancel', { id: this.currentPromptId });
    } catch {
      // Process may already be dead
    }
    this.currentPromptId = null;
  }

  /**
   * Not used in stream-json mode
   */
  async setMode(_modeId: string): Promise<void> {
    // Modes not supported in stream-json mode
  }

  /**
   * Disconnect and clean up
   */
  async disconnect(): Promise<void> {
    this._isConnected = false;
    await this.cancel();
    this.sessionId = null;
    for (const unlisten of this.eventUnlisteners) {
      unlisten();
    }
    this.eventUnlisteners = [];
  }

  get connected(): boolean {
    return this._isConnected;
  }

  get session(): string | null {
    return this.sessionId;
  }

  get stderr(): string {
    return this.stderrBuffer.join('');
  }

  // ============================================
  // Helpers
  // ============================================

  private log(msg: string): void {
    console.log(`[ClaudeClient] ${msg}`);
    this.onLog?.(msg);
  }
}
