'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import { Suggestion } from '@/types';
import Tooltip from './Tooltip';

export default function Editor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions } = useMiku();
  const [content, setContent] = useState('');
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-review after pause
  useEffect(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    if (content && content !== lastReviewedContent && state.status === 'idle') {
      pauseTimeoutRef.current = setTimeout(() => {
        requestReview(content);
        setLastReviewedContent(content);
      }, 3000); // 3 second pause triggers review
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
      // Check if the change is significant enough to invalidate suggestions
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
    setLastReviewedContent(''); // Force re-review
    acceptSuggestion(id);
  }, [content, state.suggestions, acceptSuggestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
  }, [dismissSuggestion]);

  const handleHighlightClick = useCallback((suggestion: Suggestion) => {
    setActiveSuggestion(state.activeSuggestionId === suggestion.id ? null : suggestion.id);
  }, [state.activeSuggestionId, setActiveSuggestion]);

  // Calculate highlight positions based on content
  const highlightedContent = useMemo(() => {
    if (state.suggestions.length === 0) return null;

    const parts: Array<{ text: string; suggestion?: Suggestion }> = [];
    let lastIndex = 0;

    // Sort suggestions by start index
    const sortedSuggestions = [...state.suggestions].sort((a, b) => a.startIndex - b.startIndex);

    sortedSuggestions.forEach(suggestion => {
      if (suggestion.startIndex > lastIndex) {
        parts.push({ text: content.slice(lastIndex, suggestion.startIndex) });
      }
      parts.push({
        text: content.slice(suggestion.startIndex, suggestion.endIndex),
        suggestion,
      });
      lastIndex = suggestion.endIndex;
    });

    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex) });
    }

    return parts;
  }, [content, state.suggestions]);

  const activeSuggestion = state.suggestions.find(s => s.id === state.activeSuggestionId);

  const getHighlightStyle = (type: Suggestion['type']) => {
    const colors: Record<string, string> = {
      clarity: 'var(--highlight-clarity)',
      grammar: 'var(--highlight-grammar)',
      style: 'var(--highlight-style)',
      structure: 'var(--highlight-structure)',
      economy: 'var(--highlight-economy)',
    };
    return colors[type] || colors.clarity;
  };

  const editorStyle = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    maxWidth: `${settings.editorWidth}px`,
    fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
  };

  return (
    <div className="relative min-h-screen w-full" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="mx-auto"
        style={{
          ...editorStyle,
          padding: 'var(--editor-padding-y) var(--editor-padding-x)',
        }}
      >
        {/* Highlight overlay layer */}
        {highlightedContent && (
          <div
            ref={contentRef}
            className="pointer-events-none absolute inset-0 mx-auto whitespace-pre-wrap break-words"
            style={{
              ...editorStyle,
              padding: 'var(--editor-padding-y) var(--editor-padding-x)',
              color: 'transparent',
            }}
            aria-hidden="true"
          >
            {highlightedContent.map((part, index) => (
              part.suggestion ? (
                <span
                  key={index}
                  className="pointer-events-auto cursor-pointer rounded-sm transition-all"
                  style={{
                    background: getHighlightStyle(part.suggestion.type),
                    borderRadius: '2px',
                  }}
                  onClick={() => handleHighlightClick(part.suggestion!)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHighlightClick(part.suggestion!)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${part.suggestion.type} suggestion`}
                >
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              )
            ))}
          </div>
        )}

        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          className="relative w-full min-h-screen resize-none border-none outline-none"
          style={{
            ...editorStyle,
            background: 'transparent',
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-primary)',
          }}
          placeholder="Start writing..."
          spellCheck={false}
          aria-label="Markdown editor"
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
    </div>
  );
}
