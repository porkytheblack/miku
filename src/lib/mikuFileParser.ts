/**
 * Parser for .miku configuration files
 *
 * .miku files define ACP agent configurations that can be pointed at
 * specific folders and customized with tools, providers, and behaviors.
 *
 * Format: JSON with the following structure:
 * {
 *   "version": 1,
 *   "name": "My Agent",
 *   "description": "What this agent does",
 *   "workingDirectory": "./path/to/folder",
 *   "provider": { "type": "anthropic", "model": "claude-sonnet-4-5-20250514", "apiKeyEnv": "ANTHROPIC_API_KEY" },
 *   "tools": [...],
 *   "systemPrompt": "...",
 *   "modes": [...],
 *   "permissions": { ... }
 * }
 */

export interface MikuFileProvider {
  type: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama' | 'lmstudio';
  model: string;
  apiKeyEnv?: string;
  baseUrl?: string;
}

export interface MikuFileTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
    default?: unknown;
  }>;
  handler?: string; // Path to handler script relative to .miku file
}

export interface MikuFileMode {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  tools?: string[]; // Tool names available in this mode
}

export interface MikuFilePermissions {
  allowFileRead: boolean;
  allowFileWrite: boolean;
  allowTerminal: boolean;
  allowedPaths?: string[];
  deniedPaths?: string[];
}

export interface MikuFileConfig {
  version: number;
  name: string;
  description?: string;
  workingDirectory?: string;
  provider: MikuFileProvider;
  tools?: MikuFileTool[];
  systemPrompt?: string;
  modes?: MikuFileMode[];
  permissions?: MikuFilePermissions;
  env?: Record<string, string>;
  mcpServers?: MikuFileMcpServer[];
}

export interface MikuFileMcpServer {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

/**
 * Parse a .miku file content string into a MikuFileConfig
 */
export function parseMikuFile(content: string): MikuFileConfig {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new MikuFileParseError('Empty .miku file');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    throw new MikuFileParseError(
      `Invalid JSON in .miku file: ${e instanceof Error ? e.message : 'Unknown error'}`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new MikuFileParseError('.miku file must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate version
  if (typeof obj.version !== 'number' || obj.version !== 1) {
    throw new MikuFileParseError(
      `Unsupported .miku file version: ${obj.version}. Only version 1 is supported.`
    );
  }

  // Validate name
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new MikuFileParseError('.miku file must have a non-empty "name" field');
  }

  // Validate provider
  if (!obj.provider || typeof obj.provider !== 'object') {
    throw new MikuFileParseError('.miku file must have a "provider" object');
  }

  const provider = obj.provider as Record<string, unknown>;
  const validProviderTypes = ['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'lmstudio'];
  if (!validProviderTypes.includes(provider.type as string)) {
    throw new MikuFileParseError(
      `Invalid provider type: ${provider.type}. Must be one of: ${validProviderTypes.join(', ')}`
    );
  }

  if (typeof provider.model !== 'string' || !provider.model.trim()) {
    throw new MikuFileParseError('Provider must have a non-empty "model" field');
  }

  // Build config
  const config: MikuFileConfig = {
    version: obj.version as number,
    name: (obj.name as string).trim(),
    description: typeof obj.description === 'string' ? obj.description : undefined,
    workingDirectory: typeof obj.workingDirectory === 'string' ? obj.workingDirectory : undefined,
    provider: {
      type: provider.type as MikuFileProvider['type'],
      model: provider.model as string,
      apiKeyEnv: typeof provider.apiKeyEnv === 'string' ? provider.apiKeyEnv : undefined,
      baseUrl: typeof provider.baseUrl === 'string' ? provider.baseUrl : undefined,
    },
    systemPrompt: typeof obj.systemPrompt === 'string' ? obj.systemPrompt : undefined,
    env: obj.env && typeof obj.env === 'object' ? obj.env as Record<string, string> : undefined,
  };

  // Parse tools
  if (Array.isArray(obj.tools)) {
    config.tools = obj.tools.map((tool: unknown, i: number) => {
      if (typeof tool !== 'object' || tool === null) {
        throw new MikuFileParseError(`Tool at index ${i} must be an object`);
      }
      const t = tool as Record<string, unknown>;
      if (typeof t.name !== 'string') {
        throw new MikuFileParseError(`Tool at index ${i} must have a "name" string`);
      }
      if (typeof t.description !== 'string') {
        throw new MikuFileParseError(`Tool at index ${i} must have a "description" string`);
      }
      return {
        name: t.name as string,
        description: t.description as string,
        parameters: (t.parameters || {}) as MikuFileTool['parameters'],
        handler: typeof t.handler === 'string' ? t.handler : undefined,
      };
    });
  }

  // Parse modes
  if (Array.isArray(obj.modes)) {
    config.modes = obj.modes.map((mode: unknown, i: number) => {
      if (typeof mode !== 'object' || mode === null) {
        throw new MikuFileParseError(`Mode at index ${i} must be an object`);
      }
      const m = mode as Record<string, unknown>;
      if (typeof m.id !== 'string') {
        throw new MikuFileParseError(`Mode at index ${i} must have an "id" string`);
      }
      if (typeof m.name !== 'string') {
        throw new MikuFileParseError(`Mode at index ${i} must have a "name" string`);
      }
      return {
        id: m.id as string,
        name: m.name as string,
        description: typeof m.description === 'string' ? m.description : '',
        systemPrompt: typeof m.systemPrompt === 'string' ? m.systemPrompt : undefined,
        tools: Array.isArray(m.tools) ? m.tools as string[] : undefined,
      };
    });
  }

  // Parse permissions
  if (obj.permissions && typeof obj.permissions === 'object') {
    const p = obj.permissions as Record<string, unknown>;
    config.permissions = {
      allowFileRead: p.allowFileRead !== false,
      allowFileWrite: p.allowFileWrite !== false,
      allowTerminal: p.allowTerminal === true,
      allowedPaths: Array.isArray(p.allowedPaths) ? p.allowedPaths as string[] : undefined,
      deniedPaths: Array.isArray(p.deniedPaths) ? p.deniedPaths as string[] : undefined,
    };
  }

  // Parse MCP servers
  if (Array.isArray(obj.mcpServers)) {
    config.mcpServers = obj.mcpServers.map((server: unknown, i: number) => {
      if (typeof server !== 'object' || server === null) {
        throw new MikuFileParseError(`MCP server at index ${i} must be an object`);
      }
      const s = server as Record<string, unknown>;
      if (typeof s.name !== 'string') {
        throw new MikuFileParseError(`MCP server at index ${i} must have a "name" string`);
      }
      const validTransports = ['stdio', 'http', 'sse'];
      if (!validTransports.includes(s.transport as string)) {
        throw new MikuFileParseError(
          `MCP server at index ${i} must have a valid transport: ${validTransports.join(', ')}`
        );
      }
      return {
        name: s.name as string,
        transport: s.transport as MikuFileMcpServer['transport'],
        command: typeof s.command === 'string' ? s.command : undefined,
        args: Array.isArray(s.args) ? s.args as string[] : undefined,
        url: typeof s.url === 'string' ? s.url : undefined,
        env: s.env && typeof s.env === 'object' ? s.env as Record<string, string> : undefined,
      };
    });
  }

  return config;
}

/**
 * Serialize a MikuFileConfig to a .miku file string
 */
export function serializeMikuFile(config: MikuFileConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Create a default .miku file config
 */
export function createDefaultMikuFile(name: string): MikuFileConfig {
  return {
    version: 1,
    name,
    description: '',
    provider: {
      type: 'anthropic',
      model: 'claude-sonnet-4-5-20250514',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
    tools: [],
    modes: [
      {
        id: 'review',
        name: 'Review',
        description: 'Review and suggest improvements to writing',
      },
      {
        id: 'edit',
        name: 'Edit',
        description: 'Make direct edits to files',
      },
      {
        id: 'ask',
        name: 'Ask',
        description: 'Answer questions about the codebase',
      },
    ],
    permissions: {
      allowFileRead: true,
      allowFileWrite: true,
      allowTerminal: false,
    },
  };
}

export class MikuFileParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MikuFileParseError';
  }
}
