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
export type FileType = 'markdown' | 'miku-env';

/**
 * Export format options for env files
 */
export type EnvExportFormat = 'env' | 'json' | 'yaml';
