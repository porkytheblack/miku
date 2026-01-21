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
  // Anthropic via OpenRouter
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter', supportsTools: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', supportsTools: true },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'openrouter', supportsTools: true },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'openrouter', supportsTools: true },
  // OpenAI via OpenRouter
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', supportsTools: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter', supportsTools: true },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openrouter', supportsTools: true },
  { id: 'openai/o1', name: 'OpenAI o1', provider: 'openrouter', supportsTools: true },
  { id: 'openai/o1-mini', name: 'OpenAI o1 Mini', provider: 'openrouter', supportsTools: true },
  // Google via OpenRouter
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'openrouter', supportsTools: true },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'openrouter', supportsTools: true },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'openrouter', supportsTools: true },
  // Meta Llama via OpenRouter
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'openrouter', supportsTools: true },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'openrouter', supportsTools: true },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'openrouter', supportsTools: true },
  // Mistral via OpenRouter
  { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', provider: 'openrouter', supportsTools: true },
  { id: 'mistralai/mistral-medium', name: 'Mistral Medium', provider: 'openrouter', supportsTools: true },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'openrouter', supportsTools: true },
  // Qwen via OpenRouter
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'openrouter', supportsTools: true },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', supportsTools: true },
  // DeepSeek via OpenRouter
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'openrouter', supportsTools: true },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter', supportsTools: true },
  // Cohere via OpenRouter
  { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'openrouter', supportsTools: true },
  { id: 'cohere/command-r', name: 'Command R', provider: 'openrouter', supportsTools: true },
];

// Direct API models (legacy, kept for backwards compatibility)
export const AI_MODELS: AIModelOption[] = [
  // OpenAI models
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', supportsTools: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsTools: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', supportsTools: true },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', supportsTools: true },
  // Anthropic models
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', supportsTools: true },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', supportsTools: true },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', supportsTools: true },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', supportsTools: true },
  // Google models
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', supportsTools: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', supportsTools: true },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', supportsTools: true },
];

// Common local models for LM Studio and Ollama
export const LOCAL_LLM_MODELS: AIModelOption[] = [
  // These are suggestions - actual models depend on what's installed
  { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', supportsTools: true },
  { id: 'llama3.1', name: 'Llama 3.1', provider: 'ollama', supportsTools: true },
  { id: 'mistral', name: 'Mistral', provider: 'ollama', supportsTools: true },
  { id: 'mixtral', name: 'Mixtral', provider: 'ollama', supportsTools: true },
  { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'ollama', supportsTools: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'ollama', supportsTools: true },
  { id: 'codellama', name: 'Code Llama', provider: 'ollama', supportsTools: false },
  { id: 'phi3', name: 'Phi-3', provider: 'ollama', supportsTools: true },
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
  provider: (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider) || 'anthropic',
  model: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'claude-sonnet-4-20250514',
  // API key should be set via environment variable for security
  apiKey: process.env.NEXT_PUBLIC_DEFAULT_AI_API_KEY || '',
};
