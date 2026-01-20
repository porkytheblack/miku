'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { Theme } from '@/types';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md overflow-y-auto animate-in fade-in zoom-in-95"
        style={{
          maxHeight: '80vh',
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
