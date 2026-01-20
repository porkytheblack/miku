'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MikuState, Suggestion, MikuStatus } from '@/types';
import { analyzeSuggestions } from '@/lib/analyzer';

interface MikuContextType {
  state: MikuState;
  requestReview: (text: string) => void;
  setActiveSuggestion: (id: string | null) => void;
  acceptSuggestion: (id: string) => string | null;
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;
}

const initialState: MikuState = {
  status: 'idle',
  suggestions: [],
  activeSuggestionId: null,
};

const MikuContext = createContext<MikuContextType | undefined>(undefined);

export function MikuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MikuState>(initialState);

  const requestReview = useCallback((text: string) => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, status: 'idle', suggestions: [] }));
      return;
    }

    setState(prev => ({ ...prev, status: 'thinking' }));

    // Simulate AI analysis delay
    setTimeout(() => {
      const suggestions = analyzeSuggestions(text);
      setState(prev => ({
        ...prev,
        status: suggestions.length > 0 ? 'ready' : 'idle',
        suggestions,
      }));
    }, 1500);
  }, []);

  const setActiveSuggestion = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, activeSuggestionId: id }));
  }, []);

  const acceptSuggestion = useCallback((id: string): string | null => {
    const suggestion = state.suggestions.find(s => s.id === id);
    if (!suggestion) return null;

    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.filter(s => s.id !== id),
      activeSuggestionId: null,
      status: prev.suggestions.length <= 1 ? 'idle' : prev.status,
    }));

    return suggestion.suggestedRevision;
  }, [state.suggestions]);

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
