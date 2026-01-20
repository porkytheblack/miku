'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSettings } from '@/context/SettingsContext';
import { useMiku } from '@/context/MikuContext';
import Tooltip from './Tooltip';

// Dynamic import for markdown editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

export default function Editor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions } = useMiku();
  const [content, setContent] = useState<string>('');
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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

  const handleChange = useCallback((value?: string) => {
    setContent(value || '');
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
      ref={editorRef}
      className="editor-container w-full h-screen"
      data-color-mode={settings.theme === 'system' ? undefined : settings.theme}
    >
      <style jsx global>{`
        .editor-container {
          --color-canvas-default: var(--bg-primary);
          --color-canvas-subtle: var(--bg-secondary);
          --color-border-default: var(--border-default);
          --color-border-muted: var(--border-default);
          --color-fg-default: var(--text-primary);
          --color-fg-muted: var(--text-secondary);
          --color-accent-fg: var(--accent-primary);
        }

        .w-md-editor {
          background: var(--bg-primary) !important;
          border: none !important;
          box-shadow: none !important;
          height: 100% !important;
          min-height: 100vh !important;
        }

        .w-md-editor-toolbar {
          background: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border-default) !important;
          padding: var(--space-2) var(--space-4) !important;
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
        }

        .w-md-editor-toolbar ul > li > button {
          color: var(--text-secondary) !important;
        }

        .w-md-editor-toolbar ul > li > button:hover {
          color: var(--text-primary) !important;
          background: var(--bg-tertiary) !important;
        }

        .w-md-editor-toolbar ul > li.active > button {
          color: var(--accent-primary) !important;
        }

        .w-md-editor-content {
          background: var(--bg-primary) !important;
          height: calc(100vh - 40px) !important;
        }

        .w-md-editor-area {
          height: 100% !important;
        }

        .w-md-editor-text-pre,
        .w-md-editor-text-input,
        .w-md-editor-text {
          font-size: ${settings.fontSize}px !important;
          line-height: ${settings.lineHeight} !important;
          font-family: ${settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)'} !important;
          color: var(--text-primary) !important;
          padding: var(--space-8) !important;
          max-width: ${settings.editorWidth}px !important;
          margin: 0 auto !important;
        }

        .w-md-editor-preview {
          padding: var(--space-8) !important;
          max-width: ${settings.editorWidth}px !important;
          margin: 0 auto !important;
          background: var(--bg-primary) !important;
        }

        .w-md-editor-preview .wmde-markdown {
          font-size: ${settings.fontSize}px !important;
          line-height: ${settings.lineHeight} !important;
          font-family: var(--font-sans) !important;
          color: var(--text-primary) !important;
          background: transparent !important;
        }

        .wmde-markdown h1,
        .wmde-markdown h2,
        .wmde-markdown h3,
        .wmde-markdown h4,
        .wmde-markdown h5,
        .wmde-markdown h6 {
          color: var(--text-primary) !important;
          border-bottom-color: var(--border-default) !important;
        }

        .wmde-markdown code {
          background: var(--bg-tertiary) !important;
          color: var(--text-primary) !important;
          font-family: var(--font-mono) !important;
        }

        .wmde-markdown pre {
          background: var(--bg-secondary) !important;
          border: 1px solid var(--border-default) !important;
        }

        .wmde-markdown blockquote {
          border-left-color: var(--accent-primary) !important;
          color: var(--text-secondary) !important;
        }

        .wmde-markdown a {
          color: var(--accent-primary) !important;
        }

        .wmde-markdown hr {
          border-color: var(--border-default) !important;
        }

        .wmde-markdown table th,
        .wmde-markdown table td {
          border-color: var(--border-default) !important;
        }

        .wmde-markdown table tr {
          background: var(--bg-primary) !important;
        }

        .wmde-markdown table tr:nth-child(2n) {
          background: var(--bg-secondary) !important;
        }

        /* Hide scrollbar for cleaner look */
        .w-md-editor-area {
          scrollbar-width: thin;
          scrollbar-color: var(--border-default) transparent;
        }

        .w-md-editor-area::-webkit-scrollbar {
          width: 8px;
        }

        .w-md-editor-area::-webkit-scrollbar-track {
          background: transparent;
        }

        .w-md-editor-area::-webkit-scrollbar-thumb {
          background: var(--border-default);
          border-radius: 4px;
        }

        /* Caret color */
        .w-md-editor-text-input {
          caret-color: var(--accent-primary) !important;
        }

        /* Full height editor */
        .w-md-editor-input {
          height: 100% !important;
        }
      `}</style>

      <MDEditor
        value={content}
        onChange={handleChange}
        preview="edit"
        hideToolbar={false}
        enableScroll={true}
        visibleDragbar={false}
        height="100%"
        textareaProps={{
          placeholder: 'Start writing...',
          spellCheck: false,
        }}
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
  );
}
