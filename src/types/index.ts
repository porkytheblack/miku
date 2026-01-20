export type Theme = 'light' | 'dark' | 'system';

export type HighlightType = 'clarity' | 'grammar' | 'style' | 'structure' | 'economy';

export interface Suggestion {
  id: string;
  type: HighlightType;
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

export type MikuStatus = 'idle' | 'thinking' | 'ready';

export interface MikuState {
  status: MikuStatus;
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
}
