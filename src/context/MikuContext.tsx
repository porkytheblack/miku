'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { MikuState, AIProviderConfig, HighlightType } from '@/types';
import { createMikuAgent, MikuAgent } from '@/lib/ai/agent';
import { analyzeSuggestions } from '@/lib/analyzer';

interface MikuContextType {
  state: MikuState;
  requestReview: (text: string, focusAreas?: HighlightType[]) => void;
  setActiveSuggestion: (id: string | null) => void;
  acceptSuggestion: (id: string) => string | null;
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;
  setAIConfig: (config: AIProviderConfig | null) => void;
  aiConfig: AIProviderConfig | null;
}

const initialState: MikuState = {
  status: 'idle',
  suggestions: [],
  activeSuggestionId: null,
  error: null,
};

const MikuContext = createContext<MikuContextType | undefined>(undefined);

export function MikuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MikuState>(initialState);
  const [aiConfig, setAIConfigState] = useState<AIProviderConfig | null>(null);
  const agentRef = useRef<MikuAgent | null>(null);

  const setAIConfig = useCallback((config: AIProviderConfig | null) => {
    setAIConfigState(config);
    if (config) {
      agentRef.current = createMikuAgent(config.provider, config.apiKey, config.model);
    } else {
      agentRef.current = null;
    }
  }, []);

  const requestReview = useCallback(async (text: string, focusAreas?: HighlightType[]) => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, status: 'idle', suggestions: [], error: null }));
      return;
    }

    setState(prev => ({ ...prev, status: 'thinking', error: null }));

    // If we have an AI agent configured, use it
    if (agentRef.current) {
      try {
        const response = await agentRef.current.review({
          content: text,
          focusAreas,
        });

        setState(prev => ({
          ...prev,
          status: response.suggestions.length > 0 ? 'ready' : 'idle',
          suggestions: response.suggestions,
          error: null,
        }));
      } catch (error) {
        console.error('AI review error:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to review',
        }));
      }
    } else {
      // Fall back to local analysis
      setTimeout(() => {
        const suggestions = analyzeSuggestions(text);
        setState(prev => ({
          ...prev,
          status: suggestions.length > 0 ? 'ready' : 'idle',
          suggestions,
          error: null,
        }));
      }, 1000);
    }
  }, []);

  const setActiveSuggestion = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, activeSuggestionId: id }));
  }, []);

  const acceptSuggestion = useCallback((id: string): string | null => {
    let result: string | null = null;
    setState(prev => {
      const suggestion = prev.suggestions.find(s => s.id === id);
      if (suggestion) {
        result = suggestion.suggestedRevision;
      }
      return {
        ...prev,
        suggestions: prev.suggestions.filter(s => s.id !== id),
        activeSuggestionId: null,
        status: prev.suggestions.length <= 1 ? 'idle' : prev.status,
      };
    });
    return result;
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.filter(s => s.id !== id),
      activeSuggestionId: null,
      status: prev.suggestions.length <= 1 ? 'idle' : prev.status,
    }));
  }, []);

  const clearSuggestions = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: [],
      activeSuggestionId: null,
      status: 'idle',
      error: null,
    }));
  }, []);

  return (
    <MikuContext.Provider
      value={{
        state,
        requestReview,
        setActiveSuggestion,
        acceptSuggestion,
        dismissSuggestion,
        clearSuggestions,
        setAIConfig,
        aiConfig,
      }}
    >
      {children}
    </MikuContext.Provider>
  );
}

export function useMiku() {
  const context = useContext(MikuContext);
  if (!context) {
    throw new Error('useMiku must be used within a MikuProvider');
  }
  return context;
}
