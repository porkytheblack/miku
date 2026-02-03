'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { MikuState, AIProviderConfig, HighlightType, DEFAULT_AGENT_CONFIG, AggressivenessLevel, Suggestion } from '@/types';
import { createMikuAgent, MikuAgent } from '@/lib/ai/agent';
import { analyzeSuggestions } from '@/lib/analyzer';

// Simple hash function for content comparison
function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

interface ReviewOptions {
  focusAreas?: HighlightType[];
  aggressiveness?: AggressivenessLevel;
  writingContext?: string;
  forceReview?: boolean;
}

interface RewriteResult {
  rewrittenText: string;
  startIndex: number;
  endIndex: number;
}

interface MikuContextType {
  state: MikuState;
  activeDocumentId: string | null;
  setActiveDocumentId: (id: string | null) => void;
  requestReview: (text: string, options?: ReviewOptions) => void;
  requestRewrite: (text: string, startIndex: number, endIndex: number) => Promise<RewriteResult | null>;
  setActiveSuggestion: (id: string | null) => void;
  acceptSuggestion: (id: string) => string | null;
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;
  updateSuggestions: (suggestions: Suggestion[]) => void;
  setAIConfig: (config: AIProviderConfig | null) => void;
  aiConfig: AIProviderConfig | null;
  isUsingDefaults: boolean;
  reviewedHashes: Set<string>;
  clearReviewedHashes: () => void;
  clearDocumentState: (documentId: string) => void;
}

const initialState: MikuState = {
  status: 'idle',
  suggestions: [],
  activeSuggestionId: null,
  error: null,
};

const MikuContext = createContext<MikuContextType | undefined>(undefined);

// Per-document state storage
interface DocumentMikuState {
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
  reviewedHashes: Set<string>;
}

export function MikuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MikuState>(initialState);
  const [aiConfig, setAIConfigState] = useState<AIProviderConfig | null>(null);
  const [isUsingDefaults, setIsUsingDefaults] = useState(false);
  const [reviewedHashes, setReviewedHashes] = useState<Set<string>>(new Set());
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Per-document state storage - keyed by document ID
  const documentStatesRef = useRef<Map<string, DocumentMikuState>>(new Map());

  const agentRef = useRef<MikuAgent | null>(null);
  const initializedRef = useRef(false);

  // Refs to track current state for saving without causing callback reference changes
  const activeDocumentIdRef = useRef<string | null>(null);
  const stateRef = useRef<MikuState>(initialState);
  const reviewedHashesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    activeDocumentIdRef.current = activeDocumentId;
  }, [activeDocumentId]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    reviewedHashesRef.current = reviewedHashes;
  }, [reviewedHashes]);

  // When active document changes, restore that document's state
  // Uses refs to access current values without adding them as dependencies
  const handleSetActiveDocumentId = useCallback((id: string | null) => {
    // Avoid unnecessary updates if ID hasn't changed
    if (id === activeDocumentIdRef.current) {
      return;
    }

    // Save current document's state before switching (using refs for current values)
    const currentDocId = activeDocumentIdRef.current;
    if (currentDocId) {
      documentStatesRef.current.set(currentDocId, {
        suggestions: stateRef.current.suggestions,
        activeSuggestionId: stateRef.current.activeSuggestionId,
        reviewedHashes: new Set(reviewedHashesRef.current),
      });
    }

    setActiveDocumentId(id);

    // Restore the new document's state
    if (id) {
      const savedState = documentStatesRef.current.get(id);
      if (savedState) {
        setState(prev => ({
          ...prev,
          suggestions: savedState.suggestions,
          activeSuggestionId: savedState.activeSuggestionId,
        }));
        setReviewedHashes(savedState.reviewedHashes);
      } else {
        // New document - reset state
        setState(prev => ({
          ...prev,
          suggestions: [],
          activeSuggestionId: null,
          status: 'idle',
          error: null,
        }));
        setReviewedHashes(new Set());
      }
    }
  }, []); // Empty dependency array - callback reference is now stable

  // Clean up document state when document is closed
  const clearDocumentState = useCallback((documentId: string) => {
    documentStatesRef.current.delete(documentId);
  }, []);

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
      agentRef.current = createMikuAgent(config.provider, config.apiKey, config.model, config.baseUrl);
      // Save to localStorage
      try {
        localStorage.setItem('miku-ai-config', JSON.stringify({
          provider: config.provider,
          model: config.model,
          baseUrl: config.baseUrl,
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

  const clearReviewedHashes = useCallback(() => {
    setReviewedHashes(new Set());
  }, []);

  const requestReview = useCallback(async (text: string, options?: ReviewOptions) => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, status: 'idle', suggestions: [], error: null }));
      return;
    }

    // Check if this content has already been reviewed (unless forced)
    const contentHash = hashContent(text);
    if (!options?.forceReview && reviewedHashes.has(contentHash)) {
      // Content already reviewed, skip
      return;
    }

    setState(prev => ({ ...prev, status: 'thinking', error: null }));

    // If we have an AI agent configured, use it
    if (agentRef.current) {
      try {
        const response = await agentRef.current.review({
          content: text,
          focusAreas: options?.focusAreas,
          aggressiveness: options?.aggressiveness,
          writingContext: options?.writingContext,
        });

        // Mark this content as reviewed
        setReviewedHashes(prev => new Set(prev).add(contentHash));

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
        const suggestions = analyzeSuggestions(text, options?.aggressiveness);

        // Mark this content as reviewed
        setReviewedHashes(prev => new Set(prev).add(contentHash));

        setState(prev => ({
          ...prev,
          status: suggestions.length > 0 ? 'ready' : 'idle',
          suggestions,
          error: null,
        }));
      }, 1000);
    }
  }, [reviewedHashes]);

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

  const updateSuggestions = useCallback((suggestions: Suggestion[]) => {
    setState(prev => ({
      ...prev,
      suggestions,
      // Clear active suggestion if it no longer exists
      activeSuggestionId: suggestions.some(s => s.id === prev.activeSuggestionId)
        ? prev.activeSuggestionId
        : null,
    }));
  }, []);

  const requestRewrite = useCallback(async (
    text: string,
    startIndex: number,
    endIndex: number
  ): Promise<RewriteResult | null> => {
    if (!text.trim()) return null;

    setState(prev => ({ ...prev, status: 'thinking', error: null }));

    if (agentRef.current) {
      try {
        const response = await agentRef.current.rewrite(text);

        setState(prev => ({ ...prev, status: 'idle', error: null }));

        return {
          rewrittenText: response,
          startIndex,
          endIndex,
        };
      } catch (error) {
        console.error('AI rewrite error:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to rewrite',
        }));
        return null;
      }
    } else {
      // No AI configured - just return the original text
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'No AI provider configured for rewrite',
      }));
      return null;
    }
  }, []);

  return (
    <MikuContext.Provider
      value={{
        state,
        activeDocumentId,
        setActiveDocumentId: handleSetActiveDocumentId,
        requestReview,
        requestRewrite,
        setActiveSuggestion,
        acceptSuggestion,
        dismissSuggestion,
        clearSuggestions,
        updateSuggestions,
        setAIConfig,
        aiConfig,
        isUsingDefaults,
        reviewedHashes,
        clearReviewedHashes,
        clearDocumentState,
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
