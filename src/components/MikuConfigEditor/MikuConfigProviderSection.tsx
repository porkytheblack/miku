'use client';

import type { MikuFileProvider } from '@/lib/mikuFileParser';

interface MikuConfigProviderSectionProps {
  provider: MikuFileProvider;
  onChange: (provider: MikuFileProvider) => void;
}

const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lmstudio', label: 'LM Studio (Local)' },
] as const;

const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-5-20250514', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  google: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'],
  openrouter: ['anthropic/claude-sonnet-4-5-20250514', 'openai/gpt-4o', 'google/gemini-2.0-flash'],
  ollama: ['llama3.3', 'codellama', 'deepseek-coder', 'qwen2.5-coder'],
  lmstudio: ['local-model'],
};

const DEFAULT_API_KEY_ENVS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export default function MikuConfigProviderSection({ provider, onChange }: MikuConfigProviderSectionProps) {
  const models = DEFAULT_MODELS[provider.type] || [];
  const needsApiKey = !['ollama', 'lmstudio'].includes(provider.type);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Provider</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-secondary)]">Provider</label>
          <select
            value={provider.type}
            onChange={(e) => {
              const type = e.target.value as MikuFileProvider['type'];
              const defaultModel = DEFAULT_MODELS[type]?.[0] || '';
              const apiKeyEnv = DEFAULT_API_KEY_ENVS[type];
              onChange({
                ...provider,
                type,
                model: defaultModel,
                apiKeyEnv: apiKeyEnv || undefined,
                baseUrl: undefined,
              });
            }}
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
          >
            {PROVIDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-secondary)]">Model</label>
          <input
            type="text"
            value={provider.model}
            onChange={(e) => onChange({ ...provider, model: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)]"
            list="model-suggestions"
            placeholder="Model name..."
          />
          <datalist id="model-suggestions">
            {models.map(m => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {needsApiKey && (
        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-secondary)]">API Key Environment Variable</label>
          <input
            type="text"
            value={provider.apiKeyEnv || ''}
            onChange={(e) => onChange({ ...provider, apiKeyEnv: e.target.value || undefined })}
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)]"
            placeholder="ANTHROPIC_API_KEY"
          />
          <p className="text-xs text-[var(--text-secondary)]">
            The agent reads the API key from this environment variable at runtime.
          </p>
        </div>
      )}

      {['ollama', 'lmstudio'].includes(provider.type) && (
        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-secondary)]">Base URL</label>
          <input
            type="text"
            value={provider.baseUrl || ''}
            onChange={(e) => onChange({ ...provider, baseUrl: e.target.value || undefined })}
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)]"
            placeholder={provider.type === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1'}
          />
        </div>
      )}
    </section>
  );
}
