export type Theme = 'light' | 'dark' | 'system';

export type HighlightType = 'clarity' | 'grammar' | 'style' | 'structure' | 'economy';

export interface Suggestion {
  id: string;
  type: HighlightType;
  lineNumber: number;    // 1-indexed line where suggestion starts
  columnNumber: number;  // 1-indexed column where suggestion starts
  startIndex: number;    // Character offset from start of document
  endIndex: number;      // Character offset for end of highlighted text
  originalText: string;  // The exact text being highlighted
  observation: string;   // Why this is flagged
  suggestedRevision: string;
}

export type ReviewMode = 'manual' | 'auto';
export type AggressivenessLevel = 'gentle' | 'balanced' | 'strict';

/**
 * Keyboard sound profile ID.
 * Any string is valid - profiles are discovered dynamically from /public/sounds/keyboards/
 */
export type KeyboardSoundProfileId = string;

/**
 * User preferences for keyboard sounds.
 * Persisted in EditorSettings.
 */
export interface KeyboardSoundSettings {
  /** Whether keyboard sounds are enabled */
  enabled: boolean;

  /** Selected sound profile ID (folder name in /public/sounds/keyboards/) */
  profileId: string;

  /** Master volume (0.0 - 1.0) */
  volume: number;

  /** Whether to play keyup sounds */
  playKeyupSounds: boolean;

  /**
   * Pitch variation range (0.0 - 0.1 recommended).
   * Adds subtle pitch randomization for natural feel.
   * 0 = no variation, 0.05 = +/- 5% pitch variation.
   */
  pitchVariation: number;
}

/**
 * Default keyboard sound settings.
 * Feature is opt-in (disabled by default).
 */
export const DEFAULT_KEYBOARD_SOUND_SETTINGS: KeyboardSoundSettings = {
  enabled: false,
  profileId: '',  // Will use first available profile
  volume: 0.5,
  playKeyupSounds: false,
  pitchVariation: 0.02,
};

/**
 * Metadata for a keyboard sound profile.
 * Used for UI display in settings.
 */
export interface KeyboardSoundProfileInfo {
  id: string;
  name: string;
  description: string;
}

export interface EditorSettings {
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  editorWidth: number;
  fontFamily: 'mono' | 'sans';
  reviewMode: ReviewMode;
  aggressiveness: AggressivenessLevel;
  writingContext: string;
  soundEnabled: boolean;
  keyboardSounds: KeyboardSoundSettings;
}

export type MikuStatus = 'idle' | 'thinking' | 'ready' | 'error';

export interface MikuState {
  status: MikuStatus;
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
  error: string | null;
}

// AI Provider Types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'lmstudio' | 'ollama';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // For local LLMs (LM Studio, Ollama)
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  supportsTools?: boolean; // Whether the model supports tool/function calling
}

// OpenRouter models that support tool calling
export const OPENROUTER_MODELS: AIModelOption[] = [
  // Anthropic via OpenRouter (Claude 4.5 series - latest)
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'openrouter', supportsTools: true },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'openrouter', supportsTools: true },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'openrouter', supportsTools: true },
  // Anthropic via OpenRouter (Claude 4 series)
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter', supportsTools: true },
  // OpenAI via OpenRouter (latest models)
  { id: 'openai/gpt-5', name: 'GPT-5', provider: 'openrouter', supportsTools: true },
  { id: 'openai/o3', name: 'OpenAI o3', provider: 'openrouter', supportsTools: true },
  { id: 'openai/o4-mini', name: 'OpenAI o4-mini', provider: 'openrouter', supportsTools: true },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', supportsTools: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter', supportsTools: true },
  { id: 'openai/gpt-4.5', name: 'GPT-4.5', provider: 'openrouter', supportsTools: true },
  // Google via OpenRouter (Gemini 3 - latest)
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'openrouter', supportsTools: true },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'openrouter', supportsTools: true },
  // Google via OpenRouter (Gemini 2.5)
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'openrouter', supportsTools: true },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter', supportsTools: true },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'openrouter', supportsTools: true },
  // Meta Llama via OpenRouter
  { id: 'meta-llama/llama-4-70b', name: 'Llama 4 70B', provider: 'openrouter', supportsTools: true },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'openrouter', supportsTools: true },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'openrouter', supportsTools: true },
  // Mistral via OpenRouter
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'openrouter', supportsTools: true },
  { id: 'mistralai/mistral-medium', name: 'Mistral Medium', provider: 'openrouter', supportsTools: true },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'openrouter', supportsTools: true },
  // Qwen via OpenRouter
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'openrouter', supportsTools: true },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', supportsTools: true },
  // DeepSeek via OpenRouter
  { id: 'deepseek/deepseek-v4', name: 'DeepSeek V4', provider: 'openrouter', supportsTools: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'openrouter', supportsTools: true },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter', supportsTools: true },
  // Cohere via OpenRouter
  { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'openrouter', supportsTools: true },
  { id: 'cohere/command-r', name: 'Command R', provider: 'openrouter', supportsTools: true },
];

// Direct API models for native provider access
export const AI_MODELS: AIModelOption[] = [
  // OpenAI models (latest)
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', supportsTools: true },
  { id: 'o3', name: 'OpenAI o3', provider: 'openai', supportsTools: true },
  { id: 'o4-mini', name: 'OpenAI o4-mini', provider: 'openai', supportsTools: true },
  { id: 'gpt-4.5-preview', name: 'GPT-4.5', provider: 'openai', supportsTools: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', supportsTools: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true },
  // Anthropic models (Claude 4.5 series - latest)
  { id: 'claude-opus-4-5-20251124', name: 'Claude Opus 4.5', provider: 'anthropic', supportsTools: true },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', supportsTools: true },
  { id: 'claude-haiku-4-5-20251015', name: 'Claude Haiku 4.5', provider: 'anthropic', supportsTools: true },
  // Anthropic models (Claude 4 series)
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', supportsTools: true },
  // Google models (Gemini 3 - latest)
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', supportsTools: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'google', supportsTools: true },
  // Google models (Gemini 2.5)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', supportsTools: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', supportsTools: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', supportsTools: true },
];

// Common local models for LM Studio and Ollama
export const LOCAL_LLM_MODELS: AIModelOption[] = [
  // These are suggestions - actual models depend on what's installed locally
  // Click "Refresh" in settings to fetch available models from your local server
  { id: 'llama4', name: 'Llama 4', provider: 'ollama', supportsTools: true },
  { id: 'llama3.3', name: 'Llama 3.3', provider: 'ollama', supportsTools: true },
  { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', supportsTools: true },
  { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'ollama', supportsTools: true },
  { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', provider: 'ollama', supportsTools: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'ollama', supportsTools: true },
  { id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'ollama', supportsTools: true },
  { id: 'mistral', name: 'Mistral', provider: 'ollama', supportsTools: true },
  { id: 'mixtral', name: 'Mixtral', provider: 'ollama', supportsTools: true },
  { id: 'phi4', name: 'Phi-4', provider: 'ollama', supportsTools: true },
  { id: 'gemma2', name: 'Gemma 2', provider: 'ollama', supportsTools: true },
];

// Editor Tool Types for AI Agent
export interface EditorTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface EditorState {
  content: string;
  cursorPosition: number;
  selection: { start: number; end: number } | null;
}

// AI Agent Message Types
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ReviewRequest {
  content: string;
  focusAreas?: HighlightType[];
  aggressiveness?: AggressivenessLevel;
  writingContext?: string;
}

export interface ReviewResponse {
  suggestions: Suggestion[];
  summary?: string;
}

// Default Agent Configuration
export interface DefaultAgentConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

// Environment-based defaults (can be overridden via .env.local)
export const DEFAULT_AGENT_CONFIG: Partial<DefaultAgentConfig> = {
  provider: (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider) || 'openrouter',
  model: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'anthropic/claude-sonnet-4.5',
  // API key should be set via environment variable for security
  apiKey: process.env.NEXT_PUBLIC_DEFAULT_AI_API_KEY || '',
};

// ============================================
// Environment Variable Editor Types (.miku-env)
// ============================================

/**
 * Represents a single environment variable with metadata
 */
export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  comment?: string;
  isSecret: boolean;  // Whether to mask the value in UI
  group?: string;     // Optional grouping for organization
}

/**
 * Metadata for a .miku-env document
 */
export interface MikuEnvMetadata {
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Complete .miku-env document structure
 */
export interface MikuEnvDocument {
  version: string;
  metadata: MikuEnvMetadata;
  variables: EnvVariable[];
}

/**
 * File type detection for the editor
 */
export type FileType = 'markdown' | 'miku-env' | 'kanban' | 'docs';

/**
 * Export format options for env files
 */
export type EnvExportFormat = 'env' | 'json' | 'yaml';

// ============================================
// Kanban Board Types (.kanban)
// ============================================

/**
 * Task state follows a simple three-state model.
 * Unlike binary checkboxes, this allows tracking work-in-progress.
 */
export type TaskState = 'todo' | 'in-progress' | 'done';

/**
 * A task is a single checklist item within a card.
 * Tasks are intentionally simple: text and state only.
 */
export interface KanbanTask {
  id: string;           // Unique within the board, format: "task-{counter}-{timestamp}-{random}"
  text: string;         // Task description, single line, max 500 chars
  state: TaskState;     // Current completion state
}

/**
 * Color palette for card labels.
 * Limited set for visual consistency.
 */
export type KanbanCardColor =
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

/**
 * A card represents a unit of work.
 * Cards can optionally contain sub-tasks for breaking down work.
 */
export interface KanbanCard {
  id: string;           // Unique within the board, format: "card-{counter}-{timestamp}-{random}"
  title: string;        // Card title, single line, max 200 chars
  description?: string; // Optional multi-line description, max 2000 chars
  tasks: KanbanTask[];  // Sub-tasks, can be empty
  color?: KanbanCardColor; // Optional color label
  createdAt?: string;   // ISO 8601 timestamp (optional for idempotent parsing)
  updatedAt?: string;   // ISO 8601 timestamp (optional for idempotent parsing)
}

/**
 * A column is a vertical container for cards.
 * Columns have a fixed order defined by their position in the array.
 */
export interface KanbanColumn {
  id: string;           // Unique within the board, format: "col-{counter}-{timestamp}-{random}"
  title: string;        // Column title, max 50 chars
  cards: KanbanCard[];  // Cards in display order (top to bottom)
}

/**
 * Board metadata for display and identification.
 */
export interface KanbanMetadata {
  name?: string;        // Board name (defaults to filename)
  description?: string; // Board description
  createdAt?: string;   // ISO 8601 timestamp
  updatedAt?: string;   // ISO 8601 timestamp
}

/**
 * Complete kanban document structure.
 * This is what gets serialized to/from the .kanban file.
 */
export interface KanbanDocument {
  version: string;              // Format version, currently "1.0"
  metadata: KanbanMetadata;     // Board-level metadata
  columns: KanbanColumn[];      // Columns in display order (left to right)
}

// ============================================
// SimpleDocs Types (.docs)
// ============================================

/**
 * Metadata for a SimpleDocs document
 */
export interface DocsMetadata {
  name?: string;                // Display name for the docs collection
  description?: string;         // Optional description
  createdAt?: string;           // ISO 8601 timestamp (optional for idempotent parsing)
  updatedAt?: string;           // ISO 8601 timestamp (optional for idempotent parsing)
}

/**
 * Reference to a single GitHub file
 * Parsed from URLs like: https://github.com/owner/repo/blob/branch/path/to/file.md
 */
export interface GitHubFileSource {
  owner: string;
  repo: string;
  branch: string;               // Could be branch name, tag, or commit SHA
  path: string;                 // Full path within repo
}

/**
 * Reference to a GitHub folder
 * Parsed from URLs like: https://github.com/owner/repo/tree/branch/docs
 */
export interface GitHubFolderSource {
  owner: string;
  repo: string;
  branch: string;
  path: string;                 // Folder path within repo
}

/**
 * Base entry properties shared by all entry types
 */
interface BaseEntry {
  id: string;                   // Unique ID: "entry-{counter}-{timestamp}-{random}"
  title: string;                // Display title
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
}

/**
 * Entry created by pasting markdown directly
 * Content is stored inline since it's user-provided and likely small
 */
export interface PastedEntry extends BaseEntry {
  type: 'pasted';
  content: string;              // Raw markdown content (stored inline)
}

/**
 * Entry imported from a single GitHub file
 */
export interface GitHubFileEntry extends BaseEntry {
  type: 'github-file';
  source: GitHubFileSource;
  cacheKey: string;             // Key to retrieve content from cache
  lastFetched: string;          // ISO 8601 timestamp of last successful fetch
  lastCommitSha?: string;       // SHA of the commit when last fetched
}

/**
 * File entry within a GitHub folder import
 */
export interface GitHubFolderFile {
  path: string;                 // Relative path within folder (e.g., "getting-started/intro.md")
  title: string;                // Extracted from first heading or filename
  cacheKey: string;             // Key to retrieve content from cache
  sha: string;                  // File SHA for change detection
}

/**
 * Entry imported from a GitHub folder
 * Contains multiple files organized hierarchically
 */
export interface GitHubFolderEntry extends BaseEntry {
  type: 'github-folder';
  source: GitHubFolderSource;
  files: GitHubFolderFile[];    // Flat list of files in the folder
  lastFetched: string;          // ISO 8601 timestamp
  lastCommitSha?: string;       // SHA of the commit when last fetched
}

/**
 * Discriminated union for all entry types
 */
export type DocsEntry = PastedEntry | GitHubFileEntry | GitHubFolderEntry;

/**
 * Root document structure stored in .docs files
 * This is the manifest that references cached content
 */
export interface DocsDocument {
  version: string;              // Format version, "1.0"
  metadata: DocsMetadata;
  entries: DocsEntry[];
}

/**
 * Cache entry stored in app data directory
 * Location: {appDataDir}/miku/docs-cache/{cacheKey}.json
 */
export interface DocsCacheEntry {
  cacheKey: string;
  content: string;              // Raw markdown content
  fetchedAt: string;            // ISO 8601 timestamp
  source: GitHubFileSource;     // Original source for re-fetch
  etag?: string;                // HTTP ETag for conditional requests
  sha?: string;                 // Git blob SHA
}

/**
 * Cache index for quick lookups
 * Location: {appDataDir}/miku/docs-cache/index.json
 */
export interface DocsCacheIndex {
  version: string;
  entries: {
    [cacheKey: string]: {
      size: number;             // Content size in bytes
      fetchedAt: string;
      accessedAt: string;       // Last access time for LRU eviction
    };
  };
  totalSize: number;            // Total cache size in bytes
}

/**
 * GitHub URL type detection result
 */
export type GitHubUrlType = 'file' | 'folder' | 'invalid';

/**
 * Result of parsing a GitHub URL
 */
export type GitHubUrlParseResult =
  | { type: 'file'; source: GitHubFileSource }
  | { type: 'folder'; source: GitHubFolderSource };

/**
 * Sync status for UI feedback
 */
export type DocsSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * Result of syncing a single entry
 */
export interface DocsSyncResult {
  entryId: string;
  status: 'unchanged' | 'updated' | 'error';
  error?: string;
}

/**
 * Options for fetching GitHub content
 */
export interface DocsFetchOptions {
  authToken?: string;
  timeout?: number;             // Default: 30000ms
  useCache?: boolean;           // Default: true
}

/**
 * Options for fetching GitHub folders
 */
export interface DocsFolderFetchOptions extends DocsFetchOptions {
  maxFiles?: number;            // Default: 50
  maxDepth?: number;            // Default: 3
  onProgress?: (fetched: number, total: number) => void;
}

/**
 * Result of fetching a single file
 */
export interface DocsFetchResult {
  success: boolean;
  content?: string;
  error?: string;
  rateLimitReset?: Date;        // If rate limited
  fromCache?: boolean;
  sha?: string;
  etag?: string;
}

/**
 * Result of fetching a folder
 */
export interface DocsFolderFetchResult {
  success: boolean;
  files?: GitHubFolderFile[];
  error?: string;
  rateLimitReset?: Date;
}
