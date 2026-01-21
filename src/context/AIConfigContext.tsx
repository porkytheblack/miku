'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AIProvider, AIProviderConfig, AI_MODELS, OPENROUTER_MODELS, LOCAL_LLM_MODELS } from '@/types';

interface AIConfigContextType {
  config: AIProviderConfig | null;
  isConfigured: boolean;
  setConfig: (config: AIProviderConfig) => void;
  clearConfig: () => void;
  getApiKeys: () => Record<AIProvider, string>;
  setApiKey: (provider: AIProvider, key: string) => void;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

const STORAGE_KEY = 'miku-ai-config';
const API_KEYS_STORAGE_KEY = 'miku-api-keys';

export function AIConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AIProviderConfig | null>(null);
  const [apiKeys, setApiKeysState] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    google: '',
    openrouter: '',
    ollama: '',
    lmstudio: '',
  });
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      const savedKeys = localStorage.getItem(API_KEYS_STORAGE_KEY);

      if (savedKeys) {
        setApiKeysState(JSON.parse(savedKeys));
      }

      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // Validate that the model still exists in any model list
        const allModels = [...AI_MODELS, ...OPENROUTER_MODELS, ...LOCAL_LLM_MODELS];
        const modelExists = allModels.some(m => m.id === parsed.model);
        // For local providers, always allow as the model might be custom
        const isLocalProvider = parsed.provider === 'ollama' || parsed.provider === 'lmstudio';
        if (modelExists || isLocalProvider) {
          setConfigState(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load AI config:', e);
    }
    setLoaded(true);
  }, []);

  // Save to localStorage when config changes
  useEffect(() => {
    if (!loaded) return;
    try {
      if (config) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save AI config:', e);
    }
  }, [config, loaded]);

  // Save API keys
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
    } catch (e) {
      console.error('Failed to save API keys:', e);
    }
  }, [apiKeys, loaded]);

  const setConfig = (newConfig: AIProviderConfig) => {
    setConfigState(newConfig);
  };

  const clearConfig = () => {
    setConfigState(null);
  };

  const getApiKeys = () => apiKeys;

  const setApiKey = (provider: AIProvider, key: string) => {
    setApiKeysState(prev => ({
      ...prev,
      [provider]: key,
    }));
  };

  // Local providers don't require API keys
  const isLocalProvider = config?.provider === 'ollama' || config?.provider === 'lmstudio';
  const isConfigured = config !== null && (isLocalProvider || config.apiKey.length > 0);

  return (
    <AIConfigContext.Provider
      value={{
        config,
        isConfigured,
        setConfig,
        clearConfig,
        getApiKeys,
        setApiKey,
      }}
    >
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig() {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error('useAIConfig must be used within an AIConfigProvider');
  }
  return context;
}
