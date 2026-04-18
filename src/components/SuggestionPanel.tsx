'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { HighlightType, Suggestion } from '@/types';

const typeLabels: Record<HighlightType, string> = {
  clarity: 'Clarity',
  grammar: 'Grammar',
  style: 'Style',
  structure: 'Structure',
  economy: 'Economy',
};

const typeColors: Record<HighlightType, string> = {
  clarity: '#EAB308',
  grammar: '#EF4444',
  style: '#3B82F6',
  structure: '#A855F7',
  economy: '#22C55E',
};

interface SuggestionPanelProps {
  suggestion: Suggestion;
  suggestionCount: number;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcceptAll: () => void;
  onDeclineAll: () => void;
  onClose: () => void;
}

export default function SuggestionPanel({
  suggestion,
  suggestionCount,
  onAccept,
  onDismiss,
  onAcceptAll,
  onDeclineAll,
  onClose,
}: SuggestionPanelProps) {
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
      ref={panelRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '700px',
        width: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Image
          src="/brand/miku-colored.svg"
          alt="Miku"
          width={24}
          height={24}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: typeColors[suggestion.type],
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
          {typeLabels[suggestion.type]}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
          ({suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''})
        </span>
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            padding: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px', wordWrap: 'break-word' }}>
        {suggestion.observation}
      </p>

      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', overflowX: 'auto' }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Original:</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.5' }}>
          {suggestion.originalText}
        </p>
      </div>

      {suggestion.suggestedRevision !== suggestion.originalText && (
        <div style={{ background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', overflowX: 'auto' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Suggested:</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.5' }}>
            {suggestion.suggestedRevision}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: suggestionCount > 1 ? '12px' : '0' }}>
        <button
          onClick={() => onAccept(suggestion.id)}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Dismiss
        </button>
      </div>

      {suggestionCount > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-default)'
        }}>
          <button
            onClick={onAcceptAll}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Accept All ({suggestionCount})
          </button>
          <button
            onClick={onDeclineAll}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Decline All
          </button>
        </div>
      )}
    </div>
  );
}
