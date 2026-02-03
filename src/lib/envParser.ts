/**
 * Parser and serializer for environment variable files
 * Supports both standard .env format and .miku-env extended format
 */

import type { EnvVariable, MikuEnvDocument, MikuEnvMetadata, EnvExportFormat } from '@/types';

/**
 * Magic header for .miku-env files
 */
const MIKU_ENV_MAGIC = '#!miku-env';
const MIKU_ENV_VERSION = '1.0';

/**
 * Generate a unique ID for variables
 * Uses counter + timestamp + random string to ensure uniqueness even with React Strict Mode
 */
let idCounter = 0;
function generateId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `env-${++idCounter}-${Date.now()}-${random}`;
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Common patterns that indicate a secret value
 */
const SECRET_KEY_PATTERNS = [
  /secret/i,
  /password/i,
  /passwd/i,
  /key/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private/i,
  /api_key/i,
  /apikey/i,
  /access_token/i,
];

/**
 * Detect if a key likely contains a secret value
 */
export function isLikelySecret(key: string): boolean {
  return SECRET_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Parse a standard .env file content into EnvVariables
 */
export function parseEnvFile(content: string): EnvVariable[] {
  const variables: EnvVariable[] = [];
  const lines = content.split('\n');
  let currentComment: string | undefined;
  let currentGroup: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      currentComment = undefined;
      continue;
    }

    // Handle group comments (## GROUP_NAME)
    if (trimmed.startsWith('## ')) {
      currentGroup = trimmed.slice(3).trim();
      continue;
    }

    // Handle regular comments
    if (trimmed.startsWith('#')) {
      currentComment = trimmed.slice(1).trim();
      continue;
    }

    // Parse KEY=VALUE
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      // Invalid line, skip
      currentComment = undefined;
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1);

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Handle escape sequences in double-quoted values
    if (value.includes('\\')) {
      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');
    }

    variables.push({
      id: generateId(),
      key,
      value,
      comment: currentComment,
      isSecret: isLikelySecret(key),
      group: currentGroup,
    });

    currentComment = undefined;
  }

  return variables;
}

/**
 * Parse .miku-env format (with metadata header)
 */
export function parseMikuEnvFile(content: string): MikuEnvDocument {
  const lines = content.split('\n');
  const metadata: MikuEnvMetadata = {};
  let inHeader = false;
  let headerEndIndex = 0;

  // Check for magic header
  if (!lines[0]?.trim().startsWith(MIKU_ENV_MAGIC)) {
    // No magic header, treat as regular .env
    return {
      version: MIKU_ENV_VERSION,
      metadata: {},
      variables: parseEnvFile(content),
    };
  }

  // Parse metadata from header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === MIKU_ENV_MAGIC || line.startsWith('#!miku-env')) {
      inHeader = true;
      continue;
    }

    if (inHeader) {
      // Check for end of header (empty line or non-comment line)
      if (!line.startsWith('#') || line === '') {
        headerEndIndex = i;
        break;
      }

      // Parse metadata directives
      if (line.startsWith('#@')) {
        const directive = line.slice(2);
        const colonIndex = directive.indexOf(':');
        if (colonIndex !== -1) {
          const key = directive.slice(0, colonIndex).trim().toLowerCase();
          const value = directive.slice(colonIndex + 1).trim();

          switch (key) {
            case 'name':
              metadata.name = value;
              break;
            case 'description':
              metadata.description = value;
              break;
            case 'created':
              metadata.createdAt = value;
              break;
            case 'updated':
              metadata.updatedAt = value;
              break;
          }
        }
      }
    }
  }

  // Parse variables from the rest of the file
  const variableContent = lines.slice(headerEndIndex).join('\n');
  const variables = parseEnvFile(variableContent);

  return {
    version: MIKU_ENV_VERSION,
    metadata,
    variables,
  };
}

/**
 * Serialize EnvVariables to standard .env format
 */
export function serializeToEnv(variables: EnvVariable[]): string {
  const lines: string[] = [];
  let currentGroup: string | undefined;

  for (const variable of variables) {
    // Add group header if changed
    if (variable.group !== currentGroup) {
      if (lines.length > 0) {
        lines.push(''); // Blank line before new group
      }
      if (variable.group) {
        lines.push(`## ${variable.group}`);
      }
      currentGroup = variable.group;
    }

    // Add comment if present
    if (variable.comment) {
      lines.push(`# ${variable.comment}`);
    }

    // Format value - quote if contains special characters
    let value = variable.value;
    if (value.includes(' ') || value.includes('\n') || value.includes('"') || value.includes('#')) {
      // Escape and quote
      value = '"' + value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/"/g, '\\"') + '"';
    }

    lines.push(`${variable.key}=${value}`);
  }

  return lines.join('\n');
}

/**
 * Serialize to .miku-env format with metadata
 */
export function serializeToMikuEnv(doc: MikuEnvDocument): string {
  const lines: string[] = [];

  // Magic header
  lines.push(MIKU_ENV_MAGIC);
  lines.push(`#@version: ${doc.version}`);

  // Metadata
  if (doc.metadata.name) {
    lines.push(`#@name: ${doc.metadata.name}`);
  }
  if (doc.metadata.description) {
    lines.push(`#@description: ${doc.metadata.description}`);
  }
  if (doc.metadata.createdAt) {
    lines.push(`#@created: ${doc.metadata.createdAt}`);
  }
  if (doc.metadata.updatedAt) {
    lines.push(`#@updated: ${doc.metadata.updatedAt}`);
  }

  // Blank line before variables
  lines.push('');

  // Variables
  lines.push(serializeToEnv(doc.variables));

  return lines.join('\n');
}

/**
 * Serialize to JSON format
 */
export function serializeToJson(variables: EnvVariable[]): string {
  const obj: Record<string, string> = {};
  for (const v of variables) {
    obj[v.key] = v.value;
  }
  return JSON.stringify(obj, null, 2);
}

/**
 * Serialize to YAML format
 */
export function serializeToYaml(variables: EnvVariable[]): string {
  const lines: string[] = [];
  let currentGroup: string | undefined;

  for (const variable of variables) {
    // Add group comment if changed
    if (variable.group !== currentGroup) {
      if (lines.length > 0) {
        lines.push('');
      }
      if (variable.group) {
        lines.push(`# ${variable.group}`);
      }
      currentGroup = variable.group;
    }

    // Add comment
    if (variable.comment) {
      lines.push(`# ${variable.comment}`);
    }

    // Format value - quote if contains special YAML characters
    let value = variable.value;
    if (value.includes(':') || value.includes('#') || value.includes('\n') ||
        value.startsWith(' ') || value.endsWith(' ') ||
        /^[{}\[\],&*?|>!%@`]/.test(value)) {
      // Use quoted string
      value = '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    }

    lines.push(`${variable.key}: ${value}`);
  }

  return lines.join('\n');
}

/**
 * Export variables to specified format
 */
export function exportVariables(variables: EnvVariable[], format: EnvExportFormat): string {
  switch (format) {
    case 'json':
      return serializeToJson(variables);
    case 'yaml':
      return serializeToYaml(variables);
    case 'env':
    default:
      return serializeToEnv(variables);
  }
}

/**
 * Parse content from any supported format (auto-detect)
 */
export function parseAutoDetect(content: string): EnvVariable[] {
  const trimmed = content.trim();

  // Check for .miku-env format
  if (trimmed.startsWith(MIKU_ENV_MAGIC)) {
    return parseMikuEnvFile(content).variables;
  }

  // Check for JSON format
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      return Object.entries(obj).map(([key, value]) => ({
        id: generateId(),
        key,
        value: String(value),
        isSecret: isLikelySecret(key),
      }));
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Default to .env format
  return parseEnvFile(content);
}

/**
 * Create a new empty .miku-env document
 */
export function createEmptyMikuEnvDocument(): MikuEnvDocument {
  return {
    version: MIKU_ENV_VERSION,
    metadata: {
      createdAt: new Date().toISOString(),
    },
    variables: [],
  };
}

/**
 * Create a new variable with default values
 */
export function createVariable(key: string = '', value: string = ''): EnvVariable {
  return {
    id: generateId(),
    key,
    value,
    isSecret: isLikelySecret(key),
  };
}

/**
 * Duplicate a variable with a new ID
 */
export function duplicateVariable(variable: EnvVariable): EnvVariable {
  return {
    ...variable,
    id: generateId(),
    key: `${variable.key}_COPY`,
  };
}

/**
 * Format a single variable as a copyable string
 */
export function formatVariableForCopy(variable: EnvVariable): string {
  return `${variable.key}=${variable.value}`;
}

/**
 * Format multiple variables for copying
 */
export function formatVariablesForCopy(variables: EnvVariable[]): string {
  return variables.map(formatVariableForCopy).join('\n');
}
