'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import { Theme, AIProvider, AI_MODELS, ReviewMode, AggressivenessLevel } from '@/types';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const { setAIConfig, aiConfig } = useMiku();
  const panelRef = useRef<HTMLDivElement>(null);

  // Local state for API keys (not saved until Apply is clicked)
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    google: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    aiConfig?.provider || 'openai'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    aiConfig?.model || 'gpt-4o'
  );

  // Load saved API keys from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('miku-api-keys');
      if (saved) {
        const parsed = JSON.parse(saved);
        setApiKeys(prev => ({ ...prev, ...parsed }));
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

  // Filter models by selected provider
  const availableModels = AI_MODELS.filter(m => m.provider === selectedProvider);

  // Update selected model when provider changes
  useEffect(() => {
    const currentModelProvider = AI_MODELS.find(m => m.id === selectedModel)?.provider;
    if (currentModelProvider !== selectedProvider) {
      const firstModel = availableModels[0];
      if (firstModel) {
        setSelectedModel(firstModel.id);
      }
    }
  }, [selectedProvider, selectedModel, availableModels]);

  const handleSaveAPIConfig = () => {
    const apiKey = apiKeys[selectedProvider];
    if (apiKey) {
      // Save API keys to localStorage
      try {
        localStorage.setItem('miku-api-keys', JSON.stringify(apiKeys));
      } catch (e) {
        console.error('Failed to save API keys:', e);
      }

      // Set the AI config
      setAIConfig({
        provider: selectedProvider,
        apiKey,
        model: selectedModel,
      });
    }
  };

  const handleClearAPIConfig = () => {
    setAIConfig(null);
  };

  const currentApiKey = apiKeys[selectedProvider];
  const isConfigured = aiConfig !== null && aiConfig.provider === selectedProvider;

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
              <div className="flex gap-2">
                {(['openai', 'anthropic', 'google'] as AIProvider[]).map(provider => (
                  <button
                    key={provider}
                    onClick={() => setSelectedProvider(provider)}
                    className="flex-1 py-2 px-3 rounded text-sm capitalize transition-colors"
                    style={{
                      background: selectedProvider === provider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: selectedProvider === provider ? 'white' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google'}
                  </button>
                ))}
              </div>
            </div>

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
            </div>

            {/* API Key input */}
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
                placeholder={`Enter your ${selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'anthropic' ? 'Anthropic' : 'Google'} API key`}
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
                Your API key is stored locally and never sent to our servers.
              </p>
            </div>

            {/* Save/Clear buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveAPIConfig}
                disabled={!currentApiKey}
                className="flex-1 py-2 px-3 rounded text-sm font-medium transition-colors"
                style={{
                  background: currentApiKey ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: currentApiKey ? 'white' : 'var(--text-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  cursor: currentApiKey ? 'pointer' : 'not-allowed',
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
                  Using {AI_MODELS.find(m => m.id === aiConfig.model)?.name || aiConfig.model}
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
