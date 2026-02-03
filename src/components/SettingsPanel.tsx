'use client';

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import { Theme, AIProvider, AI_MODELS, OPENROUTER_MODELS, LOCAL_LLM_MODELS, AIModelOption, ReviewMode, AggressivenessLevel } from '@/types';
import { useKeyboardSounds } from '@/hooks/useKeyboardSounds';

interface SettingsPanelProps {
  onClose: () => void;
}

// Settings categories
type SettingsCategory = 'ai' | 'behavior' | 'sounds' | 'appearance' | 'typography';

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

// Category configuration
const CATEGORIES: { id: SettingsCategory; label: string; icon: ReactNode }[] = [
  {
    id: 'ai',
    label: 'AI',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
        <path d="M12 12v10" />
        <path d="M8 18h8" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'behavior',
    label: 'Behavior',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'sounds',
    label: 'Sounds',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Theme',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    id: 'typography',
    label: 'Editor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
];

// Reusable toggle switch component
function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{
        background: checked ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
      }}
      aria-label={label}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
        style={{
          background: 'white',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// Reusable setting row component
function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              marginTop: '2px',
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Section wrapper
function SettingSection({
  title,
  children
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      {title && (
        <h4
          className="mb-1 uppercase tracking-wider"
          style={{
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </h4>
      )}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Button group for multi-select options
function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}) {
  return (
    <div
      className="inline-flex rounded-md overflow-hidden"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-default)',
      }}
    >
      {options.map((option, index) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className="px-3 py-1.5 text-sm transition-colors"
          style={{
            background: value === option ? 'var(--accent-primary)' : 'transparent',
            color: value === option ? 'white' : 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: value === option ? 500 : 400,
            borderLeft: index > 0 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          {getLabel ? getLabel(option) : option}
        </button>
      ))}
    </div>
  );
}

// Wrapped setting row with padding
function SettingItem({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4">
      <SettingRow label={label} description={description}>
        {children}
      </SettingRow>
    </div>
  );
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const { setAIConfig, aiConfig } = useMiku();
  const { profiles: keyboardSoundProfiles } = useKeyboardSounds();
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('ai');

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
    aiConfig?.model || 'anthropic/claude-sonnet-4.5'
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
    let models: AIModelOption[];
    switch (selectedProvider) {
      case 'openrouter':
        models = OPENROUTER_MODELS;
        break;
      case 'ollama':
      case 'lmstudio':
        models = LOCAL_LLM_MODELS.map(m => ({ ...m, provider: selectedProvider }));
        break;
      default:
        models = AI_MODELS.filter(m => m.provider === selectedProvider);
    }
    const currentModelInList = models.find(m => m.id === selectedModel);
    if (!currentModelInList && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [selectedProvider, selectedModel]);

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

  // Render content for each category
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'ai':
        return (
          <>
            {/* Provider Selection */}
            <SettingSection title="Provider">
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(['openrouter', 'openai', 'anthropic', 'google'] as AIProvider[]).map(provider => (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className="py-2.5 px-3 rounded-md text-sm transition-all"
                      style={{
                        background: selectedProvider === provider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: selectedProvider === provider ? 'white' : 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        fontWeight: selectedProvider === provider ? 500 : 400,
                        border: selectedProvider === provider ? 'none' : '1px solid var(--border-subtle)',
                      }}
                    >
                      {PROVIDER_NAMES[provider]}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['ollama', 'lmstudio'] as AIProvider[]).map(provider => (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className="py-2.5 px-3 rounded-md text-sm transition-all"
                      style={{
                        background: selectedProvider === provider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: selectedProvider === provider ? 'white' : 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        fontWeight: selectedProvider === provider ? 500 : 400,
                        border: selectedProvider === provider ? 'none' : '1px solid var(--border-subtle)',
                      }}
                    >
                      {PROVIDER_NAMES[provider]}
                    </button>
                  ))}
                </div>
              </div>
            </SettingSection>

            {/* Local Provider URL */}
            {isLocalProvider && (
              <SettingSection title="Server">
                <div className="p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder={DEFAULT_BASE_URLS[selectedProvider]}
                      className="flex-1 p-2.5 rounded-md"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      onClick={fetchLocalModels}
                      disabled={isLoadingModels}
                      className="px-4 py-2.5 rounded-md text-sm transition-colors"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        cursor: isLoadingModels ? 'wait' : 'pointer',
                        opacity: isLoadingModels ? 0.7 : 1,
                      }}
                    >
                      {isLoadingModels ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  {modelLoadError && (
                    <p
                      className="mt-2"
                      style={{
                        color: '#ef4444',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                      }}
                    >
                      {modelLoadError}
                    </p>
                  )}
                  <p
                    className="mt-2"
                    style={{
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                    }}
                  >
                    {selectedProvider === 'ollama'
                      ? 'Make sure Ollama is running locally.'
                      : 'Make sure LM Studio server is running.'}
                  </p>
                </div>
              </SettingSection>
            )}

            {/* Model Selection */}
            <SettingSection title="Model">
              <div className="p-4">
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full p-2.5 rounded-md"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                  }}
                >
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {isLocalProvider && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="Or enter custom model name..."
                    className="w-full p-2.5 rounded-md mt-2"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                    }}
                  />
                )}
              </div>
            </SettingSection>

            {/* API Key */}
            {requiresApiKey && (
              <SettingSection title="Authentication">
                <div className="p-4">
                  <input
                    type="password"
                    value={currentApiKey}
                    onChange={e => setApiKeys(prev => ({ ...prev, [selectedProvider]: e.target.value }))}
                    placeholder={`Enter your ${PROVIDER_NAMES[selectedProvider]} API key`}
                    className="w-full p-2.5 rounded-md"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                    }}
                  />
                  <p
                    className="mt-2"
                    style={{
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                    }}
                  >
                    {selectedProvider === 'openrouter'
                      ? 'Get your API key at openrouter.ai/keys'
                      : 'Your API key is stored locally and never sent to our servers.'}
                  </p>
                </div>
              </SettingSection>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveAPIConfig}
                disabled={requiresApiKey && !currentApiKey}
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: (!requiresApiKey || currentApiKey) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: (!requiresApiKey || currentApiKey) ? 'white' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                  cursor: (!requiresApiKey || currentApiKey) ? 'pointer' : 'not-allowed',
                }}
              >
                {isConfigured ? 'Update Configuration' : 'Apply Configuration'}
              </button>
              {aiConfig && (
                <button
                  onClick={handleClearAPIConfig}
                  className="py-2.5 px-4 rounded-md text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status indicator */}
            {aiConfig && (
              <div
                className="mt-4 p-3 rounded-md flex items-center gap-3"
                style={{
                  background: 'var(--accent-subtle)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: 'var(--accent-primary)' }}
                />
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                  }}
                >
                  Using {findModelName(aiConfig.model)} via {PROVIDER_NAMES[aiConfig.provider]}
                </span>
              </div>
            )}
          </>
        );

      case 'behavior':
        return (
          <>
            <SettingSection title="Review Mode">
              <SettingItem
                label="Trigger"
                description={
                  settings.reviewMode === 'manual'
                    ? 'Press Cmd+Enter or click Review to analyze.'
                    : 'Miku will review after you pause typing.'
                }
              >
                <ButtonGroup
                  options={['manual', 'auto'] as ReviewMode[]}
                  value={settings.reviewMode}
                  onChange={(value) => updateSettings({ reviewMode: value })}
                  getLabel={(v) => v === 'manual' ? 'Manual' : 'Auto'}
                />
              </SettingItem>
            </SettingSection>

            <SettingSection title="Review Style">
              <SettingItem
                label="Aggressiveness"
                description={
                  settings.aggressiveness === 'gentle'
                    ? 'Focus on major issues only.'
                    : settings.aggressiveness === 'balanced'
                    ? 'Balance between helpfulness and style.'
                    : 'Thorough review of grammar, style, and clarity.'
                }
              >
                <ButtonGroup
                  options={['gentle', 'balanced', 'strict'] as AggressivenessLevel[]}
                  value={settings.aggressiveness}
                  onChange={(value) => updateSettings({ aggressiveness: value })}
                  getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
              </SettingItem>
            </SettingSection>

            <SettingSection title="Context">
              <div className="p-4">
                <label
                  className="block mb-2"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  Writing Context
                </label>
                <textarea
                  value={settings.writingContext}
                  onChange={e => updateSettings({ writingContext: e.target.value })}
                  placeholder="e.g., Technical blog post, Academic essay, Creative fiction..."
                  rows={3}
                  className="w-full p-3 rounded-md resize-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                />
                <p
                  className="mt-2"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                  }}
                >
                  Help Miku understand what you&apos;re writing for better suggestions.
                </p>
              </div>
            </SettingSection>
          </>
        );

      case 'sounds':
        return (
          <>
            <SettingSection title="Notifications">
              <SettingItem
                label="Review Complete Sound"
                description="Play a sound when Miku finishes reviewing."
              >
                <Toggle
                  checked={settings.soundEnabled}
                  onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                  label="Sound notification"
                />
              </SettingItem>
            </SettingSection>

            <SettingSection title="Keyboard Sounds">
              <SettingItem
                label="Enable"
                description="Play mechanical keyboard sounds while typing."
              >
                <Toggle
                  checked={settings.keyboardSounds.enabled}
                  onChange={() => updateSettings({
                    keyboardSounds: {
                      ...settings.keyboardSounds,
                      enabled: !settings.keyboardSounds.enabled,
                    },
                  })}
                  label="Keyboard sounds"
                />
              </SettingItem>

              {settings.keyboardSounds.enabled && (
                <>
                  <SettingItem
                    label="Sound Profile"
                  >
                    <select
                      value={settings.keyboardSounds.profileId}
                      onChange={e => updateSettings({
                        keyboardSounds: {
                          ...settings.keyboardSounds,
                          profileId: e.target.value,
                        },
                      })}
                      className="p-2 rounded-md min-w-[140px]"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                      }}
                      disabled={keyboardSoundProfiles.length === 0}
                    >
                      {keyboardSoundProfiles.length === 0 ? (
                        <option value="">No sound packs</option>
                      ) : (
                        keyboardSoundProfiles.map(profile => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))
                      )}
                    </select>
                  </SettingItem>

                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                      >
                        Volume
                      </span>
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                        }}
                      >
                        {Math.round(settings.keyboardSounds.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.keyboardSounds.volume * 100}
                      onChange={e => updateSettings({
                        keyboardSounds: {
                          ...settings.keyboardSounds,
                          volume: Number(e.target.value) / 100,
                        },
                      })}
                      className="w-full"
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                  </div>

                  <SettingItem
                    label="Key Release Sounds"
                    description="Play additional sound when keys are released."
                  >
                    <Toggle
                      checked={settings.keyboardSounds.playKeyupSounds}
                      onChange={() => updateSettings({
                        keyboardSounds: {
                          ...settings.keyboardSounds,
                          playKeyupSounds: !settings.keyboardSounds.playKeyupSounds,
                        },
                      })}
                      label="Keyup sounds"
                    />
                  </SettingItem>
                </>
              )}
            </SettingSection>

            {keyboardSoundProfiles.length === 0 && settings.keyboardSounds.enabled && (
              <div
                className="p-4 rounded-md mt-4"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px dashed var(--border-default)',
                }}
              >
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}
                >
                  No sound packs installed. Add MechVibes sound packs to{' '}
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      background: 'var(--bg-primary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    /public/sounds/keyboards/
                  </code>
                </p>
              </div>
            )}
          </>
        );

      case 'appearance':
        return (
          <SettingSection title="Theme">
            <SettingItem
              label="Color Scheme"
              description="Choose how the interface appears."
            >
              <ButtonGroup
                options={['light', 'dark', 'system'] as Theme[]}
                value={settings.theme}
                onChange={(value) => updateSettings({ theme: value })}
                getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
            </SettingItem>
          </SettingSection>
        );

      case 'typography':
        return (
          <>
            <SettingSection title="Font">
              <SettingItem
                label="Font Family"
              >
                <ButtonGroup
                  options={['mono', 'sans'] as const}
                  value={settings.fontFamily}
                  onChange={(value) => updateSettings({ fontFamily: value })}
                  getLabel={(v) => v === 'mono' ? 'Mono' : 'Sans'}
                />
              </SettingItem>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Size
                  </span>
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    {settings.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="24"
                  value={settings.fontSize}
                  onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full"
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Line Height
                  </span>
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    {settings.lineHeight.toFixed(1)}
                  </span>
                </div>
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
            </SettingSection>

            <SettingSection title="Layout">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Editor Width
                  </span>
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    {settings.editorWidth}px
                  </span>
                </div>
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
            </SettingSection>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        ref={panelRef}
        className="w-full flex overflow-hidden animate-in fade-in zoom-in-95"
        style={{
          maxWidth: '640px',
          maxHeight: '85vh',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Left Navigation */}
        <div
          className="flex-shrink-0 py-4 overflow-y-auto"
          style={{
            width: '72px',
            background: 'var(--bg-tertiary)',
            borderRight: '1px solid var(--border-default)',
          }}
        >
          <nav className="flex flex-col gap-1 px-2">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-md transition-colors"
                style={{
                  background: activeCategory === category.id ? 'var(--bg-primary)' : 'transparent',
                  color: activeCategory === category.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
                title={category.label}
              >
                <span
                  style={{
                    color: activeCategory === category.id ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  }}
                >
                  {category.icon}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: activeCategory === category.id ? 500 : 400,
                  }}
                >
                  {category.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-default)' }}
          >
            <h2
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '16px',
                fontWeight: 600,
                margin: 0,
              }}
            >
              {CATEGORIES.find(c => c.id === activeCategory)?.label} Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]"
              aria-label="Close settings"
            >
              <svg
                width="14"
                height="14"
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

          {/* Scrollable Content */}
          <div
            className="flex-1 overflow-y-auto p-5"
            style={{ minHeight: 0 }}
          >
            {renderCategoryContent()}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border-default)' }}
          >
            <p
              style={{
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Miku v0.0.7 - The Editor That Listens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
