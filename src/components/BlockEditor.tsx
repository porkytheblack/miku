'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useSettings } from '@/context/SettingsContext';
import { useDocument } from '@/context/DocumentContext';
import { HighlightType, Suggestion } from '@/types';
import { adjustSuggestions, validateSuggestionPositions } from '@/lib/textPosition';
import dynamic from 'next/dynamic';
import Image from 'next/image';

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

// Track accepted revisions for undo and to exclude from future reviews
interface AcceptedRevision {
  id: string;
  originalText: string;
  revisedText: string;
  position: number; // Position in document when accepted
}

export default function BlockEditor() {
  const { settings } = useSettings();
  const { state, requestReview, setActiveSuggestion, acceptSuggestion, dismissSuggestion, clearSuggestions, updateSuggestions } = useMiku();
  const { document: docState, setContent: setDocContent } = useDocument();
  const [content, setContentLocal] = useState<string>('');

  // Sync content from DocumentContext when it changes (e.g., file opened)
  useEffect(() => {
    if (docState.content !== content) {
      setContentLocal(docState.content);
    }
    // Only sync when document content changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docState.content]);

  // Wrapper to update both local and context state
  const setContent = useCallback((newContent: string) => {
    setContentLocal(newContent);
    setDocContent(newContent);
  }, [setDocContent]);
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Track the content that was used for the last review
  // This is the "source of truth" for suggestion positions
  const reviewedContentRef = useRef<string>('');

  // Track accepted revisions for undo functionality
  const [acceptedRevisions, setAcceptedRevisions] = useState<AcceptedRevision[]>([]);

  // Expose preview mode and undo to parent (FloatingBar)
  const [canUndo, setCanUndo] = useState(false);

  // Update canUndo when acceptedRevisions changes
  useEffect(() => {
    setCanUndo(acceptedRevisions.length > 0);
  }, [acceptedRevisions]);

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

  // Build content for review, excluding recently accepted revisions
  const getContentForReview = useCallback(() => {
    if (acceptedRevisions.length === 0) return content;

    // Collect all accepted revision texts that are still in the document
    const exclusions: string[] = [];
    for (const revision of acceptedRevisions) {
      if (content.includes(revision.revisedText)) {
        exclusions.push(revision.revisedText);
      }
    }

    if (exclusions.length > 0) {
      // Add a note AFTER the content so line numbers aren't affected
      return `${content}\n\n---\n[Note to reviewer: The following text segments have already been reviewed and accepted by the user. Please do not suggest changes to them: ${exclusions.map(e => `"${e}"`).join(', ')}]`;
    }

    return content;
  }, [content, acceptedRevisions]);

  // Manual review function
  const triggerManualReview = useCallback(() => {
    if (content.trim()) {
      // Store the content being reviewed so we can adjust positions later
      reviewedContentRef.current = content;
      const reviewContent = getContentForReview();
      requestReview(reviewContent, {
        aggressiveness: settings.aggressiveness,
        writingContext: settings.writingContext,
        forceReview: true, // Force review even if content was reviewed before
      });
      setLastReviewedContent(content);
    }
  }, [content, requestReview, settings.aggressiveness, settings.writingContext, getContentForReview]);

  // Auto-review after pause (only in auto mode)
  useEffect(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    // Only auto-review if in auto mode
    if (settings.reviewMode === 'auto' && content && content !== lastReviewedContent && state.status === 'idle') {
      pauseTimeoutRef.current = setTimeout(() => {
        // Store the content being reviewed so we can adjust positions later
        reviewedContentRef.current = content;
        const reviewContent = getContentForReview();
        requestReview(reviewContent, {
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
  }, [content, lastReviewedContent, state.status, requestReview, settings.reviewMode, settings.aggressiveness, settings.writingContext, getContentForReview]);

  // Adjust suggestion positions when content changes after a review
  // Only run when content changes, not when suggestions change
  useEffect(() => {
    const reviewedContent = reviewedContentRef.current;

    // Skip if no reviewed content or content hasn't changed
    if (!reviewedContent || reviewedContent === content) {
      return;
    }

    // Skip if no suggestions to adjust
    if (state.suggestions.length === 0) {
      reviewedContentRef.current = content;
      return;
    }

    // Check if the change is too drastic (more than 50% different length)
    const lengthRatio = Math.min(content.length, reviewedContent.length) / Math.max(content.length, reviewedContent.length);
    if (lengthRatio < 0.5) {
      clearSuggestions();
      reviewedContentRef.current = content;
      return;
    }

    // Adjust suggestion positions based on the text edit
    const adjustedSuggestions = adjustSuggestions(state.suggestions, reviewedContent, content);

    // Validate that adjusted suggestions still point to correct text
    const validatedSuggestions = validateSuggestionPositions(adjustedSuggestions, content);

    // Update the reviewed content ref first to prevent loops
    reviewedContentRef.current = content;

    // If we lost too many suggestions, clear them all (content changed too much)
    if (validatedSuggestions.length < state.suggestions.length * 0.5) {
      clearSuggestions();
      return;
    }

    // Only update if something actually changed
    if (validatedSuggestions.length !== state.suggestions.length ||
        validatedSuggestions.some((s, i) =>
          s.startIndex !== state.suggestions[i]?.startIndex ||
          s.endIndex !== state.suggestions[i]?.endIndex
        )) {
      updateSuggestions(validatedSuggestions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Only depend on content, not suggestions

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

    // Validate and fix suggestion positions using the textPosition utilities
    const validSuggestions = validateSuggestionPositions(state.suggestions, content);

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

    // Validate the position first - the stored position might be outdated
    const currentText = content.slice(suggestion.startIndex, suggestion.endIndex);

    let startIndex = suggestion.startIndex;
    let endIndex = suggestion.endIndex;

    // If position is wrong, find the correct position
    if (currentText !== suggestion.originalText) {
      // Search for the original text in the content
      const foundIndex = content.indexOf(suggestion.originalText);
      if (foundIndex === -1) {
        // Can't find the text anymore - just dismiss the suggestion
        acceptSuggestion(id);
        return;
      }
      startIndex = foundIndex;
      endIndex = foundIndex + suggestion.originalText.length;
    }

    const newContent =
      content.slice(0, startIndex) +
      suggestion.suggestedRevision +
      content.slice(endIndex);

    // Calculate the offset change
    const lengthDiff = suggestion.suggestedRevision.length - (endIndex - startIndex);

    // Update remaining suggestions' positions
    const remainingSuggestions = state.suggestions
      .filter(s => s.id !== id)
      .map(s => {
        // If the suggestion is after the accepted one, shift its position
        if (s.startIndex > endIndex) {
          return {
            ...s,
            startIndex: s.startIndex + lengthDiff,
            endIndex: s.endIndex + lengthDiff,
          };
        }
        return s;
      });

    // Update reviewedContentRef BEFORE setContent to prevent the useEffect
    // from re-adjusting positions (we've already done that manually)
    reviewedContentRef.current = newContent;

    // Update suggestions in context (don't remove all, just update positions)
    updateSuggestions(remainingSuggestions);

    // Track this revision for undo, and update positions of previous revisions
    setAcceptedRevisions(prev => {
      // Update positions of previous revisions that come after this edit
      const updated = prev.map(r => {
        if (r.position > endIndex) {
          return { ...r, position: r.position + lengthDiff };
        }
        return r;
      });
      // Add the new revision
      return [...updated, {
        id: suggestion.id,
        originalText: suggestion.originalText,
        revisedText: suggestion.suggestedRevision,
        position: startIndex,
      }];
    });

    setContent(newContent);
    // Don't reset lastReviewedContent - keep it so we don't re-review
  }, [content, state.suggestions, acceptSuggestion, updateSuggestions]);

  // Undo the last accepted suggestion
  const handleUndo = useCallback(() => {
    if (acceptedRevisions.length === 0) return;

    const lastRevision = acceptedRevisions[acceptedRevisions.length - 1];

    // Use the stored position to find the revised text
    // Verify it's actually there at that position
    const expectedText = content.slice(
      lastRevision.position,
      lastRevision.position + lastRevision.revisedText.length
    );

    let undoPosition = lastRevision.position;

    if (expectedText !== lastRevision.revisedText) {
      // Position is wrong, fall back to searching
      const foundIndex = content.indexOf(lastRevision.revisedText);
      if (foundIndex === -1) {
        // Can't find the revised text - just remove from history
        setAcceptedRevisions(prev => prev.slice(0, -1));
        return;
      }
      undoPosition = foundIndex;
    }

    // Calculate the length difference (opposite direction of accept)
    // When undoing: originalText replaces revisedText
    const lengthDiff = lastRevision.originalText.length - lastRevision.revisedText.length;
    const endOfRevisedText = undoPosition + lastRevision.revisedText.length;

    // Update remaining suggestions' positions
    const adjustedSuggestions = state.suggestions.map(s => {
      // If the suggestion is after the undo position, shift its position
      if (s.startIndex >= endOfRevisedText) {
        return {
          ...s,
          startIndex: s.startIndex + lengthDiff,
          endIndex: s.endIndex + lengthDiff,
        };
      }
      return s;
    });

    // Replace the revised text with the original
    const newContent =
      content.slice(0, undoPosition) +
      lastRevision.originalText +
      content.slice(undoPosition + lastRevision.revisedText.length);

    // Update reviewedContentRef BEFORE setContent to prevent the useEffect
    // from re-adjusting positions (we've already done that manually)
    reviewedContentRef.current = newContent;

    // Update suggestions in context with adjusted positions
    if (state.suggestions.length > 0) {
      updateSuggestions(adjustedSuggestions);
    }

    // Update positions of remaining accepted revisions and remove the last one
    setAcceptedRevisions(prev => {
      const remaining = prev.slice(0, -1);
      return remaining.map(r => {
        if (r.position > endOfRevisedText) {
          return { ...r, position: r.position + lengthDiff };
        }
        return r;
      });
    });

    setContent(newContent);
    setLastReviewedContent('');
  }, [content, acceptedRevisions, state.suggestions, updateSuggestions]);

  const handleDismiss = useCallback((id: string) => {
    dismissSuggestion(id);
  }, [dismissSuggestion]);

  // Accept all suggestions sequentially, adjusting positions as we go
  const handleAcceptAll = useCallback(() => {
    if (state.suggestions.length === 0) return;

    // Sort suggestions by position (earliest first)
    const sortedSuggestions = [...state.suggestions].sort((a, b) => a.startIndex - b.startIndex);

    let currentContent = content;
    let cumulativeOffset = 0;
    const newAcceptedRevisions: AcceptedRevision[] = [];

    for (const suggestion of sortedSuggestions) {
      // Adjust position based on cumulative offset from previous accepts
      const adjustedStartIndex = suggestion.startIndex + cumulativeOffset;
      const adjustedEndIndex = suggestion.endIndex + cumulativeOffset;

      // Verify the text is still there
      const currentText = currentContent.slice(adjustedStartIndex, adjustedEndIndex);

      let startIndex = adjustedStartIndex;
      let endIndex = adjustedEndIndex;

      if (currentText !== suggestion.originalText) {
        // Try to find it
        const foundIndex = currentContent.indexOf(suggestion.originalText);
        if (foundIndex === -1) {
          // Skip this suggestion
          continue;
        }
        startIndex = foundIndex;
        endIndex = foundIndex + suggestion.originalText.length;
      }

      // Apply the change
      currentContent =
        currentContent.slice(0, startIndex) +
        suggestion.suggestedRevision +
        currentContent.slice(endIndex);

      // Track the length difference for future suggestions
      const lengthDiff = suggestion.suggestedRevision.length - (endIndex - startIndex);
      cumulativeOffset += lengthDiff;

      // Track for undo
      newAcceptedRevisions.push({
        id: suggestion.id,
        originalText: suggestion.originalText,
        revisedText: suggestion.suggestedRevision,
        position: startIndex,
      });
    }

    // Update reviewedContentRef to prevent auto-adjustment
    reviewedContentRef.current = currentContent;

    // Clear all suggestions
    clearSuggestions();

    // Add all accepted revisions to history
    setAcceptedRevisions(prev => [...prev, ...newAcceptedRevisions]);

    setContent(currentContent);
    setActiveSuggestion(null);
  }, [content, state.suggestions, clearSuggestions, setActiveSuggestion]);

  // Decline all suggestions
  const handleDeclineAll = useCallback(() => {
    clearSuggestions();
    setActiveSuggestion(null);
  }, [clearSuggestions, setActiveSuggestion]);

  // Rewrite selected text with AI
  const handleRewriteSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      // No selection
      return;
    }

    const selectedText = content.slice(start, end);

    // Dispatch event to request a rewrite of the selected text
    window.dispatchEvent(new CustomEvent('miku:rewriteSelection', {
      detail: { text: selectedText, startIndex: start, endIndex: end }
    }));
  }, [content]);

  // Listen for events from FloatingBar and keyboard shortcuts
  useEffect(() => {
    const handleUndoEvent = () => handleUndo();
    const handlePreviewToggle = () => setIsPreviewMode(prev => !prev);
    const handleAcceptAllEvent = () => handleAcceptAll();
    const handleDeclineAllEvent = () => handleDeclineAll();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+R: Rewrite selection
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleRewriteSelection();
      }
      // Cmd+Shift+A: Accept all suggestions
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        handleAcceptAll();
      }
      // Cmd+Shift+D: Decline all suggestions
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        handleDeclineAll();
      }
    };

    window.addEventListener('miku:undo', handleUndoEvent);
    window.addEventListener('miku:togglePreview', handlePreviewToggle);
    window.addEventListener('miku:acceptAll', handleAcceptAllEvent);
    window.addEventListener('miku:declineAll', handleDeclineAllEvent);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('miku:undo', handleUndoEvent);
      window.removeEventListener('miku:togglePreview', handlePreviewToggle);
      window.removeEventListener('miku:acceptAll', handleAcceptAllEvent);
      window.removeEventListener('miku:declineAll', handleDeclineAllEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleAcceptAll, handleDeclineAll, handleRewriteSelection]);

  // Emit state changes so FloatingBar can update
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('miku:editorState', {
      detail: { canUndo, isPreviewMode }
    }));
  }, [canUndo, isPreviewMode]);

  const activeSuggestion = state.suggestions.find(s => s.id === state.activeSuggestionId);

  const editorStyles = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
  };

  // Shared text styles - MUST be identical for textarea and highlight div
  const sharedTextStyles: React.CSSProperties = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    margin: 0,
    padding: 0,
    paddingBottom: '120px', // Extra space at bottom for floating bar
    border: 'none',
    boxSizing: 'border-box',
    letterSpacing: 'normal',
    wordSpacing: 'normal',
  };

  return (
    <div
      className="editor-wrapper w-full"
      style={{
        background: 'var(--bg-primary)',
        minHeight: '100vh',
      }}
    >
      <div
        className="editor-container"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: '32px 24px',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {isPreviewMode ? (
          /* Preview mode - rendered markdown */
          <div
            className="preview-container"
            style={{
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
          /* Editor with highlight overlay */
          <div
            className="editor-highlight-container"
            style={{
              position: 'relative',
              width: '100%',
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            {/* Textarea - the actual editable element */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              className="editor-textarea"
              style={{
                ...sharedTextStyles,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                minHeight: 'calc(100vh - 64px)',
                background: 'transparent',
                color: 'var(--text-primary)',
                caretColor: 'var(--accent-primary)',
                zIndex: 1,
                outline: 'none',
                resize: 'none',
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

            {/* Highlight layer - on top but with pointer-events: none except for marks */}
            <div
              ref={highlightRef}
              className="highlight-layer"
              onClick={handleHighlightClick}
              style={{
                ...sharedTextStyles,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                minHeight: 'calc(100vh - 64px)',
                color: 'transparent',
                background: 'transparent',
                pointerEvents: 'none',
                zIndex: 2,
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: highlightedHTML }}
            />

            {/* Invisible spacer to maintain container height */}
            <div
              style={{
                ...sharedTextStyles,
                visibility: 'hidden',
                minHeight: 'calc(100vh - 64px)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {content || 'x'}
            </div>
          </div>
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
          suggestionCount={state.suggestions.length}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onAcceptAll={handleAcceptAll}
          onDeclineAll={handleDeclineAll}
          onClose={() => setActiveSuggestion(null)}
        />
      )}

      <style jsx>{`
        .editor-textarea {
          field-sizing: content;
          /* Reset ALL browser defaults for textarea */
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          /* Ensure no internal padding from browser */
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
        }

        .editor-textarea::placeholder {
          color: var(--text-tertiary);
          opacity: 0.7;
        }

        .editor-textarea:focus {
          outline: none;
        }

        .highlight-layer {
          user-select: none;
          pointer-events: none;
          /* Match textarea text rendering exactly */
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Marks inside highlight layer receive clicks */
        .highlight-layer :global(mark) {
          pointer-events: auto;
          cursor: pointer;
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
  suggestionCount,
  onAccept,
  onDismiss,
  onAcceptAll,
  onDeclineAll,
  onClose,
}: {
  suggestion: Suggestion;
  suggestionCount: number;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcceptAll: () => void;
  onDeclineAll: () => void;
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
      {/* Header with Miku icon */}
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

      {/* Observation */}
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px', wordWrap: 'break-word' }}>
        {suggestion.observation}
      </p>

      {/* Original text */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', overflowX: 'auto' }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Original:</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.5' }}>
          {suggestion.originalText}
        </p>
      </div>

      {/* Suggested revision */}
      {suggestion.suggestedRevision !== suggestion.originalText && (
        <div style={{ background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', overflowX: 'auto' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '4px' }}>Suggested:</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordWrap: 'break-word', lineHeight: '1.5' }}>
            {suggestion.suggestedRevision}
          </p>
        </div>
      )}

      {/* Actions for this suggestion */}
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

      {/* Bulk actions - only show if there are multiple suggestions */}
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

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
