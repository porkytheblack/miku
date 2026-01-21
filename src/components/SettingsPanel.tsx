'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import { Theme, AIProvider, AI_MODELS, OPENROUTER_MODELS, LOCAL_LLM_MODELS, AIModelOption, ReviewMode, AggressivenessLevel } from '@/types';

interface SettingsPanelProps {
  onClose: () => void;
}

// Default base URLs for local providers
const DEFAULT_BASE_URLS: Partial<Record<AIProvider, string>> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234/v1',
};

// Provider display names
const PROVIDER_NAMES: Record<AIProvider, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
};

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const { setAIConfig, aiConfig } = useMiku();
  const panelRef = useRef<HTMLDivElement>(null);

  // Local state for API keys (not saved until Apply is clicked)
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    google: '',
    openrouter: '',
    ollama: '',
    lmstudio: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    aiConfig?.provider || 'openrouter'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    aiConfig?.model || 'anthropic/claude-sonnet-4'
  );
  const [baseUrl, setBaseUrl] = useState<string>(
    aiConfig?.baseUrl || ''
  );
  const [customModel, setCustomModel] = useState<string>('');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  // Load saved API keys and base URLs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('miku-api-keys');
      if (saved) {
        const parsed = JSON.parse(saved);
        setApiKeys(prev => ({ ...prev, ...parsed }));
      }
      const savedBaseUrls = localStorage.getItem('miku-base-urls');
      if (savedBaseUrls) {
        const parsed = JSON.parse(savedBaseUrls);
        if (parsed[selectedProvider]) {
          setBaseUrl(parsed[selectedProvider]);
        }
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Get models based on provider
  const getModelsForProvider = useCallback((provider: AIProvider): AIModelOption[] => {
    switch (provider) {
      case 'openrouter':
        return OPENROUTER_MODELS;
      case 'ollama':
      case 'lmstudio':
        // For local LLMs, combine suggestions with fetched models
        const localOptions: AIModelOption[] = localModels.map(m => ({
          id: m,
          name: m,
          provider,
          supportsTools: true,
        }));
        // Add suggestions if no local models loaded
        if (localOptions.length === 0) {
          return LOCAL_LLM_MODELS.map(m => ({ ...m, provider }));
        }
        return localOptions;
      default:
        return AI_MODELS.filter(m => m.provider === provider);
    }
  }, [localModels]);

  // Filter models by selected provider
  const availableModels = getModelsForProvider(selectedProvider);

  // Fetch models from local LLM server
  const fetchLocalModels = useCallback(async () => {
    const url = baseUrl || DEFAULT_BASE_URLS[selectedProvider] || '';
    if (!url) return;

    setIsLoadingModels(true);
    setModelLoadError(null);

    try {
      let models: string[] = [];

      if (selectedProvider === 'ollama') {
        // Ollama uses /api/tags endpoint
        const response = await fetch(`${url}/api/tags`);
        if (!response.ok) throw new Error('Failed to connect to Ollama');
        const data = await response.json();
        models = data.models?.map((m: { name: string }) => m.name) || [];
      } else if (selectedProvider === 'lmstudio') {
        // LM Studio uses OpenAI-compatible /models endpoint
        const response = await fetch(`${url}/models`);
        if (!response.ok) throw new Error('Failed to connect to LM Studio');
        const data = await response.json();
        models = data.data?.map((m: { id: string }) => m.id) || [];
      }

      setLocalModels(models);
      if (models.length > 0 && !models.includes(selectedModel)) {
        setSelectedModel(models[0]);
      }
    } catch (error) {
      console.error('Failed to fetch local models:', error);
      setModelLoadError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setIsLoadingModels(false);
    }
  }, [baseUrl, selectedProvider, selectedModel]);

  // Update selected model when provider changes
  useEffect(() => {
    // Reset local models when switching providers
    setLocalModels([]);
    setModelLoadError(null);

    // Set default base URL for local providers
    if (selectedProvider === 'ollama' || selectedProvider === 'lmstudio') {
      setBaseUrl(prev => prev || DEFAULT_BASE_URLS[selectedProvider] || '');
    } else {
      setBaseUrl('');
    }

    // Update selected model to first available for new provider
    const models = getModelsForProvider(selectedProvider);
    const currentModelInList = models.find(m => m.id === selectedModel);
    if (!currentModelInList && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [selectedProvider, getModelsForProvider]);

  const handleSaveAPIConfig = () => {
    const apiKey = apiKeys[selectedProvider];
    const isLocalProvider = selectedProvider === 'ollama' || selectedProvider === 'lmstudio';

    // Local providers don't need API keys
    if (apiKey || isLocalProvider) {
      // Save API keys to localStorage
      try {
        localStorage.setItem('miku-api-keys', JSON.stringify(apiKeys));
        // Save base URLs for local providers
        const savedBaseUrls = localStorage.getItem('miku-base-urls');
        const baseUrls = savedBaseUrls ? JSON.parse(savedBaseUrls) : {};
        if (baseUrl) {
          baseUrls[selectedProvider] = baseUrl;
        }
        localStorage.setItem('miku-base-urls', JSON.stringify(baseUrls));
      } catch (e) {
        console.error('Failed to save API keys:', e);
      }

      // Use custom model if specified, otherwise use selected
      const modelToUse = customModel.trim() || selectedModel;

      // Set the AI config
      setAIConfig({
        provider: selectedProvider,
        apiKey: apiKey || '',
        model: modelToUse,
        baseUrl: baseUrl || undefined,
      });
    }
  };

  const handleClearAPIConfig = () => {
    setAIConfig(null);
  };

  const currentApiKey = apiKeys[selectedProvider];
  const isConfigured = aiConfig !== null && aiConfig.provider === selectedProvider;
  const isLocalProvider = selectedProvider === 'ollama' || selectedProvider === 'lmstudio';
  const requiresApiKey = !isLocalProvider;

  // Find model name for display
  const findModelName = (modelId: string): string => {
    const allModels = [...AI_MODELS, ...OPENROUTER_MODELS, ...LOCAL_LLM_MODELS];
    return allModels.find(m => m.id === modelId)?.name || modelId;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md overflow-y-auto animate-in fade-in zoom-in-95"
        style={{
          maxHeight: '85vh',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <h2
            className="font-semibold"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label="Close settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ color: 'var(--text-secondary)' }}
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* AI Configuration section */}
          <section>
            <h3
              className="mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              AI Configuration
            </h3>

            {/* Provider selection */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Provider
              </label>
              {/* Cloud providers row */}
              <div className="flex gap-2 mb-2">
                {(['openrouter', 'openai', 'anthropic', 'google'] as AIProvider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => setSelectedProvider(provider)}
                    className="flex-1 py-2 px-2 rounded text-sm transition-colors"
                    style={{
                      background: selectedProvider === provider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: selectedProvider === provider ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                    }}
                  >
                    {PROVIDER_NAMES[provider]}
                  </button>
                ))}
              </div>
              {/* Local LLM providers row */}
              <div className="flex gap-2">
                {(['ollama', 'lmstudio'] as AIProvider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => setSelectedProvider(provider)}
                    className="flex-1 py-2 px-2 rounded text-sm transition-colors"
                    style={{
                      background: selectedProvider === provider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: selectedProvider === provider ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                    }}
                  >
                    {PROVIDER_NAMES[provider]}
                  </button>
                ))}
              </div>
            </div>

            {/* Base URL for local providers */}
            {isLocalProvider && (
              <div className="mb-4">
                <label
                  className="block mb-2"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Server URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder={DEFAULT_BASE_URLS[selectedProvider]}
                    className="flex-1 p-2 rounded"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                  <button
                    onClick={fetchLocalModels}
                    disabled={isLoadingModels}
                    className="px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      cursor: isLoadingModels ? 'wait' : 'pointer',
                    }}
                  >
                    {isLoadingModels ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                {modelLoadError && (
                  <p
                    className="mt-1"
                    style={{
                      color: 'var(--text-error, #ef4444)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    {modelLoadError}
                  </p>
                )}
                <p
                  className="mt-1"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {selectedProvider === 'ollama'
                    ? 'Make sure Ollama is running locally.'
                    : 'Make sure LM Studio server is running.'}
                </p>
              </div>
            )}

            {/* Model selection */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Model
              </label>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full p-2 rounded"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              {/* Custom model input for local providers */}
              {isLocalProvider && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="Or enter custom model name..."
                    className="w-full p-2 rounded"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* API Key input - only for cloud providers */}
            {requiresApiKey && (
              <div className="mb-4">
                <label
                  className="block mb-2"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={currentApiKey}
                  onChange={e => setApiKeys(prev => ({ ...prev, [selectedProvider]: e.target.value }))}
                  placeholder={`Enter your ${PROVIDER_NAMES[selectedProvider]} API key`}
                  className="w-full p-2 rounded"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                  }}
                />
                <p
                  className="mt-1"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {selectedProvider === 'openrouter'
                    ? 'Get your API key at openrouter.ai/keys'
                    : 'Your API key is stored locally and never sent to our servers.'}
                </p>
              </div>
            )}

            {/* Save/Clear buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveAPIConfig}
                disabled={requiresApiKey && !currentApiKey}
                className="flex-1 py-2 px-3 rounded text-sm font-medium transition-colors"
                style={{
                  background: (!requiresApiKey || currentApiKey) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: (!requiresApiKey || currentApiKey) ? 'white' : 'var(--text-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  cursor: (!requiresApiKey || currentApiKey) ? 'pointer' : 'not-allowed',
                }}
              >
                {isConfigured ? 'Update' : 'Apply'}
              </button>
              {aiConfig && (
                <button
                  onClick={handleClearAPIConfig}
                  className="py-2 px-3 rounded text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status indicator */}
            {aiConfig && (
              <div
                className="mt-3 p-2 rounded flex items-center gap-2"
                style={{
                  background: 'var(--accent-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--accent-primary)' }}
                />
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Using {findModelName(aiConfig.model)} ({PROVIDER_NAMES[aiConfig.provider]})
                </span>
              </div>
            )}
          </section>

          {/* Miku Behavior section */}
          <section>
            <h3
              className="mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              Miku Behavior
            </h3>

            {/* Review Mode */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Review Mode
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'manual', label: 'Manual (Cmd+Enter)' },
                  { value: 'auto', label: 'Auto' },
                ] as { value: ReviewMode; label: string }[]).map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => updateSettings({ reviewMode: mode.value })}
                    className="flex-1 py-2 px-3 rounded text-sm transition-colors"
                    style={{
                      background: settings.reviewMode === mode.value ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: settings.reviewMode === mode.value ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p
                className="mt-1"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {settings.reviewMode === 'manual'
                  ? 'Press Cmd+Enter or click Review to analyze your writing.'
                  : 'Miku will automatically review after you pause typing.'}
              </p>
            </div>

            {/* Aggressiveness */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Aggressiveness
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'gentle', label: 'Gentle' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'strict', label: 'Strict' },
                ] as { value: AggressivenessLevel; label: string }[]).map(level => (
                  <button
                    key={level.value}
                    onClick={() => updateSettings({ aggressiveness: level.value })}
                    className="flex-1 py-2 px-3 rounded text-sm transition-colors"
                    style={{
                      background: settings.aggressiveness === level.value ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: settings.aggressiveness === level.value ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
              <p
                className="mt-1"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {settings.aggressiveness === 'gentle'
                  ? 'Focus on major issues only, ignore minor style choices.'
                  : settings.aggressiveness === 'balanced'
                  ? 'Balance between helpfulness and respecting your style.'
                  : 'Thorough review of grammar, style, and clarity.'}
              </p>
            </div>

            {/* Writing Context */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Writing Context (optional)
              </label>
              <textarea
                value={settings.writingContext}
                onChange={e => updateSettings({ writingContext: e.target.value })}
                placeholder="e.g., Technical blog post, Academic essay, Creative fiction..."
                rows={2}
                className="w-full p-2 rounded resize-none"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <p
                className="mt-1"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                Help Miku understand what you&apos;re writing for better suggestions.
              </p>
            </div>
          </section>

          {/* Appearance section */}
          <section>
            <h3
              className="mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              Appearance
            </h3>

            {/* Theme */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Theme
              </label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as Theme[]).map(theme => (
                  <button
                    key={theme}
                    onClick={() => updateSettings({ theme })}
                    className="flex-1 py-2 px-3 rounded text-sm capitalize transition-colors"
                    style={{
                      background: settings.theme === theme ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: settings.theme === theme ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Typography section */}
          <section>
            <h3
              className="mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              Typography
            </h3>

            {/* Font family */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Font
              </label>
              <div className="flex gap-2">
                {(['mono', 'sans'] as const).map(font => (
                  <button
                    key={font}
                    onClick={() => updateSettings({ fontFamily: font })}
                    className="flex-1 py-2 px-3 rounded text-sm capitalize transition-colors"
                    style={{
                      background: settings.fontFamily === font ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: settings.fontFamily === font ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {font === 'mono' ? 'Monospace' : 'Sans Serif'}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div className="mb-4">
              <label
                className="flex justify-between mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span>Font Size</span>
                <span style={{ color: 'var(--text-primary)' }}>{settings.fontSize}px</span>
              </label>
              <input
                type="range"
                min="14"
                max="24"
                value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-full accent-[var(--accent-primary)]"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
            </div>

            {/* Line height */}
            <div className="mb-4">
              <label
                className="flex justify-between mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span>Line Height</span>
                <span style={{ color: 'var(--text-primary)' }}>{settings.lineHeight.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="1.4"
                max="2.0"
                step="0.1"
                value={settings.lineHeight}
                onChange={e => updateSettings({ lineHeight: Number(e.target.value) })}
                className="w-full"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </section>

          {/* Editor section */}
          <section>
            <h3
              className="mb-3"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              Editor
            </h3>

            {/* Editor width */}
            <div className="mb-4">
              <label
                className="flex justify-between mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span>Max Width</span>
                <span style={{ color: 'var(--text-primary)' }}>{settings.editorWidth}px</span>
              </label>
              <input
                type="range"
                min="480"
                max="960"
                step="20"
                value={settings.editorWidth}
                onChange={e => updateSettings({ editorWidth: Number(e.target.value) })}
                className="w-full"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <p
            className="text-center"
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
            }}
          >
            Miku — The Editor That Listens
          </p>
        </div>
      </div>
    </div>
  );
}
