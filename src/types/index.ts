export type Theme = 'light' | 'dark' | 'system';

export type HighlightType = 'clarity' | 'grammar' | 'style' | 'structure' | 'economy';

export interface Suggestion {
  id: string;
  type: HighlightType;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
  originalText: string;
  observation: string;
  suggestedRevision: string;
}

export interface EditorSettings {
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  editorWidth: number;
  fontFamily: 'mono' | 'sans';
}

export type MikuStatus = 'idle' | 'thinking' | 'ready' | 'error';

export interface MikuState {
  status: MikuStatus;
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
  error: string | null;
}

// AI Provider Types
export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
}

export const AI_MODELS: AIModelOption[] = [
  // OpenAI models
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
  // Anthropic models
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
  // Google models
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
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
