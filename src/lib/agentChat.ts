/**
 * Browser-side ACP-style agent chat service
 *
 * Implements an agent loop with tool calling, similar to Claude Code.
 * Uses Miku's existing AI provider system and emits session updates
 * that the UI renders inline (tool calls, results, permissions, etc.).
 */

import { AIProvider } from '@/types';
import { MikuFileConfig, MikuFileProvider } from './mikuFileParser';
import { AIProviderInterface, Message, ToolDefinition, ToolCall } from './ai/types';
import { OpenAIProvider } from './ai/providers/openai';
import { AnthropicProvider } from './ai/providers/anthropic';
import { GoogleProvider } from './ai/providers/google';
import { OpenRouterProvider } from './ai/providers/openrouter';
import { OllamaProvider } from './ai/providers/ollama';
import { LMStudioProvider } from './ai/providers/lmstudio';

// ============================================
// ACP-style Session Update Types
// ============================================

export type ToolKind = 'read' | 'edit' | 'search' | 'execute' | 'other';
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'denied';

export interface AgentToolCall {
  id: string;
  name: string;
  kind: ToolKind;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentChatConfig {
  providerType: MikuFileProvider['type'];
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt?: string;
  agentName?: string;
  permissions?: {
    allowFileRead: boolean;
    allowFileWrite: boolean;
    allowTerminal: boolean;
  };
  modes?: Array<{ id: string; name: string; description: string }>;
}

export interface AgentChatDocument {
  version: string;
  agentConfig: AgentChatConfig;
  messages: AgentChatMessage[];
  currentMode?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Session Update Events (ACP-style)
// ============================================

export type SessionUpdate =
  | { type: 'message_chunk'; content: string }
  | { type: 'tool_call'; toolCall: AgentToolCall }
  | { type: 'tool_result'; toolCallId: string; result: string; status: ToolCallStatus }
  | { type: 'permission_request'; toolCall: AgentToolCall }
  | { type: 'error'; message: string }
  | { type: 'done'; message: AgentChatMessage };

// ============================================
// Document Serialization
// ============================================

export function createAgentChatDocument(config: AgentChatConfig): AgentChatDocument {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    agentConfig: config,
    messages: [],
    currentMode: config.modes?.[0]?.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseAgentChatDocument(content: string): AgentChatDocument {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty agent chat document');
  }
  const parsed = JSON.parse(trimmed);
  if (!parsed.agentConfig || !Array.isArray(parsed.messages)) {
    throw new Error('Invalid agent chat document format');
  }
  return parsed as AgentChatDocument;
}

export function serializeAgentChatDocument(doc: AgentChatDocument): string {
  return JSON.stringify(doc, null, 2);
}

// ============================================
// Config from .miku file
// ============================================

export function configFromMikuFile(
  mikuConfig: MikuFileConfig,
  apiKeys: Record<AIProvider, string>
): AgentChatConfig {
  const providerType = mikuConfig.provider.type;
  const apiKey = apiKeys[providerType as AIProvider] || '';

  return {
    providerType,
    model: mikuConfig.provider.model,
    apiKey,
    baseUrl: mikuConfig.provider.baseUrl,
    systemPrompt: mikuConfig.systemPrompt || `You are ${mikuConfig.name}, an AI coding assistant. ${mikuConfig.description || ''}`.trim(),
    agentName: mikuConfig.name,
    permissions: mikuConfig.permissions ? {
      allowFileRead: mikuConfig.permissions.allowFileRead,
      allowFileWrite: mikuConfig.permissions.allowFileWrite,
      allowTerminal: mikuConfig.permissions.allowTerminal,
    } : undefined,
    modes: mikuConfig.modes?.map(m => ({ id: m.id, name: m.name, description: m.description })),
  };
}

// ============================================
// Built-in Agent Tools
// ============================================

function getAgentTools(permissions?: AgentChatConfig['permissions']): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const perms = permissions || { allowFileRead: true, allowFileWrite: true, allowTerminal: false };

  if (perms.allowFileRead) {
    tools.push({
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
    });
    tools.push({
      name: 'list_directory',
      description: 'List files and directories at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (default: current directory)' },
        },
        required: [],
      },
    });
    tools.push({
      name: 'search_files',
      description: 'Search for files matching a glob pattern, optionally searching file contents',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
          content: { type: 'string', description: 'Text to search for within matching files' },
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
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    });
  }

  if (perms.allowTerminal) {
    tools.push({
      name: 'run_command',
      description: 'Run a shell command and return the output',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    });
  }

  return tools;
}

function getToolKind(name: string): ToolKind {
  switch (name) {
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
      return 'other';
  }
}

// ============================================
// Agent Chat Service
// ============================================

export type PermissionResolver = (toolCall: AgentToolCall) => Promise<boolean>;

export class AgentChatService {
  private provider: AIProviderInterface;
  private systemPrompt: string;
  private messages: Message[] = [];
  private tools: ToolDefinition[];
  private config: AgentChatConfig;
  private permissionResolver: PermissionResolver | null = null;

  constructor(config: AgentChatConfig) {
    this.config = config;
    this.provider = createProvider(config);
    this.systemPrompt = config.systemPrompt || 'You are a helpful AI coding assistant.';
    this.messages = [{ role: 'system', content: this.systemPrompt }];
    this.tools = getAgentTools(config.permissions);
  }

  setPermissionResolver(resolver: PermissionResolver): void {
    this.permissionResolver = resolver;
  }

  loadHistory(messages: AgentChatMessage[]): void {
    this.messages = [{ role: 'system', content: this.systemPrompt }];
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        this.messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  /**
   * Run the agent loop: send message, process tool calls, repeat until done.
   * Yields session updates for the UI to render inline.
   */
  async *runPrompt(
    userMessage: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<SessionUpdate, void, unknown> {
    this.messages.push({ role: 'user', content: userMessage });

    const maxIterations = 20;
    let iteration = 0;
    let fullAssistantContent = '';
    const allToolCalls: AgentToolCall[] = [];

    while (iteration < maxIterations) {
      if (abortSignal?.aborted) return;
      iteration++;

      let response;
      try {
        response = await this.provider.chat(this.messages, this.tools);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        yield { type: 'error', message: errMsg };
        return;
      }

      // Emit text content
      if (response.content) {
        fullAssistantContent += response.content;
        yield { type: 'message_chunk', content: response.content };
        this.messages.push({ role: 'assistant', content: response.content });
      }

      // Process tool calls
      if (response.toolCalls.length > 0) {
        const toolResultParts: string[] = [];

        for (const tc of response.toolCalls) {
          if (abortSignal?.aborted) return;

          const kind = getToolKind(tc.name);
          const agentTc: AgentToolCall = {
            id: tc.id,
            name: tc.name,
            kind,
            arguments: tc.arguments,
            status: 'pending',
          };

          // Emit tool call
          yield { type: 'tool_call', toolCall: { ...agentTc } };

          // Request permission for write/execute operations
          if (kind === 'edit' || kind === 'execute') {
            yield { type: 'permission_request', toolCall: { ...agentTc } };

            if (this.permissionResolver) {
              const allowed = await this.permissionResolver(agentTc);
              if (!allowed) {
                agentTc.status = 'denied';
                agentTc.result = 'Permission denied by user';
                yield { type: 'tool_result', toolCallId: tc.id, result: agentTc.result, status: 'denied' };
                toolResultParts.push(`[${tc.name}]: Permission denied`);
                allToolCalls.push(agentTc);
                continue;
              }
            }
          }

          // Execute tool
          agentTc.status = 'running';
          const result = await this.executeTool(tc.name, tc.arguments);
          agentTc.status = 'completed';
          agentTc.result = result;
          allToolCalls.push(agentTc);

          yield { type: 'tool_result', toolCallId: tc.id, result, status: 'completed' };
          toolResultParts.push(`[${tc.name}]: ${result}`);
        }

        // Add tool results for next iteration
        this.messages.push({
          role: 'user',
          content: `Tool results:\n${toolResultParts.join('\n')}`,
        });

        continue; // Loop for agent to process results
      }

      // No tool calls - agent is done
      break;
    }

    // Emit final message
    const finalMessage: AgentChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: fullAssistantContent,
      timestamp: new Date().toISOString(),
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };

    yield { type: 'done', message: finalMessage };
  }

  /**
   * Stream a simple message (no tool calling, just text).
   */
  async *streamMessage(userMessage: string): AsyncGenerator<string, AgentChatMessage, unknown> {
    this.messages.push({ role: 'user', content: userMessage });

    let fullContent = '';

    if (this.provider.streamChat) {
      const stream = this.provider.streamChat(this.messages, []);
      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }
    } else {
      const response = await this.provider.chat(this.messages, []);
      fullContent = response.content || '';
      yield fullContent;
    }

    this.messages.push({ role: 'assistant', content: fullContent });

    return {
      id: generateMessageId(),
      role: 'assistant' as const,
      content: fullContent,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // Tool Execution
  // ============================================

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    // Tools run in browser context - use workspace file access if available
    // For now, return simulated results. The actual file operations will be
    // pluggable via a tool executor callback.
    if (this.toolExecutor) {
      return this.toolExecutor(name, args);
    }

    // Default: describe what would happen
    switch (name) {
      case 'read_file':
        return `[Would read file: ${args.path}]`;
      case 'write_file':
        return `[Would write ${(args.content as string || '').length} chars to: ${args.path}]`;
      case 'list_directory':
        return `[Would list directory: ${args.path || '.'}]`;
      case 'search_files':
        return `[Would search for: ${args.pattern}${args.content ? ` containing "${args.content}"` : ''}]`;
      case 'run_command':
        return `[Would run: ${args.command}]`;
      default:
        return `[Unknown tool: ${name}]`;
    }
  }

  private toolExecutor: ((name: string, args: Record<string, unknown>) => Promise<string>) | null = null;

  setToolExecutor(executor: (name: string, args: Record<string, unknown>) => Promise<string>): void {
    this.toolExecutor = executor;
  }
}

// ============================================
// Helpers
// ============================================

function createProvider(config: AgentChatConfig): AIProviderInterface {
  switch (config.providerType) {
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    case 'google':
      return new GoogleProvider(config.apiKey, config.model);
    case 'openrouter':
      return new OpenRouterProvider(config.apiKey, config.model);
    case 'ollama':
      return new OllamaProvider(config.model, config.baseUrl || 'http://localhost:11434');
    case 'lmstudio':
      return new LMStudioProvider(config.model, config.baseUrl || 'http://localhost:1234/v1');
    default:
      throw new Error(`Unknown provider type: ${config.providerType}`);
  }
}

let messageCounter = 0;
export function generateMessageId(): string {
  messageCounter++;
  return `msg-${messageCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
