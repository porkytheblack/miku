'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useSettings } from '@/context/SettingsContext';
import { HighlightType, Suggestion } from '@/types';
import { adjustSuggestions, validateSuggestionPositions } from '@/lib/textPosition';
import dynamic from 'next/dynamic';

// Dynamically import markdown preview to avoid SSR issues
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview').then(mod => mod.default), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--text-tertiary)' }}>Loading preview...</div>
});

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

// Slash command options
const SLASH_COMMANDS = [
  { id: 'h1', label: 'Heading 1', icon: 'H1', prefix: '# ' },
  { id: 'h2', label: 'Heading 2', icon: 'H2', prefix: '## ' },
  { id: 'h3', label: 'Heading 3', icon: 'H3', prefix: '### ' },
  { id: 'bullet', label: 'Bullet List', icon: '•', prefix: '- ' },
  { id: 'numbered', label: 'Numbered List', icon: '1.', prefix: '1. ' },
  { id: 'quote', label: 'Quote', icon: '"', prefix: '> ' },
  { id: 'code', label: 'Code Block', icon: '<>', prefix: '```\n' },
  { id: 'divider', label: 'Divider', icon: '—', prefix: '---\n' },
];

export default function BlockEditor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions, updateSuggestions } = useMiku();
  const [content, setContent] = useState<string>('');
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Track previous content for position adjustment
  const prevContentRef = useRef<string>('');

  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [slashStartIndex, setSlashStartIndex] = useState<number | null>(null);
  const [slashEndIndex, setSlashEndIndex] = useState<number | null>(null);

  // Sync scroll between textarea and highlight layer
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Manual review function
  const triggerManualReview = useCallback(() => {
    if (content.trim()) {
      requestReview(content, {
        aggressiveness: settings.aggressiveness,
        writingContext: settings.writingContext,
        forceReview: true, // Force review even if content was reviewed before
      });
      setLastReviewedContent(content);
    }
  }, [content, requestReview, settings.aggressiveness, settings.writingContext]);

  // Auto-review after pause (only in auto mode)
  useEffect(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    // Only auto-review if in auto mode
    if (settings.reviewMode === 'auto' && content && content !== lastReviewedContent && state.status === 'idle') {
      pauseTimeoutRef.current = setTimeout(() => {
        requestReview(content, {
          aggressiveness: settings.aggressiveness,
          writingContext: settings.writingContext,
        });
        setLastReviewedContent(content);
      }, 3000);
    }

    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [content, lastReviewedContent, state.status, requestReview, settings.reviewMode, settings.aggressiveness, settings.writingContext]);

  // Adjust suggestion positions when content changes
  useEffect(() => {
    const prevContent = prevContentRef.current;
    prevContentRef.current = content;

    // Skip if no previous content or no suggestions
    if (!prevContent || state.suggestions.length === 0 || prevContent === content) {
      return;
    }

    // Check if the change is too drastic (more than 50% different length)
    const lengthRatio = Math.min(content.length, prevContent.length) / Math.max(content.length, prevContent.length);
    if (lengthRatio < 0.5) {
      clearSuggestions();
      return;
    }

    // Adjust suggestion positions based on the text edit
    const adjustedSuggestions = adjustSuggestions(state.suggestions, prevContent, content);

    // Validate that adjusted suggestions still point to correct text
    const validatedSuggestions = validateSuggestionPositions(adjustedSuggestions, content);

    // If we lost too many suggestions, clear them all (content changed too much)
    if (validatedSuggestions.length < state.suggestions.length * 0.5) {
      clearSuggestions();
      return;
    }

    // Update suggestions if any changed
    if (validatedSuggestions.length !== state.suggestions.length ||
        validatedSuggestions.some((s, i) =>
          s.startIndex !== state.suggestions[i]?.startIndex ||
          s.endIndex !== state.suggestions[i]?.endIndex
        )) {
      updateSuggestions(validatedSuggestions);
    }
  }, [content, state.suggestions, clearSuggestions, updateSuggestions]);

  // Filtered slash commands
  const filteredCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
      cmd.id.toLowerCase().includes(slashFilter.toLowerCase())
    );
  }, [slashFilter]);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashFilter]);

  // Build highlighted content with suggestion markers
  // Uses validated positions to ensure highlights match the correct text
  const highlightedHTML = useMemo(() => {
    if (state.suggestions.length === 0 || !content) {
      return escapeHtml(content) + '\n';
    }

    // Filter to only valid suggestions that match their expected text
    const validSuggestions = state.suggestions.filter(suggestion => {
      // Basic bounds checking
      if (suggestion.startIndex < 0 || suggestion.endIndex > content.length || suggestion.startIndex >= suggestion.endIndex) {
        return false;
      }

      // Verify the text at this position matches what we expect
      const textAtPosition = content.slice(suggestion.startIndex, suggestion.endIndex);
      if (textAtPosition !== suggestion.originalText) {
        return false;
      }

      return true;
    });

    const sortedSuggestions = [...validSuggestions].sort((a, b) => a.startIndex - b.startIndex);
    let html = '';
    let lastIndex = 0;

    for (const suggestion of sortedSuggestions) {
      // Skip overlapping suggestions
      if (suggestion.startIndex < lastIndex) {
        continue;
      }

      // Add text before this highlight
      if (suggestion.startIndex > lastIndex) {
        html += escapeHtml(content.slice(lastIndex, suggestion.startIndex));
      }

      // Add the highlighted text
      const highlightText = content.slice(suggestion.startIndex, suggestion.endIndex);
      const isActive = suggestion.id === state.activeSuggestionId;
      html += `<mark data-suggestion-id="${suggestion.id}" style="background-color: ${getHighlightColor(suggestion.type)}; border-radius: 2px; cursor: pointer; pointer-events: auto; ${isActive ? 'outline: 2px solid var(--accent-primary);' : ''}">${escapeHtml(highlightText)}</mark>`;

      lastIndex = suggestion.endIndex;
    }

    // Add remaining text after last highlight
    if (lastIndex < content.length) {
      html += escapeHtml(content.slice(lastIndex));
    }

    return html + '\n';
  }, [content, state.suggestions, state.activeSuggestionId]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(newContent);

    // Check for slash command
    if (slashStartIndex !== null) {
      // We're in slash command mode
      const textAfterSlash = newContent.slice(slashStartIndex + 1, cursorPos);
      if (textAfterSlash.includes(' ') || textAfterSlash.includes('\n') || cursorPos <= slashStartIndex) {
        // Close slash menu
        setShowSlashMenu(false);
        setSlashStartIndex(null);
        setSlashEndIndex(null);
        setSlashFilter('');
      } else {
        setSlashFilter(textAfterSlash);
        setSlashEndIndex(cursorPos);
      }
    }
  }, [slashStartIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter for manual review
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerManualReview();
      return;
    }

    // Handle slash command menu
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredCommands[selectedSlashIndex]) {
          insertSlashCommand(filteredCommands[selectedSlashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashStartIndex(null);
        setSlashEndIndex(null);
        setSlashFilter('');
        return;
      }
    }

    // Detect slash at start of line
    if (e.key === '/') {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const textBefore = content.slice(0, cursorPos);
        const lineStart = textBefore.lastIndexOf('\n') + 1;
        const lineContent = textBefore.slice(lineStart);

        // Only show menu if slash is at start of line or after whitespace
        if (lineContent.trim() === '') {
          // Calculate position for the menu
          const rect = textarea.getBoundingClientRect();
          const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
          const lines = textBefore.split('\n').length;

          setSlashMenuPosition({
            top: rect.top + (lines * lineHeight) - textarea.scrollTop + 24,
            left: rect.left + 24,
          });
          setSlashStartIndex(cursorPos);
          // The slash hasn't been added yet, so end index will be cursorPos + 1 after it's typed
          setSlashEndIndex(cursorPos + 1);
          setShowSlashMenu(true);
          setSlashFilter('');
          setSelectedSlashIndex(0);
        }
      }
    }
  }, [showSlashMenu, filteredCommands, selectedSlashIndex, content, triggerManualReview]);

  const insertSlashCommand = useCallback((command: typeof SLASH_COMMANDS[0]) => {
    if (slashStartIndex === null || !textareaRef.current) return;

    const textarea = textareaRef.current;
    // Use stored end index, or fall back to right after the slash
    const endPos = slashEndIndex ?? (slashStartIndex + 1);

    // Remove the slash and any filter text
    const beforeSlash = content.slice(0, slashStartIndex);
    const afterCursor = content.slice(endPos);

    const newContent = beforeSlash + command.prefix + afterCursor;
    setContent(newContent);

    // Set cursor position after the inserted prefix
    setTimeout(() => {
      const newCursorPos = slashStartIndex + command.prefix.length;
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);

    setShowSlashMenu(false);
    setSlashStartIndex(null);
    setSlashEndIndex(null);
    setSlashFilter('');
  }, [content, slashStartIndex, slashEndIndex]);

  const handleHighlightClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK') {
      const suggestionId = target.dataset.suggestionId;
      if (suggestionId) {
        e.preventDefault();
        e.stopPropagation();
        setActiveSuggestion(suggestionId);
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
  }, [content, state.suggestions, acceptSuggestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
  }, [dismissSuggestion]);

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
      {/* Top toolbar with preview toggle and review button */}
      <div
        className="editor-toolbar"
        style={{
          position: 'fixed',
          top: 'var(--spacing-4)',
          right: 'var(--spacing-4)',
          display: 'flex',
          gap: 'var(--spacing-2)',
          zIndex: 100,
        }}
      >
        {/* Review button (only in manual mode) */}
        {settings.reviewMode === 'manual' && (
          <button
            onClick={triggerManualReview}
            disabled={state.status === 'thinking' || !content.trim()}
            title="Review (Cmd+Enter)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: state.status === 'thinking' ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              color: state.status === 'thinking' ? 'var(--text-tertiary)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: state.status === 'thinking' || !content.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {state.status === 'thinking' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Reviewing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Review
              </>
            )}
          </button>
        )}

        {/* Preview toggle button */}
        <button
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          title={isPreviewMode ? 'Edit' : 'Preview'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            background: isPreviewMode ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: isPreviewMode ? 'white' : 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {isPreviewMode ? (
            // Edit icon (pencil)
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          ) : (
            // Eye icon for preview
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      <div
        className="editor-container relative"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: 'var(--spacing-8) var(--spacing-6)',
          minHeight: '100vh',
        }}
      >
        {isPreviewMode ? (
          /* Preview mode - rendered markdown */
          <div
            className="preview-container"
            style={{
              paddingTop: '60px', // Space for toolbar
              ...editorStyles,
            }}
          >
            <MarkdownPreview
              source={content || '*Start writing to see preview...*'}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                ...editorStyles,
              }}
            />
          </div>
        ) : (
          <>
            {/* Highlight backdrop layer */}
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
                pointerEvents: 'none',
                zIndex: 3,
                ...editorStyles,
              }}
              dangerouslySetInnerHTML={{ __html: highlightedHTML }}
            />

            {/* Actual textarea for editing */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
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
              placeholder={settings.reviewMode === 'manual'
                ? `Start writing...

Press Cmd+Enter or click Review to analyze your writing.

Tips:
- Write naturally, Miku will suggest improvements
- Type / at the start of a line for formatting options
- Click the eye icon to preview your markdown`
                : `Start writing...

Miku will review your writing after you pause for a few seconds.

Tips:
- Write naturally, Miku will suggest improvements
- Type / at the start of a line for formatting options
- Highlighted text shows suggestions - click to see details`}
              spellCheck={false}
              aria-label="Writing editor"
            />
          </>
        )}

        {/* Slash command menu */}
        {showSlashMenu && (
          <div
            className="slash-menu"
            style={{
              position: 'fixed',
              top: slashMenuPosition.top,
              left: slashMenuPosition.left,
              zIndex: 1000,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--spacing-2)',
              minWidth: '200px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              Formatting
            </div>
            {filteredCommands.length === 0 ? (
              <div style={{ padding: '8px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                No commands found
              </div>
            ) : (
              filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={() => insertSlashCommand(cmd)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: index === selectedSlashIndex ? 'var(--bg-tertiary)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <span style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}>
                    {cmd.icon}
                  </span>
                  <span>{cmd.label}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Status indicator */}
        {state.status === 'thinking' && (
          <div className="status-indicator">
            Miku is reviewing...
          </div>
        )}

        {state.status === 'ready' && state.suggestions.length > 0 && !activeSuggestion && (
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

      {/* Suggestion panel - shows above floating bar when a suggestion is active */}
      {activeSuggestion && (
        <SuggestionPanel
          suggestion={activeSuggestion}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onClose={() => setActiveSuggestion(null)}
        />
      )}

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

// Suggestion panel component - appears above the floating bar
function SuggestionPanel({
  suggestion,
  onAccept,
  onDismiss,
  onClose,
}: {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
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

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '400px',
        width: 'calc(100vw - 32px)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-4)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: typeColors[suggestion.type],
          }}
        />
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
          {typeLabels[suggestion.type]}
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
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Observation */}
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' }}>
        {suggestion.observation}
      </p>

      {/* Original text */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px' }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Original:</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)' }}>
          {suggestion.originalText}
        </p>
      </div>

      {/* Suggested revision */}
      {suggestion.suggestedRevision !== suggestion.originalText && (
        <div style={{ background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Suggested:</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)' }}>
            {suggestion.suggestedRevision}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
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
