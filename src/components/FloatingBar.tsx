'use client';

import { useState, useCallback } from 'react';
import { useMiku } from '@/context/MikuContext';
import SettingsPanel from './SettingsPanel';

export default function FloatingBar() {
  const { state, requestReview } = useMiku();
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isVisible = isHovered || state.status !== 'idle' || showSettings;

  const handleManualReview = useCallback(() => {
    const editor = document.querySelector('textarea');
    if (editor) {
      requestReview((editor as HTMLTextAreaElement).value);
    }
  }, [requestReview]);

  return (
    <>
      {/* Hover zone */}
      <div
        className="fixed bottom-0 left-0 right-0 h-20 z-40"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Floating bar */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all w-[calc(100%-32px)] md:w-auto"
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transition: `opacity var(--duration-normal) var(--easing-default)`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="flex items-center justify-center gap-3 px-4 py-2"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '120px',
            height: '40px',
          }}
        >
          {/* Status indicator */}
          <StatusIndicator status={state.status} suggestionCount={state.suggestions.length} />

          {/* Review button */}
          <button
            onClick={handleManualReview}
            className="text-sm transition-colors hover:text-[var(--text-primary)]"
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
            }}
            disabled={state.status === 'thinking'}
            aria-label="Request review"
          >
            Review
          </button>

          {/* Divider */}
          <div
            className="w-px h-4"
            style={{ background: 'var(--border-default)' }}
          />

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label="Open settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-secondary)' }}
            >
              <circle cx="8" cy="8" r="2" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}

function StatusIndicator({ status, suggestionCount }: { status: string; suggestionCount: number }) {
  if (status === 'thinking') {
    return (
      <div className="flex gap-1 items-center" aria-label="Analyzing">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--accent-primary)',
              animation: `dotFade 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    );
  }

  if (status === 'ready' && suggestionCount > 0) {
    return (
      <div className="flex items-center gap-1.5" aria-label={`${suggestionCount} suggestions`}>
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: 'var(--accent-primary)' }}
        />
        <span
          className="text-xs font-medium"
          style={{
            color: 'var(--accent-primary)',
            fontSize: 'var(--text-xs)',
          }}
        >
          {suggestionCount}
        </span>
      </div>
    );
  }

  return (
    <span
      className="w-2 h-2 rounded-full"
      style={{ background: 'var(--text-tertiary)' }}
      aria-label="Idle"
    />
  );
}
