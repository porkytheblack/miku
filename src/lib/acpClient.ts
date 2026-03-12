/**
 * ACP Client for connecting to Claude Code
 *
 * Spawns the `claude` CLI process and communicates with it via the
 * Agent Client Protocol (ACP) over stdio. This is the same protocol
 * that VS Code uses to integrate with Claude Code.
 *
 * Requires Tauri with shell plugin permissions for spawning `claude`.
 */

import * as acp from '@agentclientprotocol/sdk';
import { isTauri } from './tauri';

// ============================================
// ACP Session Update Types for the UI
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
  kind?: acp.ToolKind;
  status?: acp.ToolCallStatus;
  rawInput?: unknown;
  rawOutput?: unknown;
  content?: acp.ToolCallContent[];
}

export interface AcpSessionUpdate {
  type: AcpSessionUpdateType;
  // For message chunks
  text?: string;
  // For tool calls
  toolCall?: AcpToolCallInfo;
  // For mode updates
  currentModeId?: string;
  // For session info
  title?: string;
}

export interface AcpPermissionRequest {
  sessionId: string;
  toolCall: AcpToolCallInfo;
  options: acp.PermissionOption[];
}

const CONNECT_TIMEOUT_MS = 15_000;

// ============================================
// ACP Client
// ============================================

export class AcpClient {
  private connection: acp.ClientSideConnection | null = null;
  private sessionId: string | null = null;
  private childProcess: { write: (data: string | Uint8Array) => Promise<void>; kill: () => Promise<void> } | null = null;
  private isConnected = false;
  private stderrBuffer: string[] = [];

  // Callbacks for UI
  onSessionUpdate: ((update: AcpSessionUpdate) => void) | null = null;
  onPermissionRequest: ((req: AcpPermissionRequest) => Promise<{ optionId: string } | 'cancelled'>) | null = null;
  onError: ((error: string) => void) | null = null;
  onStderr: ((text: string) => void) | null = null;
  onLog: ((msg: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  // Session state
  availableModes: acp.SessionMode[] = [];
  currentModeId: string | null = null;
  agentInfo: acp.Implementation | null = null;

  /**
   * Connect to Claude Code by spawning the `claude` CLI process.
   * Uses Tauri's shell plugin to spawn the process and bridges
   * stdio to the ACP SDK's stream interface.
   */
  async connect(cwd: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('ACP client requires Tauri desktop app to spawn Claude Code');
    }

    const { Command } = await import('@tauri-apps/plugin-shell');
    this.stderrBuffer = [];

    // Step 1: Verify claude is accessible by running --version
    const scopeName = await this.findClaudeCommand(Command);
    this.log(`Using scope "${scopeName}" to spawn claude`);

    // Step 2: Spawn claude with ACP mode
    let earlyExitReject: ((err: Error) => void) | null = null;

    const command = Command.create(scopeName, ['--ide'], {
      cwd,
      encoding: 'raw',
    });

    // Create Web Streams bridging Tauri events
    let readableController: ReadableStreamDefaultController<Uint8Array>;
    let gotStdout = false;

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    command.stdout.on('data', (data: Uint8Array) => {
      if (!gotStdout) {
        gotStdout = true;
        const preview = new TextDecoder().decode(data.slice(0, 200));
        this.log(`First stdout chunk (${data.byteLength} bytes): ${preview}`);
      }
      readableController.enqueue(data);
    });

    command.stderr.on('data', (data: Uint8Array) => {
      const text = new TextDecoder().decode(data);
      this.log(`stderr: ${text}`);
      this.stderrBuffer.push(text);
      this.onStderr?.(text);
    });

    command.on('close', (data) => {
      try { readableController.close(); } catch { /* already closed */ }

      if (!this.isConnected) {
        const stderr = this.stderrBuffer.join('').trim();
        const msg = stderr
          ? `Claude Code exited (code ${data.code}): ${stderr}`
          : `Claude Code exited with code ${data.code}. Is Claude Code installed and logged in?`;
        this.log(msg);
        earlyExitReject?.(new Error(msg));
      } else {
        this.isConnected = false;
        this.onDisconnect?.();
      }
    });

    command.on('error', (error: string) => {
      this.log(`Process error: ${error}`);
      if (!this.isConnected) {
        earlyExitReject?.(new Error(`Failed to spawn Claude Code: ${error}`));
      } else {
        this.onError?.(error);
      }
      try { readableController.close(); } catch { /* already closed */ }
    });

    let child;
    try {
      child = await command.spawn();
      this.log('Process spawned successfully');
    } catch (err) {
      const stderr = this.stderrBuffer.join('').trim();
      throw new Error(
        `Could not start Claude Code.\n${stderr || (err instanceof Error ? err.message : String(err))}`
      );
    }
    this.childProcess = child;

    const writable = new WritableStream<Uint8Array>({
      async write(chunk) {
        await child.write(chunk);
      },
    });

    const stream = acp.ndJsonStream(writable, readable);

    this.connection = new acp.ClientSideConnection(
      (_agent) => this.createClientHandler(),
      stream,
    );

    this.connection.signal.addEventListener('abort', () => {
      this.isConnected = false;
      this.onDisconnect?.();
    });

    // Step 3: Initialize ACP connection
    this.log('Sending ACP initialize request...');
    const initResult = await this.withTimeout(
      (reject) => {
        earlyExitReject = reject;
        return this.connection!.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientInfo: {
            name: 'Miku',
            version: '0.0.9',
          },
          clientCapabilities: {
            fs: {
              readTextFile: true,
              writeTextFile: true,
            },
            terminal: true,
          },
        });
      },
      CONNECT_TIMEOUT_MS,
      `Claude Code did not respond to ACP initialization within ${CONNECT_TIMEOUT_MS / 1000}s.\n\n` +
      'Possible causes:\n' +
      '- The `--ide` flag may not be supported by your Claude Code version\n' +
      '- Claude Code may be starting but not in ACP mode\n' +
      `- Process received stdout: ${gotStdout ? 'yes' : 'no'}`,
    );

    this.log(`Initialize response received: agent=${initResult.agentInfo?.name}`);
    this.agentInfo = initResult.agentInfo ?? null;
    this.isConnected = true;

    // Step 4: Create a session
    this.log('Creating ACP session...');
    const sessionResult = await this.withTimeout(
      (reject) => {
        earlyExitReject = reject;
        return this.connection!.newSession({
          cwd,
          mcpServers: [],
        });
      },
      CONNECT_TIMEOUT_MS,
      'Claude Code did not respond to session creation.',
    );

    this.sessionId = sessionResult.sessionId;
    this.log(`Session created: ${this.sessionId}`);

    if (sessionResult.modes) {
      this.availableModes = sessionResult.modes.availableModes ?? [];
      this.currentModeId = sessionResult.modes.currentModeId ?? null;
    }

    earlyExitReject = null;
  }

  /**
   * Try both 'claude' and 'claude-cmd' scope names to find one that works.
   * On Windows, npm global installs create .cmd wrappers.
   */
  private async findClaudeCommand(Command: Awaited<typeof import('@tauri-apps/plugin-shell')>['Command']): Promise<string> {
    const scopes = ['claude', 'claude-cmd'];

    for (const scope of scopes) {
      try {
        this.log(`Trying "${scope}" scope with --version...`);
        const result = await Command.create(scope, ['--version']).execute();
        const version = result.stdout.trim() || result.stderr.trim();
        this.log(`"${scope}" responded: ${version} (code ${result.code})`);

        if (result.code === 0 || version) {
          this.stderrBuffer.push(`Claude version: ${version}\n`);
          this.onStderr?.(`Claude version: ${version}\n`);
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
   * Send a prompt to the agent and receive the response.
   * Session updates come through the onSessionUpdate callback.
   */
  async prompt(text: string): Promise<acp.PromptResponse> {
    if (!this.connection || !this.sessionId) {
      throw new Error('Not connected. Call connect() first.');
    }

    return this.connection.prompt({
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  /**
   * Cancel the current prompt
   */
  async cancel(): Promise<void> {
    if (!this.connection || !this.sessionId) return;

    await this.connection.cancel({
      sessionId: this.sessionId,
    });
  }

  /**
   * Switch the agent's mode
   */
  async setMode(modeId: string): Promise<void> {
    if (!this.connection || !this.sessionId) return;

    await this.connection.setSessionMode({
      sessionId: this.sessionId,
      modeId,
    });
  }

  /**
   * Disconnect and kill the claude process
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.childProcess) {
      try {
        await this.childProcess.kill();
      } catch {
        // Process may already be dead
      }
      this.childProcess = null;
    }
    this.connection = null;
    this.sessionId = null;
  }

  get connected(): boolean {
    return this.isConnected;
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
    console.log(`[AcpClient] ${msg}`);
    this.onLog?.(msg);
  }

  /**
   * Race a promise against a timeout and an optional early-reject callback.
   * The `fn` receives a `reject` function that can be called externally
   * (e.g. from the close handler) to abort early.
   */
  private withTimeout<T>(
    fn: (reject: (err: Error) => void) => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const stderr = this.stderrBuffer.join('').trim();
        reject(new Error(
          stderr ? `${timeoutMessage}\n\nstderr: ${stderr}` : timeoutMessage
        ));
      }, timeoutMs);

      fn(reject)
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

  // ============================================
  // Client Handler Implementation
  // ============================================

  private createClientHandler(): acp.Client {
    return {
      sessionUpdate: async (params) => {
        this.handleSessionUpdate(params);
      },

      requestPermission: async (params) => {
        return this.handlePermissionRequest(params);
      },

      readTextFile: async (params) => {
        // Delegate file reading to Tauri's fs plugin
        try {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const content = await readTextFile(params.path);
          return { content };
        } catch (err) {
          throw new Error(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },

      writeTextFile: async (params) => {
        // Delegate file writing to Tauri's fs plugin
        try {
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          await writeTextFile(params.path, params.content);
          return {};
        } catch (err) {
          throw new Error(`Failed to write file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
    };
  }

  private handleSessionUpdate(params: acp.SessionNotification): void {
    const { update } = params;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.onSessionUpdate?.({
          type: 'agent_message_chunk',
          text: extractText(update.content),
        });
        break;

      case 'agent_thought_chunk':
        this.onSessionUpdate?.({
          type: 'agent_thought_chunk',
          text: extractText(update.content),
        });
        break;

      case 'tool_call':
        this.onSessionUpdate?.({
          type: 'tool_call',
          toolCall: {
            toolCallId: update.toolCallId,
            title: update.title,
            kind: update.kind,
            status: update.status,
            rawInput: update.rawInput,
            rawOutput: update.rawOutput,
            content: update.content,
          },
        });
        break;

      case 'tool_call_update':
        this.onSessionUpdate?.({
          type: 'tool_call_update',
          toolCall: {
            toolCallId: update.toolCallId,
            title: update.title ?? '',
            kind: update.kind ?? undefined,
            status: update.status ?? undefined,
            rawInput: update.rawInput,
            rawOutput: update.rawOutput,
            content: update.content ?? undefined,
          },
        });
        break;

      case 'current_mode_update':
        this.currentModeId = update.currentModeId;
        this.onSessionUpdate?.({
          type: 'current_mode_update',
          currentModeId: update.currentModeId,
        });
        break;

      case 'session_info_update':
        this.onSessionUpdate?.({
          type: 'session_info_update',
          title: update.title ?? undefined,
        });
        break;

      case 'plan':
        this.onSessionUpdate?.({ type: 'plan' });
        break;

      case 'usage_update':
        this.onSessionUpdate?.({ type: 'usage_update' });
        break;

      default:
        // Unknown update type - ignore
        break;
    }
  }

  private async handlePermissionRequest(
    params: acp.RequestPermissionRequest
  ): Promise<acp.RequestPermissionResponse> {
    if (!this.onPermissionRequest) {
      // Auto-allow if no handler
      const firstAllow = params.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always');
      return {
        outcome: firstAllow
          ? { outcome: 'selected', optionId: firstAllow.optionId }
          : { outcome: 'cancelled' },
      };
    }

    const result = await this.onPermissionRequest({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: params.toolCall.toolCallId,
        title: params.toolCall.title ?? 'Permission request',
        kind: params.toolCall.kind ?? undefined,
        status: params.toolCall.status ?? undefined,
        rawInput: params.toolCall.rawInput,
        rawOutput: params.toolCall.rawOutput,
        content: params.toolCall.content ?? undefined,
      },
      options: params.options,
    });

    if (result === 'cancelled') {
      return { outcome: { outcome: 'cancelled' } };
    }

    return { outcome: { outcome: 'selected', optionId: result.optionId } };
  }
}

// ============================================
// Utilities
// ============================================

function extractText(content: acp.ContentBlock): string {
  if (content.type === 'text') {
    return (content as acp.TextContent & { type: 'text' }).text;
  }
  return '';
}
