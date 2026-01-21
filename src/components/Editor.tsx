'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import Tooltip from './Tooltip';

export default function Editor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions } = useMiku();
  const [content, setContent] = useState<string>('');
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-review after pause
  useEffect(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    if (content && content !== lastReviewedContent && state.status === 'idle') {
      pauseTimeoutRef.current = setTimeout(() => {
        requestReview(content);
        setLastReviewedContent(content);
      }, 3000);
    }

    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [content, lastReviewedContent, state.status, requestReview]);

  // Clear suggestions when content changes significantly
  useEffect(() => {
    if (state.suggestions.length > 0 && content !== lastReviewedContent) {
      const significantChange = Math.abs(content.length - lastReviewedContent.length) > 20;
      if (significantChange) {
        clearSuggestions();
      }
    }
  }, [content, lastReviewedContent, state.suggestions.length, clearSuggestions]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  const handleAccept = useCallback((id: string) => {
    const suggestion = state.suggestions.find(s => s.id === id);
    if (!suggestion) return;

    const newContent =
      content.slice(0, suggestion.startIndex) +
      suggestion.suggestedRevision +
      content.slice(suggestion.endIndex);

    setContent(newContent);
    setLastReviewedContent('');
    acceptSuggestion(id);
  }, [content, state.suggestions, acceptSuggestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
  }, [dismissSuggestion]);

  const activeSuggestion = state.suggestions.find(s => s.id === state.activeSuggestionId);

  return (
    <div
      className="editor-wrapper w-full min-h-screen"
      style={{
        background: 'var(--bg-primary)',
      }}
    >
      <div
        className="editor-container mx-auto relative"
        style={{
          maxWidth: `${settings.editorWidth}px`,
          padding: 'var(--editor-padding-y) var(--editor-padding-x)',
          minHeight: '100vh',
        }}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          className="editor-textarea w-full resize-none border-none outline-none"
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-primary)',
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
            minHeight: 'calc(100vh - 128px)',
            width: '100%',
            display: 'block',
          }}
          placeholder="Start writing...

Miku will review your writing after you pause for a few seconds.

Tips:
- Write naturally, Miku will suggest improvements
- Click on highlighted text to see suggestions
- Use the floating bar at the bottom for manual review

Supported formats:
- Plain text
- Markdown (rendered in preview mode)
"
          spellCheck={false}
          aria-label="Writing editor"
        />

        {/* Tooltip for active suggestion */}
        {activeSuggestion && (
          <Tooltip
            suggestion={activeSuggestion}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
            onClose={() => setActiveSuggestion(null)}
          />
        )}
      </div>

      <style jsx>{`
        .editor-textarea {
          field-sizing: content;
        }

        .editor-textarea::placeholder {
          color: var(--text-tertiary);
          opacity: 0.7;
        }

        .editor-textarea:focus {
          outline: none;
        }

        /* Custom scrollbar */
        .editor-wrapper {
          scrollbar-width: thin;
          scrollbar-color: var(--border-default) transparent;
        }

        .editor-wrapper::-webkit-scrollbar {
          width: 8px;
        }

        .editor-wrapper::-webkit-scrollbar-track {
          background: transparent;
        }

        .editor-wrapper::-webkit-scrollbar-thumb {
          background: var(--border-default);
          border-radius: 4px;
        }

        .editor-wrapper::-webkit-scrollbar-thumb:hover {
          background: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
