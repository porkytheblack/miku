/**
 * Miku ACP Agent Implementation
 *
 * Implements the Agent Client Protocol (ACP) as a Miku-powered AI agent.
 * This agent can be pointed at a folder via .miku config files and provides
 * full ACP support including:
 * - Session management (create, load, list, cancel)
 * - Prompt handling with streaming updates
 * - Tool calls (file read/write, terminal, custom tools)
 * - Permission management
 * - Mode switching
 * - MCP server integration
 */

import * as acp from '@agentclientprotocol/sdk';
import type { MikuFileConfig, MikuFileMode, MikuFileTool } from '../mikuFileParser';
import { AIProviderInterface, Message, ToolDefinition, ProviderResponse } from '../ai/types';
import { OpenAIProvider } from '../ai/providers/openai';
import { AnthropicProvider } from '../ai/providers/anthropic';
import { GoogleProvider } from '../ai/providers/google';
import { OpenRouterProvider } from '../ai/providers/openrouter';
import { OllamaProvider } from '../ai/providers/ollama';
import { LMStudioProvider } from '../ai/providers/lmstudio';

import * as fs from 'node:fs';
import * as path from 'node:path';

interface AgentSession {
  id: string;
  cwd: string;
  currentMode: string;
  messages: Message[];
  pendingPrompt: AbortController | null;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create an AI provider from a .miku config
 */
function createProvider(config: MikuFileConfig): AIProviderInterface {
  const { type, model, apiKeyEnv, baseUrl } = config.provider;

  // Resolve API key from environment variable
  let apiKey = '';
  if (apiKeyEnv) {
    apiKey = process.env[apiKeyEnv] || '';
    if (!apiKey && type !== 'ollama' && type !== 'lmstudio') {
      console.error(`Warning: Environment variable ${apiKeyEnv} is not set`);
    }
  }

  switch (type) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'google':
      return new GoogleProvider(apiKey, model);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
    case 'ollama':
      return new OllamaProvider(model, baseUrl || 'http://localhost:11434');
    case 'lmstudio':
      return new LMStudioProvider(model, baseUrl || 'http://localhost:1234/v1');
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Convert MikuFileTool definitions to ACP-compatible tool definitions
 * and also to the internal ToolDefinition format for the AI provider
 */
function mikuToolsToProviderTools(tools: MikuFileTool[]): ToolDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, val]) => [
          key,
          {
            type: val.type,
            description: val.description,
            enum: val.enum,
          },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([, val]) => val.required !== false)
        .map(([key]) => key),
    },
  }));
}

export class MikuAcpAgent implements acp.Agent {
  private connection: acp.AgentSideConnection;
  private sessions: Map<string, AgentSession> = new Map();
  private config: MikuFileConfig;
  private provider: AIProviderInterface;
  private basePath: string;

  constructor(connection: acp.AgentSideConnection, config: MikuFileConfig, basePath: string) {
    this.connection = connection;
    this.config = config;
    this.basePath = basePath;
    this.provider = createProvider(config);
  }

  async initialize(
    _params: acp.InitializeRequest
  ): Promise<acp.InitializeResponse> {
    const capabilities: acp.AgentCapabilities = {
      loadSession: true,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: true,
      },
    };

    // Build available modes from config
    const response: acp.InitializeResponse = {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: capabilities,
      agentInfo: {
        name: this.config.name,
        version: '0.0.9',
      },
    };

    return response;
  }

  async authenticate(
    _params: acp.AuthenticateRequest
  ): Promise<acp.AuthenticateResponse | void> {
    // No auth required - API keys are handled via env vars in .miku config
    return {};
  }

  async newSession(
    params: acp.NewSessionRequest
  ): Promise<acp.NewSessionResponse> {
    const sessionId = crypto.randomUUID();
    const cwd = params.cwd || this.config.workingDirectory || this.basePath;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    const session: AgentSession = {
      id: sessionId,
      cwd: path.resolve(this.basePath, cwd),
      currentMode: this.config.modes?.[0]?.id || 'default',
      messages: [{ role: 'system', content: systemPrompt }],
      pendingPrompt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    // Build response with available modes
    const response: acp.NewSessionResponse = {
      sessionId,
    };

    // Include mode state in response if modes are configured
    if (this.config.modes && this.config.modes.length > 0) {
      response.modes = {
        availableModes: this.config.modes.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
        })),
        currentModeId: session.currentMode,
      };
    }

    return response;
  }

  async loadSession(
    params: acp.LoadSessionRequest
  ): Promise<acp.LoadSessionResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new acp.RequestError(-32002, `Session ${params.sessionId} not found`);
    }

    // Replay message history
    for (const msg of session.messages) {
      if (msg.role === 'assistant') {
        await this.connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: msg.content },
          },
        });
      } else if (msg.role === 'user') {
        await this.connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: msg.content },
          },
        });
      }
    }

    return {};
  }

  async setSessionMode(
    params: acp.SetSessionModeRequest
  ): Promise<acp.SetSessionModeResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new acp.RequestError(-32002, `Session ${params.sessionId} not found`);
    }

    const mode = this.config.modes?.find(m => m.id === params.modeId);
    if (!mode) {
      throw new acp.RequestError(-32602, `Unknown mode: ${params.modeId}`);
    }

    session.currentMode = params.modeId;

    // If mode has a custom system prompt, update messages
    if (mode.systemPrompt) {
      session.messages[0] = { role: 'system', content: this.buildSystemPrompt(mode) };
    }

    // Notify client of mode change
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: params.modeId,
      },
    });

    return {};
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new acp.RequestError(-32002, `Session ${params.sessionId} not found`);
    }

    // Cancel any pending prompt
    session.pendingPrompt?.abort();
    session.pendingPrompt = new AbortController();
    const abortSignal = session.pendingPrompt.signal;

    try {
      // Extract text from prompt content blocks
      const userText = params.prompt
        .filter((block): block is acp.ContentBlock & { type: 'text' } => block.type === 'text')
        .map(block => (block as acp.TextContent & { type: 'text' }).text)
        .join('\n');

      if (!userText.trim()) {
        return { stopReason: 'end_turn' };
      }

      // Add user message to history
      session.messages.push({ role: 'user', content: userText });
      session.updatedAt = new Date().toISOString();

      // Set title from first message if not set
      if (!session.title) {
        session.title = userText.slice(0, 100);
        await this.connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'session_info_update',
            title: session.title,
          },
        });
      }

      // Run the agent loop
      const result = await this.runAgentLoop(session, abortSignal);

      session.pendingPrompt = null;
      return result;
    } catch (err) {
      if (abortSignal.aborted) {
        return { stopReason: 'cancelled' };
      }
      throw err;
    }
  }

  async cancel(params: acp.CancelNotification): Promise<void> {
    const session = this.sessions.get(params.sessionId);
    session?.pendingPrompt?.abort();
  }

  // --- Private methods ---

  private buildSystemPrompt(mode?: MikuFileMode): string {
    const parts: string[] = [];

    // Base system prompt from config or default
    if (this.config.systemPrompt) {
      parts.push(this.config.systemPrompt);
    } else {
      parts.push(`You are ${this.config.name}, an AI coding agent powered by Miku.`);
      if (this.config.description) {
        parts.push(this.config.description);
      }
    }

    // Mode-specific prompt
    if (mode?.systemPrompt) {
      parts.push(`\nCurrent mode: ${mode.name}\n${mode.systemPrompt}`);
    }

    // Working directory context
    parts.push(`\nWorking directory: ${this.basePath}`);

    // Available tools context
    if (this.config.tools && this.config.tools.length > 0) {
      const toolNames = this.config.tools.map(t => t.name).join(', ');
      parts.push(`\nAvailable custom tools: ${toolNames}`);
    }

    // Permission context
    if (this.config.permissions) {
      const perms = this.config.permissions;
      const permParts: string[] = [];
      if (perms.allowFileRead) permParts.push('read files');
      if (perms.allowFileWrite) permParts.push('write files');
      if (perms.allowTerminal) permParts.push('run terminal commands');
      if (permParts.length > 0) {
        parts.push(`\nYou can: ${permParts.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  private getToolDefinitions(session: AgentSession): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    // Built-in tools based on permissions
    const perms = this.config.permissions || {
      allowFileRead: true,
      allowFileWrite: true,
      allowTerminal: false,
    };

    if (perms.allowFileRead) {
      tools.push({
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to read (relative to working directory or absolute)',
            },
          },
          required: ['path'],
        },
      });

      tools.push({
        name: 'list_directory',
        description: 'List files and directories in a path',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to list (relative to working directory or absolute)',
            },
          },
          required: ['path'],
        },
      });

      tools.push({
        name: 'search_files',
        description: 'Search for files matching a pattern in the working directory',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Glob pattern to search for (e.g., "**/*.ts")',
            },
            content: {
              type: 'string',
              description: 'Optional text to search for within matching files',
            },
          },
          required: ['pattern'],
        },
      });
    }

    if (perms.allowFileWrite) {
      tools.push({
        name: 'write_file',
        description: 'Write content to a file (creates or overwrites)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to write (relative to working directory or absolute)',
            },
            content: {
              type: 'string',
              description: 'The content to write to the file',
            },
          },
          required: ['path', 'content'],
        },
      });
    }

    if (perms.allowTerminal) {
      tools.push({
        name: 'run_command',
        description: 'Run a shell command in the working directory',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to execute',
            },
          },
          required: ['command'],
        },
      });
    }

    // Custom tools from config, filtered by current mode
    if (this.config.tools) {
      const currentMode = this.config.modes?.find(m => m.id === session.currentMode);
      const allowedTools = currentMode?.tools;

      const customTools = this.config.tools.filter(
        tool => !allowedTools || allowedTools.includes(tool.name)
      );

      tools.push(...mikuToolsToProviderTools(customTools));
    }

    return tools;
  }

  private async runAgentLoop(
    session: AgentSession,
    abortSignal: AbortSignal
  ): Promise<acp.PromptResponse> {
    const maxIterations = 20;
    let iteration = 0;

    while (iteration < maxIterations) {
      if (abortSignal.aborted) {
        return { stopReason: 'cancelled' };
      }

      iteration++;
      const tools = this.getToolDefinitions(session);

      // Call the AI provider
      let response: ProviderResponse;
      try {
        response = await this.provider.chat(session.messages, tools);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await this.connection.sessionUpdate({
          sessionId: session.id,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Error calling AI provider: ${errorMsg}` },
          },
        });
        return { stopReason: 'end_turn' };
      }

      // Stream the text content
      if (response.content) {
        await this.connection.sessionUpdate({
          sessionId: session.id,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: response.content },
          },
        });

        session.messages.push({ role: 'assistant', content: response.content });
      }

      // Process tool calls
      if (response.toolCalls.length > 0) {
        const toolResultParts: string[] = [];

        for (const toolCall of response.toolCalls) {
          if (abortSignal.aborted) {
            return { stopReason: 'cancelled' };
          }

          // Determine tool kind
          const kind = this.getToolKind(toolCall.name);

          // Send tool call notification
          await this.connection.sessionUpdate({
            sessionId: session.id,
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: toolCall.id,
              title: `${toolCall.name}`,
              kind,
              status: 'pending',
              rawInput: toolCall.arguments,
            },
          });

          // For write/edit operations, request permission
          if (kind === 'edit' || kind === 'execute') {
            const permResult = await this.connection.requestPermission({
              sessionId: session.id,
              toolCall: {
                toolCallId: toolCall.id,
                title: toolCall.name,
                kind,
                status: 'pending',
                rawInput: toolCall.arguments,
              },
              options: [
                { kind: 'allow_once', name: 'Allow', optionId: 'allow' },
                { kind: 'reject_once', name: 'Deny', optionId: 'deny' },
              ],
            });

            if (permResult.outcome.outcome === 'cancelled') {
              return { stopReason: 'cancelled' };
            }

            if ('optionId' in permResult.outcome && permResult.outcome.optionId === 'deny') {
              const denyResult = `Permission denied for ${toolCall.name}`;
              toolResultParts.push(`[${toolCall.name}]: ${denyResult}`);

              await this.connection.sessionUpdate({
                sessionId: session.id,
                update: {
                  sessionUpdate: 'tool_call_update',
                  toolCallId: toolCall.id,
                  status: 'completed',
                  rawOutput: { error: denyResult },
                },
              });
              continue;
            }
          }

          // Execute the tool
          const result = await this.executeTool(session, toolCall.name, toolCall.arguments);
          toolResultParts.push(`[${toolCall.name}]: ${result}`);

          // Send tool call completion
          await this.connection.sessionUpdate({
            sessionId: session.id,
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: toolCall.id,
              status: 'completed',
              content: [{
                type: 'content',
                content: { type: 'text', text: result },
              }],
              rawOutput: { result },
            },
          });
        }

        // Add tool results to messages for next iteration
        session.messages.push({
          role: 'user',
          content: `Tool results:\n${toolResultParts.join('\n')}`,
        });

        // Continue the loop to let the agent process tool results
        continue;
      }

      // No tool calls - agent is done
      if (response.finishReason === 'stop' || response.toolCalls.length === 0) {
        break;
      }
    }

    session.updatedAt = new Date().toISOString();
    return { stopReason: 'end_turn' };
  }

  private getToolKind(toolName: string): acp.ToolKind {
    switch (toolName) {
      case 'read_file':
      case 'list_directory':
        return 'read';
      case 'search_files':
        return 'search';
      case 'write_file':
        return 'edit';
      case 'run_command':
        return 'execute';
      default:
        // Custom tools default to 'other'
        return 'other';
    }
  }

  private resolvePath(session: AgentSession, filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(session.cwd, filePath);
  }

  private isPathAllowed(resolvedPath: string): boolean {
    const perms = this.config.permissions;
    if (!perms) return true;

    // Check denied paths
    if (perms.deniedPaths) {
      for (const denied of perms.deniedPaths) {
        const resolvedDenied = path.resolve(this.basePath, denied);
        if (resolvedPath.startsWith(resolvedDenied)) {
          return false;
        }
      }
    }

    // Check allowed paths (if specified, only these paths are allowed)
    if (perms.allowedPaths && perms.allowedPaths.length > 0) {
      return perms.allowedPaths.some(allowed => {
        const resolvedAllowed = path.resolve(this.basePath, allowed);
        return resolvedPath.startsWith(resolvedAllowed);
      });
    }

    return true;
  }

  private async executeTool(
    session: AgentSession,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    try {
      switch (toolName) {
        case 'read_file': {
          const filePath = this.resolvePath(session, args.path as string);
          if (!this.isPathAllowed(filePath)) {
            return `Error: Access denied to path: ${args.path}`;
          }
          try {
            // Try using the ACP client's file reading first
            const result = await this.connection.readTextFile({
              sessionId: session.id,
              path: filePath,
            });
            return result.content;
          } catch {
            // Fall back to direct file system access
            return fs.readFileSync(filePath, 'utf-8');
          }
        }

        case 'write_file': {
          const filePath = this.resolvePath(session, args.path as string);
          if (!this.isPathAllowed(filePath)) {
            return `Error: Access denied to path: ${args.path}`;
          }
          const content = args.content as string;
          try {
            // Try using the ACP client's file writing first
            await this.connection.writeTextFile({
              sessionId: session.id,
              path: filePath,
              content,
            });
            return `Successfully wrote ${content.length} characters to ${args.path}`;
          } catch {
            // Fall back to direct file system access
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            return `Successfully wrote ${content.length} characters to ${args.path}`;
          }
        }

        case 'list_directory': {
          const dirPath = this.resolvePath(session, (args.path as string) || '.');
          if (!this.isPathAllowed(dirPath)) {
            return `Error: Access denied to path: ${args.path}`;
          }
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          const lines = entries.map(e => {
            const suffix = e.isDirectory() ? '/' : '';
            return `${e.name}${suffix}`;
          });
          return lines.join('\n') || '(empty directory)';
        }

        case 'search_files': {
          const pattern = args.pattern as string;
          const searchContent = args.content as string | undefined;
          // Simple recursive file search
          const results = this.searchFiles(session.cwd, pattern, searchContent);
          if (results.length === 0) {
            return 'No matching files found';
          }
          return results.slice(0, 50).join('\n') +
            (results.length > 50 ? `\n... and ${results.length - 50} more` : '');
        }

        case 'run_command': {
          const command = args.command as string;
          try {
            const terminal = await this.connection.createTerminal({
              sessionId: session.id,
              command,
              cwd: session.cwd,
            });

            const exitResult = await terminal.waitForExit();
            const output = await terminal.currentOutput();
            await terminal.release();

            const exitCode = exitResult.exitCode ?? -1;
            return `Exit code: ${exitCode}\n${output.output || ''}`;
          } catch {
            // Fall back to child_process
            const { execSync } = await import('node:child_process');
            try {
              const result = execSync(command, {
                cwd: session.cwd,
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 1024 * 1024,
              });
              return result;
            } catch (execErr: unknown) {
              const e = execErr as { stderr?: string; status?: number };
              return `Command failed (exit ${e.status}): ${e.stderr || 'Unknown error'}`;
            }
          }
        }

        default: {
          // Handle custom tools from .miku config
          const customTool = this.config.tools?.find(t => t.name === toolName);
          if (customTool?.handler) {
            // Execute handler script
            const handlerPath = path.resolve(this.basePath, customTool.handler);
            if (fs.existsSync(handlerPath)) {
              const { execSync } = await import('node:child_process');
              try {
                const result = execSync(
                  `node "${handlerPath}" '${JSON.stringify(args)}'`,
                  {
                    cwd: session.cwd,
                    encoding: 'utf-8',
                    timeout: 30000,
                    env: { ...process.env, ...this.config.env },
                  }
                );
                return result;
              } catch (execErr: unknown) {
                const e = execErr as { stderr?: string };
                return `Handler error: ${e.stderr || 'Unknown error'}`;
              }
            }
            return `Handler not found: ${customTool.handler}`;
          }
          return `Unknown tool: ${toolName}`;
        }
      }
    } catch (err) {
      return `Error executing ${toolName}: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private searchFiles(
    dir: string,
    pattern: string,
    contentSearch?: string,
    results: string[] = [],
    depth: number = 0
  ): string[] {
    if (depth > 10 || results.length > 100) return results;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.basePath, fullPath);

        if (entry.isDirectory()) {
          this.searchFiles(fullPath, pattern, contentSearch, results, depth + 1);
        } else {
          // Simple glob matching (support *.ext and **/*.ext patterns)
          const matchPattern = pattern
            .replace(/\*\*/g, '___GLOBSTAR___')
            .replace(/\*/g, '[^/]*')
            .replace(/___GLOBSTAR___/g, '.*');
          const regex = new RegExp(`^${matchPattern}$`);

          if (regex.test(entry.name) || regex.test(relativePath)) {
            if (contentSearch) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (content.includes(contentSearch)) {
                  results.push(relativePath);
                }
              } catch {
                // Skip unreadable files
              }
            } else {
              results.push(relativePath);
            }
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }

    return results;
  }
}
