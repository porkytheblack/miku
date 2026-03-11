'use client';

import { useCallback } from 'react';
import type { MikuFileMode } from '@/lib/mikuFileParser';

interface MikuConfigModesSectionProps {
  modes: MikuFileMode[];
  onChange: (modes: MikuFileMode[]) => void;
}

export default function MikuConfigModesSection({ modes, onChange }: MikuConfigModesSectionProps) {
  const addMode = useCallback(() => {
    const id = `mode-${Date.now()}`;
    onChange([...modes, { id, name: 'New Mode', description: '' }]);
  }, [modes, onChange]);

  const removeMode = useCallback((index: number) => {
    onChange(modes.filter((_, i) => i !== index));
  }, [modes, onChange]);

  const updateMode = useCallback((index: number, updates: Partial<MikuFileMode>) => {
    const updated = [...modes];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }, [modes, onChange]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Modes</h2>
        <button
          onClick={addMode}
          className="px-3 py-1 text-xs rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
        >
          + Add Mode
        </button>
      </div>

      {modes.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] italic">
          No modes configured. The agent will use a single default mode.
        </p>
      ) : (
        <div className="space-y-2">
          {modes.map((mode, index) => (
            <div
              key={mode.id}
              className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mode.id}
                  onChange={(e) => updateMode(index, { id: e.target.value })}
                  className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-mono focus:outline-none"
                  placeholder="mode-id"
                />
                <input
                  type="text"
                  value={mode.name}
                  onChange={(e) => updateMode(index, { name: e.target.value })}
                  className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none"
                  placeholder="Mode Name"
                />
                <button
                  onClick={() => removeMode(index)}
                  className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors text-xs"
                  title="Remove mode"
                >
                  x
                </button>
              </div>
              <input
                type="text"
                value={mode.description}
                onChange={(e) => updateMode(index, { description: e.target.value })}
                className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs focus:outline-none"
                placeholder="Description..."
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
