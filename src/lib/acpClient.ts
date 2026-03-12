/**
 * Claude Code Client for Miku
 *
 * Spawns the `claude` CLI in print mode with streaming JSON output.
 * Each prompt spawns a new `claude -p` process; multi-turn conversations
 * use `--resume <sessionId>` to continue the same session.
 *
 * Uses the user's existing Claude Code authentication — no API key needed.
 *
 * Requires Tauri with shell plugin permissions for spawning `claude`.
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
// Stream JSON Event Types (from claude CLI)
// ============================================

interface StreamEvent {
  type: string;
  subtype?: string;
  // system events
  session_id?: string;
  tools?: unknown[];
  message?: string;
  // stream_event
  event?: {
    type: string;
    index?: number;
    delta?: Record<string, unknown>;
    content_block?: Record<string, unknown>;
  };
  // result event
  result?: string;
  cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
  num_turns?: number;
}

interface StreamMessageEvent {
  type: 'assistant' | 'user';
  message: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
      tool_use_id?: string;
      content?: unknown;
    }>;
  };
}

const CONNECT_TIMEOUT_MS = 10_000;
const PROMPT_FIRST_OUTPUT_TIMEOUT_MS = 30_000; // max time to wait for first stdout

// ============================================
// Claude Client
// ============================================

export class AcpClient {
  private cwd: string = '';
  private sessionId: string | null = null;
  private scopeName: string | null = null;
  private currentProcess: { kill: () => Promise<void> } | null = null;
  private _isConnected = false;
  private stderrBuffer: string[] = [];

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
   * Connect to Claude Code by verifying the CLI is accessible.
   * Unlike ACP mode, we don't maintain a persistent process.
   * Each prompt spawns a new `claude -p` process.
   */
  async connect(cwd: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('Requires Tauri desktop app to connect to Claude Code');
    }

    this.cwd = cwd;
    this.stderrBuffer = [];

    const { Command } = await import('@tauri-apps/plugin-shell');

    // Verify claude is accessible
    this.scopeName = await this.findClaudeCommand(Command);
    this.log(`Using scope "${this.scopeName}" to spawn claude`);

    this._isConnected = true;
  }

  /**
   * Try both 'claude' and 'claude-cmd' scope names.
   * On Windows, npm global installs create .cmd wrappers.
   */
  private async findClaudeCommand(
    Command: Awaited<typeof import('@tauri-apps/plugin-shell')>['Command']
  ): Promise<string> {
    const scopes = ['claude', 'claude-cmd'];

    for (const scope of scopes) {
      try {
        this.log(`Trying "${scope}" scope with --version...`);

        const result = await this.withTimeout(
          () => Command.create(scope, ['--version']).execute(),
          CONNECT_TIMEOUT_MS,
          `"${scope}" --version timed out`,
        );

        const version = result.stdout.trim() || result.stderr.trim();
        this.log(`"${scope}" responded: ${version} (code ${result.code})`);

        if (result.code === 0 || version) {
          this.stderrBuffer.push(`Claude version: ${version}\n`);
          this.onStderr?.(`Claude version: ${version}\n`);
          this.agentInfo = { name: 'Claude Code', version };
          return scope;
        }
      } catch (err) {
        this.log(`"${scope}" failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new Error(
      'Could not find Claude Code.\n\n' +
      'Tried: claude, claude.cmd\n\n' +
      'Make sure Claude Code is installed and in your PATH.\n' +
      'You can verify by running "claude --version" in your terminal.'
    );
  }

  /**
   * Send a prompt to Claude Code.
   * Spawns a new `claude -p` process with streaming JSON output.
   * Multi-turn conversations use --resume with the session ID.
   */
  async prompt(text: string): Promise<{ resultText: string }> {
    if (!this._isConnected || !this.scopeName) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { Command } = await import('@tauri-apps/plugin-shell');

    // Build args — flags BEFORE -p to avoid them being consumed as prompt text
    const args = ['--output-format', 'stream-json'];
    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }
    args.push('-p', text);

    this.log(`Spawning claude prompt (session=${this.sessionId || 'new'}, args=${JSON.stringify(args)})`);

    // Quick diagnostic: run a simple execute() to check if claude -p works at all
    // This helps distinguish "process hangs" from "spawn events not firing"
    if (!this.sessionId) {
      try {
        this.log('Running diagnostic: claude -p "hi" --output-format json (via execute)...');
        const diagResult = await this.withTimeout(
          () => Command.create(this.scopeName!, ['--output-format', 'json', '-p', 'hi'], { cwd: this.cwd }).execute(),
          15_000,
          'Diagnostic timed out after 15s',
        );
        this.log(`Diagnostic result: code=${diagResult.code}, stdout=${diagResult.stdout.length} chars, stderr=${diagResult.stderr.slice(0, 200)}`);
        if (diagResult.stdout) {
          this.log(`Diagnostic stdout preview: ${diagResult.stdout.slice(0, 300)}`);
        }
        // Extract session ID from diagnostic if available
        if (diagResult.stdout) {
          try {
            const parsed = JSON.parse(diagResult.stdout);
            if (parsed.session_id) {
              this.sessionId = parsed.session_id;
              this.log(`Got session from diagnostic: ${this.sessionId}`);
            }
          } catch { /* not json or no session */ }
        }
      } catch (err) {
        this.log(`Diagnostic failed: ${err instanceof Error ? err.message : String(err)}`);
        // Don't fail — continue to the actual prompt attempt
      }
    }

    return new Promise<{ resultText: string }>((resolve, reject) => {
      let resultText = '';
      let lineBuffer = '';
      const toolCallMap = new Map<string, AcpToolCallInfo>();
      const toolInputBuffers = new Map<number, { id: string; name: string; partialJson: string }>();
      let rejected = false;
      let gotStdout = false;
      let firstOutputTimer: ReturnType<typeof setTimeout> | null = null;

      const command = Command.create(this.scopeName!, args, {
        cwd: this.cwd,
      });

      command.stdout.on('data', (data: string) => {
        if (!gotStdout) {
          gotStdout = true;
          if (firstOutputTimer) clearTimeout(firstOutputTimer);
          this.log(`First stdout chunk (${data.length} chars)`);
        }
        lineBuffer += data;

        // Split on newlines — each line is a JSON event
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);
            this.handleStreamEvent(event, toolCallMap, toolInputBuffers);

            // Extract session ID from init
            if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
              this.sessionId = event.session_id;
              this.log(`Session ID: ${this.sessionId}`);
            }

            // Collect result text
            if (event.type === 'result' && event.result) {
              resultText = event.result;
            }
          } catch {
            this.log(`Failed to parse stream event: ${trimmed.slice(0, 200)}`);
          }
        }
      });

      command.stderr.on('data', (data: string) => {
        this.stderrBuffer.push(data);
        this.onStderr?.(data);
      });

      command.on('close', (data: { code: number | null }) => {
        if (firstOutputTimer) clearTimeout(firstOutputTimer);
        // Process remaining buffer
        if (lineBuffer.trim()) {
          try {
            const event = JSON.parse(lineBuffer.trim());
            this.handleStreamEvent(event, toolCallMap, toolInputBuffers);
            if (event.type === 'result' && event.result) {
              resultText = event.result;
            }
          } catch { /* ignore */ }
        }

        this.currentProcess = null;

        if (!rejected) {
          if (data.code === 0 || resultText) {
            resolve({ resultText });
          } else {
            const stderr = this.stderrBuffer.slice(-5).join('').trim();
            reject(new Error(stderr || `Claude exited with code ${data.code}`));
          }
        }
      });

      command.on('error', (error: string) => {
        this.log(`Process error: ${error}`);
        this.currentProcess = null;
        rejected = true;
        reject(new Error(`Failed to run Claude: ${error}`));
      });

      // Timeout if we never get any stdout (process might be stuck)
      firstOutputTimer = setTimeout(() => {
        if (!gotStdout && !rejected) {
          const stderr = this.stderrBuffer.slice(-10).join('').trim();
          this.log(`Timeout: no stdout after ${PROMPT_FIRST_OUTPUT_TIMEOUT_MS / 1000}s`);
          rejected = true;
          if (this.currentProcess) {
            this.currentProcess.kill().catch(() => {});
            this.currentProcess = null;
          }
          reject(new Error(
            `Claude process produced no output after ${PROMPT_FIRST_OUTPUT_TIMEOUT_MS / 1000}s.\n` +
            (stderr ? `stderr:\n${stderr}\n\n` : '') +
            'This may indicate:\n' +
            '- Claude Code needs authentication (run "claude" in your terminal first)\n' +
            '- The working directory is inaccessible\n' +
            '- Claude Code is stuck on an interactive prompt'
          ));
        }
      }, PROMPT_FIRST_OUTPUT_TIMEOUT_MS);

      command.spawn().then((child: { kill: () => Promise<void> }) => {
        this.currentProcess = child;
      }).catch((err: Error) => {
        if (firstOutputTimer) clearTimeout(firstOutputTimer);
        rejected = true;
        reject(new Error(`Could not start Claude Code.\n${err.message}`));
      });
    });
  }

  /**
   * Handle a single stream-json event from Claude CLI output.
   */
  private handleStreamEvent(
    event: StreamEvent | StreamMessageEvent,
    toolCallMap: Map<string, AcpToolCallInfo>,
    toolInputBuffers: Map<number, { id: string; name: string; partialJson: string }>,
  ): void {
    if (event.type === 'system') {
      // system init/success/error — logged elsewhere
      return;
    }

    if (event.type === 'stream_event') {
      const se = (event as StreamEvent).event;
      if (!se) return;

      // Text streaming
      if (se.type === 'content_block_delta' && se.delta) {
        if (se.delta.type === 'text_delta' && typeof se.delta.text === 'string') {
          this.onSessionUpdate?.({
            type: 'agent_message_chunk',
            text: se.delta.text as string,
          });
        } else if (se.delta.type === 'thinking_delta' && typeof se.delta.thinking === 'string') {
          this.onSessionUpdate?.({
            type: 'agent_thought_chunk',
            text: se.delta.thinking as string,
          });
        } else if (se.delta.type === 'input_json_delta' && typeof se.delta.partial_json === 'string') {
          const idx = se.index ?? 0;
          const buf = toolInputBuffers.get(idx);
          if (buf) {
            buf.partialJson += se.delta.partial_json;
          }
        }
      }

      // Tool use start
      if (se.type === 'content_block_start' && se.content_block) {
        if (se.content_block.type === 'tool_use' && se.content_block.id) {
          const idx = se.index ?? 0;
          toolInputBuffers.set(idx, {
            id: se.content_block.id as string,
            name: (se.content_block.name as string) || 'Tool',
            partialJson: '',
          });

          const tc: AcpToolCallInfo = {
            toolCallId: se.content_block.id as string,
            title: (se.content_block.name as string) || 'Tool',
            status: 'in_progress',
          };
          toolCallMap.set(tc.toolCallId, tc);

          this.onSessionUpdate?.({
            type: 'tool_call',
            toolCall: tc,
          });
        }
      }

      // Content block end — finalize tool input
      if (se.type === 'content_block_stop') {
        const idx = se.index ?? 0;
        const buf = toolInputBuffers.get(idx);
        if (buf) {
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(buf.partialJson);
          } catch {
            parsedInput = buf.partialJson || undefined;
          }

          const existing = toolCallMap.get(buf.id);
          if (existing) {
            existing.rawInput = parsedInput;
            this.onSessionUpdate?.({
              type: 'tool_call_update',
              toolCall: { ...existing },
            });
          }
          toolInputBuffers.delete(idx);
        }
      }

      return;
    }

    if (event.type === 'assistant') {
      const msg = (event as StreamMessageEvent).message;
      if (!msg?.content) return;

      for (const block of msg.content) {
        if (block.type === 'tool_use' && block.id) {
          const existing = toolCallMap.get(block.id);
          if (existing) {
            existing.rawInput = block.input;
            this.onSessionUpdate?.({
              type: 'tool_call_update',
              toolCall: { ...existing },
            });
          } else {
            // Tool call we haven't seen from streaming
            const tc: AcpToolCallInfo = {
              toolCallId: block.id,
              title: block.name || 'Tool',
              status: 'in_progress',
              rawInput: block.input,
            };
            toolCallMap.set(tc.toolCallId, tc);
            this.onSessionUpdate?.({
              type: 'tool_call',
              toolCall: tc,
            });
          }
        }

        // If assistant has text content and we didn't stream it
        if (block.type === 'text' && block.text) {
          // Only emit if this text wasn't already streamed
          // The stream_event deltas should have already sent this,
          // so we skip to avoid duplication
        }
      }
      return;
    }

    if (event.type === 'user') {
      const msg = (event as StreamMessageEvent).message;
      if (!msg?.content) return;

      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const existing = toolCallMap.get(block.tool_use_id);
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

    // 'result' type is handled in the prompt() method
  }

  /**
   * Cancel the current prompt by killing the process
   */
  async cancel(): Promise<void> {
    if (this.currentProcess) {
      try {
        await this.currentProcess.kill();
      } catch { /* already dead */ }
      this.currentProcess = null;
    }
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

  private withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
