'use client';

import { useEffect, useRef } from 'react';
import { Suggestion } from '@/types';

interface TooltipProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

const typeLabels: Record<Suggestion['type'], string> = {
  clarity: 'Clarity',
  grammar: 'Grammar',
  style: 'Style',
  structure: 'Structure',
  economy: 'Economy',
};

const typeColors: Record<Suggestion['type'], string> = {
  clarity: '#EAB308',
  grammar: '#EF4444',
  style: '#3B82F6',
  structure: '#A855F7',
  economy: '#22C55E',
};

export default function Tooltip({ suggestion, onAccept, onDismiss, onClose }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
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
      ref={tooltipRef}
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-2"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '320px',
        width: 'calc(100vw - 32px)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--shadow-lg)',
      }}
      role="dialog"
      aria-labelledby="tooltip-title"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 mb-2"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: typeColors[suggestion.type] }}
        />
        <h3
          id="tooltip-title"
          className="text-sm font-medium"
          style={{
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          {typeLabels[suggestion.type]}
        </h3>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
          aria-label="Close"
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

      {/* Observation */}
      <p
        className="mb-3"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 'var(--leading-tight)',
        }}
      >
        {suggestion.observation}
      </p>

      {/* Original text */}
      <div
        className="mb-3 p-3 rounded"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <p
          className="text-xs mb-1"
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-xs)',
          }}
        >
          Original:
        </p>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {suggestion.originalText}
        </p>
      </div>

      {/* Suggested revision */}
      {suggestion.suggestedRevision !== suggestion.originalText && (
        <div
          className="mb-3 p-3 rounded"
          style={{
            background: 'var(--accent-subtle)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p
            className="text-xs mb-1"
            style={{
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-xs)',
            }}
          >
            Suggested:
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              lineHeight: 'var(--leading-tight)',
            }}
          >
            {suggestion.suggestedRevision}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(suggestion.id)}
          className="flex-1 py-2 px-3 rounded text-sm font-medium transition-colors"
          style={{
            background: 'var(--accent-primary)',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="flex-1 py-2 px-3 rounded text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
