/**
 * File type detection utilities for Miku editor
 * Determines how to render/edit files based on extension and content
 */

import type { FileType } from '@/types';

/**
 * File extension to type mapping
 * Note: .miku-env files can be named like "production.miku-env" or "staging.miku-env"
 * so we check if the filename ends with .miku-env rather than exact match
 */
const EXTENSION_MAP: Record<string, FileType> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdown': 'markdown',
  '.txt': 'markdown', // Treat plain text as markdown
};

/**
 * Extensions that support named variants (e.g., "production.miku-env")
 */
const NAMED_EXTENSIONS: { suffix: string; type: FileType }[] = [
  { suffix: '.miku-env', type: 'miku-env' },
  { suffix: '.mikuenv', type: 'miku-env' },
  { suffix: '.kanban', type: 'kanban' },
  { suffix: '.miku-kanban', type: 'kanban' },
  { suffix: '.docs', type: 'docs' },
  { suffix: '.miku-docs', type: 'docs' },
];

/**
 * Magic header for .miku-env files
 */
const MIKU_ENV_MAGIC_HEADER = '#!miku-env';

/**
 * Detect file type from file path/name
 */
export function getFileTypeFromPath(filePath: string): FileType {
  const lowerPath = filePath.toLowerCase();

  // Check for named extensions first (e.g., "production.miku-env")
  for (const { suffix, type } of NAMED_EXTENSIONS) {
    if (lowerPath.endsWith(suffix)) {
      return type;
    }
  }

  // Check exact extension matches
  for (const [ext, type] of Object.entries(EXTENSION_MAP)) {
    if (lowerPath.endsWith(ext)) {
      return type;
    }
  }

  // Default to markdown for unknown extensions
  return 'markdown';
}

/**
 * Detect file type from content (for files opened via paste or without extension)
 */
export function getFileTypeFromContent(content: string): FileType {
  const trimmed = content.trim();

  // Check for .miku-env magic header
  if (trimmed.startsWith(MIKU_ENV_MAGIC_HEADER)) {
    return 'miku-env';
  }

  // Check for kanban JSON format (starts with { and has version + columns)
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.version) {
        // Check for kanban format
        if (Array.isArray(parsed.columns)) {
          return 'kanban';
        }
        // Check for docs format
        if (Array.isArray(parsed.entries)) {
          return 'docs';
        }
      }
    } catch {
      // Not valid JSON, continue
    }
  }

  // Check if content looks like a .env file (heuristic)
  // Multiple KEY=VALUE lines with no markdown indicators
  const lines = trimmed.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
  const envLinePattern = /^[A-Z][A-Z0-9_]*=/i;
  const envLineCount = lines.filter(line => envLinePattern.test(line.trim())).length;

  // If more than 70% of non-comment lines are env-style, suggest it might be env
  // But we don't auto-convert, just for detection hints
  if (lines.length > 0 && envLineCount / lines.length > 0.7) {
    // Could be env but we default to markdown unless explicitly .miku-env
    return 'markdown';
  }

  return 'markdown';
}

/**
 * Detect file type from both path and content
 * Path takes precedence, content is used as fallback
 */
export function detectFileType(filePath: string | null, content: string): FileType {
  if (filePath) {
    return getFileTypeFromPath(filePath);
  }
  return getFileTypeFromContent(content);
}

/**
 * Check if a file path is a .miku-env file
 */
export function isMikuEnvFile(filePath: string): boolean {
  return getFileTypeFromPath(filePath) === 'miku-env';
}

/**
 * Get the appropriate file extension for a file type
 */
export function getExtensionForType(type: FileType): string {
  switch (type) {
    case 'miku-env':
      return '.miku-env';
    case 'kanban':
      return '.kanban';
    case 'docs':
      return '.docs';
    case 'markdown':
    default:
      return '.md';
  }
}

/**
 * Get display name for file type
 */
export function getFileTypeDisplayName(type: FileType): string {
  switch (type) {
    case 'miku-env':
      return 'Environment Variables';
    case 'kanban':
      return 'Kanban Board';
    case 'docs':
      return 'Documentation';
    case 'markdown':
    default:
      return 'Markdown';
  }
}

/**
 * Check if a file path is a .kanban file
 */
export function isKanbanFile(filePath: string): boolean {
  return getFileTypeFromPath(filePath) === 'kanban';
}

/**
 * Check if a file path is a .docs file
 */
export function isDocsFile(filePath: string): boolean {
  return getFileTypeFromPath(filePath) === 'docs';
}
