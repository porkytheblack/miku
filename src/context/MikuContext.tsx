'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { MikuState, AIProviderConfig, HighlightType, DEFAULT_AGENT_CONFIG } from '@/types';
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
  isUsingDefaults: boolean;
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
  const [isUsingDefaults, setIsUsingDefaults] = useState(false);
  const agentRef = useRef<MikuAgent | null>(null);
  const initializedRef = useRef(false);

  // Initialize with defaults on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Check for saved config first
    try {
      const savedConfig = localStorage.getItem('miku-ai-config');
      const savedKeys = localStorage.getItem('miku-api-keys');

      if (savedConfig && savedKeys) {
        const config = JSON.parse(savedConfig);
        const keys = JSON.parse(savedKeys);
        const apiKey = keys[config.provider];

        if (apiKey) {
          setAIConfigState(config);
          agentRef.current = createMikuAgent(config.provider, apiKey, config.model);
          setIsUsingDefaults(false);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load saved config:', e);
    }

    // Fall back to environment defaults
    if (DEFAULT_AGENT_CONFIG.apiKey && DEFAULT_AGENT_CONFIG.provider && DEFAULT_AGENT_CONFIG.model) {
      const defaultConfig: AIProviderConfig = {
        provider: DEFAULT_AGENT_CONFIG.provider,
        model: DEFAULT_AGENT_CONFIG.model,
        apiKey: DEFAULT_AGENT_CONFIG.apiKey,
      };
      setAIConfigState(defaultConfig);
      agentRef.current = createMikuAgent(
        defaultConfig.provider,
        defaultConfig.apiKey,
        defaultConfig.model
      );
      setIsUsingDefaults(true);
    }
  }, []);

  const setAIConfig = useCallback((config: AIProviderConfig | null) => {
    setAIConfigState(config);
    setIsUsingDefaults(false);
    if (config) {
      agentRef.current = createMikuAgent(config.provider, config.apiKey, config.model);
      // Save to localStorage
      try {
        localStorage.setItem('miku-ai-config', JSON.stringify({
          provider: config.provider,
          model: config.model,
        }));
      } catch (e) {
        console.error('Failed to save config:', e);
      }
    } else {
      agentRef.current = null;
      try {
        localStorage.removeItem('miku-ai-config');
      } catch (e) {
        console.error('Failed to clear config:', e);
      }
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
        isUsingDefaults,
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
