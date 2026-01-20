'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useSettings } from '@/context/SettingsContext';
import Tooltip from './Tooltip';
import { HighlightType } from '@/types';

// Get highlight color for suggestion type
function getHighlightColor(type: HighlightType): string {
  switch (type) {
    case 'clarity':
      return 'var(--highlight-clarity)';
    case 'grammar':
      return 'var(--highlight-grammar)';
    case 'style':
      return 'var(--highlight-style)';
    case 'structure':
      return 'var(--highlight-structure)';
    case 'economy':
      return 'var(--highlight-economy)';
    default:
      return 'var(--highlight-clarity)';
  }
}

export default function BlockEditor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions } = useMiku();
  const [content, setContent] = useState<string>('');
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Sync scroll between textarea and highlight layer
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

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

  // Build highlighted content with suggestion markers
  const highlightedHTML = useMemo(() => {
    if (state.suggestions.length === 0 || !content) {
      // Return escaped content for the backdrop
      return escapeHtml(content) + '\n'; // Add newline to match textarea behavior
    }

    // Sort suggestions by start index
    const sortedSuggestions = [...state.suggestions].sort((a, b) => a.startIndex - b.startIndex);

    // Build segments with highlights
    let html = '';
    let lastIndex = 0;

    for (const suggestion of sortedSuggestions) {
      // Skip invalid suggestions
      if (suggestion.startIndex < 0 || suggestion.endIndex > content.length || suggestion.startIndex >= suggestion.endIndex) {
        continue;
      }

      // Skip overlapping suggestions
      if (suggestion.startIndex < lastIndex) {
        continue;
      }

      // Add text before this suggestion
      if (suggestion.startIndex > lastIndex) {
        html += escapeHtml(content.slice(lastIndex, suggestion.startIndex));
      }

      // Add the highlighted segment
      const highlightText = content.slice(suggestion.startIndex, suggestion.endIndex);
      html += `<mark data-suggestion-id="${suggestion.id}" style="background-color: ${getHighlightColor(suggestion.type)}; border-radius: 2px; cursor: pointer;">${escapeHtml(highlightText)}</mark>`;

      lastIndex = suggestion.endIndex;
    }

    // Add remaining text after last suggestion
    if (lastIndex < content.length) {
      html += escapeHtml(content.slice(lastIndex));
    }

    return html + '\n'; // Add newline to match textarea behavior
  }, [content, state.suggestions]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  const handleHighlightClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK') {
      const suggestionId = target.dataset.suggestionId;
      if (suggestionId) {
        setActiveSuggestion(suggestionId);

        // Position tooltip near the clicked element
        const rect = target.getBoundingClientRect();
        setTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
        });
      }
    }
  }, [setActiveSuggestion]);

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
    setTooltipPosition(null);
  }, [content, state.suggestions, acceptSuggestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
    setTooltipPosition(null);
  }, [dismissSuggestion]);

  const handleCloseTooltip = useCallback(() => {
    setActiveSuggestion(null);
    setTooltipPosition(null);
  }, [setActiveSuggestion]);

  const activeSuggestion = state.suggestions.find(s => s.id === state.activeSuggestionId);

  const editorStyles = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
  };

  return (
    <div
      className="editor-wrapper w-full min-h-screen"
      style={{
        background: 'var(--bg-primary)',
      }}
    >
      <div
        ref={containerRef}
        className="editor-container relative"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: 'var(--spacing-8) var(--spacing-6)',
          minHeight: '100vh',
        }}
      >
        {/* Highlight backdrop layer - renders the colored highlights */}
        <div
          ref={highlightRef}
          className="highlight-backdrop"
          onClick={handleHighlightClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: 'var(--spacing-8) var(--spacing-6)',
            color: 'transparent',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'hidden',
            pointerEvents: state.suggestions.length > 0 ? 'auto' : 'none',
            ...editorStyles,
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />

        {/* Actual textarea for editing */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={syncScroll}
          className="editor-textarea w-full resize-none border-none outline-none"
          style={{
            position: 'relative',
            background: 'transparent',
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-primary)',
            minHeight: 'calc(100vh - 128px)',
            width: '100%',
            display: 'block',
            zIndex: 2,
            ...editorStyles,
          }}
          placeholder="Start writing...

Miku will review your writing after you pause for a few seconds.

Tips:
- Write naturally, Miku will suggest improvements
- Highlighted text shows suggestions - click to see details
- Use the floating bar at the bottom for manual review"
          spellCheck={false}
          aria-label="Writing editor"
        />

        {/* Tooltip for active suggestion */}
        {activeSuggestion && tooltipPosition && (
          <div
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            <Tooltip
              suggestion={activeSuggestion}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              onClose={handleCloseTooltip}
            />
          </div>
        )}

        {/* Status indicator */}
        {state.status === 'thinking' && (
          <div className="status-indicator">
            Miku is reviewing...
          </div>
        )}

        {state.status === 'ready' && state.suggestions.length > 0 && (
          <div className="status-indicator">
            {state.suggestions.length} suggestion{state.suggestions.length !== 1 ? 's' : ''} - click highlighted text to review
          </div>
        )}

        {state.status === 'error' && state.error && (
          <div className="status-indicator error">
            Error: {state.error}
          </div>
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

        .highlight-backdrop {
          user-select: none;
        }

        .status-indicator {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          padding: var(--spacing-2) var(--spacing-4);
          border-radius: var(--radius-md);
          font-size: 14px;
          box-shadow: var(--shadow-md);
          z-index: 100;
        }

        .status-indicator.error {
          background: var(--highlight-grammar);
          color: white;
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

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
