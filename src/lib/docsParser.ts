/**
 * Parser and serializer for .docs files
 * JSON-based format for SimpleDocs documentation management
 */

import type {
  DocsDocument,
  DocsMetadata,
  DocsEntry,
  PastedEntry,
  GitHubFileEntry,
  GitHubFolderEntry,
  GitHubFolderFile,
  GitHubFileSource,
  GitHubFolderSource,
} from '@/types';

const DOCS_VERSION = '1.0';

/**
 * Generate a unique ID for docs entities
 * Uses counter + timestamp + random string to ensure uniqueness
 */
let idCounter = 0;
export function generateEntryId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `entry-${++idCounter}-${Date.now()}-${random}`;
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Create a new empty docs document
 * Timestamps are omitted for idempotent serialization - they are added on save
 */
export function createEmptyDocument(): DocsDocument {
  return {
    version: DOCS_VERSION,
    metadata: {},
    entries: [],
  };
}

/**
 * Create a new pasted entry
 * @param title - Entry title
 * @param content - Markdown content
 * @returns PastedEntry with generated ID
 */
export function createPastedEntry(title: string, content: string): PastedEntry {
  const now = new Date().toISOString();
  return {
    id: generateEntryId(),
    type: 'pasted',
    title: title.trim().slice(0, 200) || 'Untitled',
    content: content,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new GitHub file entry
 * @param title - Entry title
 * @param source - GitHub file source
 * @param cacheKey - Cache key for content
 * @returns GitHubFileEntry with generated ID
 */
export function createGitHubFileEntry(
  title: string,
  source: GitHubFileSource,
  cacheKey: string
): GitHubFileEntry {
  const now = new Date().toISOString();
  return {
    id: generateEntryId(),
    type: 'github-file',
    title: title.trim().slice(0, 200) || source.path.split('/').pop() || 'Untitled',
    source,
    cacheKey,
    lastFetched: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new GitHub folder entry
 * @param title - Entry title
 * @param source - GitHub folder source
 * @param files - List of files in the folder
 * @returns GitHubFolderEntry with generated ID
 */
export function createGitHubFolderEntry(
  title: string,
  source: GitHubFolderSource,
  files: GitHubFolderFile[]
): GitHubFolderEntry {
  const now = new Date().toISOString();
  return {
    id: generateEntryId(),
    type: 'github-folder',
    title: title.trim().slice(0, 200) || source.path.split('/').pop() || 'Documentation',
    source,
    files,
    lastFetched: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate and parse metadata
 * Preserves existing timestamps without generating new ones (for idempotent parsing)
 */
function parseMetadata(metadata: unknown): DocsMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const m = metadata as Record<string, unknown>;
  return {
    name: typeof m.name === 'string' ? m.name : undefined,
    description: typeof m.description === 'string' ? m.description : undefined,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
    updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : undefined,
  };
}

/**
 * Validate and parse a GitHub file source
 */
function parseGitHubFileSource(source: unknown): GitHubFileSource | null {
  if (!source || typeof source !== 'object') return null;

  const s = source as Record<string, unknown>;

  if (
    typeof s.owner !== 'string' || !s.owner ||
    typeof s.repo !== 'string' || !s.repo ||
    typeof s.branch !== 'string' || !s.branch ||
    typeof s.path !== 'string' || !s.path
  ) {
    return null;
  }

  return {
    owner: s.owner,
    repo: s.repo,
    branch: s.branch,
    path: s.path,
  };
}

/**
 * Validate and parse a GitHub folder source
 */
function parseGitHubFolderSource(source: unknown): GitHubFolderSource | null {
  // Same structure as file source
  return parseGitHubFileSource(source);
}

/**
 * Validate and parse a GitHub folder file
 */
function parseGitHubFolderFile(file: unknown): GitHubFolderFile | null {
  if (!file || typeof file !== 'object') return null;

  const f = file as Record<string, unknown>;

  if (
    typeof f.path !== 'string' || !f.path ||
    typeof f.cacheKey !== 'string' || !f.cacheKey ||
    typeof f.sha !== 'string' || !f.sha
  ) {
    return null;
  }

  return {
    path: f.path,
    title: typeof f.title === 'string' ? f.title : f.path.split('/').pop() || 'Untitled',
    cacheKey: f.cacheKey,
    sha: f.sha,
  };
}

/**
 * Validate and parse a pasted entry
 */
function parsePastedEntry(entry: Record<string, unknown>, seenIds: Set<string>): PastedEntry | null {
  // Require content field
  if (typeof entry.content !== 'string') return null;

  // Generate or validate ID
  let id = typeof entry.id === 'string' ? entry.id : generateEntryId();
  if (seenIds.has(id)) {
    id = generateEntryId();
  }
  seenIds.add(id);

  const now = new Date().toISOString();
  return {
    id,
    type: 'pasted',
    title: typeof entry.title === 'string' ? entry.title.slice(0, 200) : 'Untitled',
    content: entry.content,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
  };
}

/**
 * Validate and parse a GitHub file entry
 */
function parseGitHubFileEntry(entry: Record<string, unknown>, seenIds: Set<string>): GitHubFileEntry | null {
  // Require source and cacheKey
  const source = parseGitHubFileSource(entry.source);
  if (!source) return null;
  if (typeof entry.cacheKey !== 'string' || !entry.cacheKey) return null;

  // Generate or validate ID
  let id = typeof entry.id === 'string' ? entry.id : generateEntryId();
  if (seenIds.has(id)) {
    id = generateEntryId();
  }
  seenIds.add(id);

  const now = new Date().toISOString();
  return {
    id,
    type: 'github-file',
    title: typeof entry.title === 'string' ? entry.title.slice(0, 200) : source.path.split('/').pop() || 'Untitled',
    source,
    cacheKey: entry.cacheKey,
    lastFetched: typeof entry.lastFetched === 'string' ? entry.lastFetched : now,
    lastCommitSha: typeof entry.lastCommitSha === 'string' ? entry.lastCommitSha : undefined,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
  };
}

/**
 * Validate and parse a GitHub folder entry
 */
function parseGitHubFolderEntry(entry: Record<string, unknown>, seenIds: Set<string>): GitHubFolderEntry | null {
  // Require source
  const source = parseGitHubFolderSource(entry.source);
  if (!source) return null;

  // Generate or validate ID
  let id = typeof entry.id === 'string' ? entry.id : generateEntryId();
  if (seenIds.has(id)) {
    id = generateEntryId();
  }
  seenIds.add(id);

  // Parse files
  const files: GitHubFolderFile[] = [];
  if (Array.isArray(entry.files)) {
    for (const file of entry.files.slice(0, 100)) { // Max 100 files
      const parsed = parseGitHubFolderFile(file);
      if (parsed) files.push(parsed);
    }
  }

  const now = new Date().toISOString();
  return {
    id,
    type: 'github-folder',
    title: typeof entry.title === 'string' ? entry.title.slice(0, 200) : source.path.split('/').pop() || 'Documentation',
    source,
    files,
    lastFetched: typeof entry.lastFetched === 'string' ? entry.lastFetched : now,
    lastCommitSha: typeof entry.lastCommitSha === 'string' ? entry.lastCommitSha : undefined,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
  };
}

/**
 * Validate and parse a single entry
 */
function parseEntry(entry: unknown, seenIds: Set<string>): DocsEntry | null {
  if (!entry || typeof entry !== 'object') return null;

  const e = entry as Record<string, unknown>;

  switch (e.type) {
    case 'pasted':
      return parsePastedEntry(e, seenIds);
    case 'github-file':
      return parseGitHubFileEntry(e, seenIds);
    case 'github-folder':
      return parseGitHubFolderEntry(e, seenIds);
    default:
      return null;
  }
}

/**
 * Parse a .docs file content into a DocsDocument
 * @param content - Raw file content (JSON string)
 * @returns Parsed and validated DocsDocument
 */
export function parseDocsFile(content: string): DocsDocument {
  const trimmed = content.trim();

  // Handle empty file
  if (!trimmed) {
    return createEmptyDocument();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    console.error('Invalid JSON in docs file');
    return createEmptyDocument();
  }

  if (!parsed || typeof parsed !== 'object') {
    return createEmptyDocument();
  }

  const doc = parsed as Record<string, unknown>;

  // Check version (log warning for unknown versions but try to parse)
  if (doc.version && doc.version !== DOCS_VERSION) {
    console.warn(`Unknown docs version ${doc.version}, attempting to parse`);
  }

  // Track seen IDs for uniqueness
  const seenIds = new Set<string>();

  // Parse entries
  const entries: DocsEntry[] = [];
  if (Array.isArray(doc.entries)) {
    for (const entry of doc.entries.slice(0, 100)) { // Max 100 entries
      const parsedEntry = parseEntry(entry, seenIds);
      if (parsedEntry) entries.push(parsedEntry);
    }
  }

  return {
    version: DOCS_VERSION,
    metadata: parseMetadata(doc.metadata),
    entries,
  };
}

/**
 * Serialize a DocsDocument to .docs file format
 * @param document - The document to serialize
 * @returns Formatted JSON string
 */
export function serializeDocsDocument(document: DocsDocument): string {
  const output = {
    version: document.version,
    metadata: document.metadata,
    entries: document.entries,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Extract a title from markdown content
 * Looks for the first heading or uses a fallback
 */
export function extractTitleFromMarkdown(content: string, fallback: string = 'Untitled'): string {
  // Try to find a markdown heading (# Title)
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim().slice(0, 200);
  }

  // Fall back to the first non-empty line
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine) {
    return firstLine.trim().slice(0, 200);
  }

  return fallback;
}
