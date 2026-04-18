'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EditorView, placeholder, drawSelection } from '@codemirror/view';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap, search } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import dynamic from 'next/dynamic';

import { useMiku } from '@/context/MikuContext';
import { useSettings } from '@/context/SettingsContext';
import { useDocument } from '@/context/DocumentContext';
import { useKeyboardSounds } from '@/hooks/useKeyboardSounds';
import { Suggestion } from '@/types';
import { adjustSuggestions, validateSuggestionPositions } from '@/lib/textPosition';

import { mikuTheme } from './cm6/theme';
import { livePreview } from './cm6/extensions/livePreview';
import { suggestionsPlugin, suggestionsFacet, activeSuggestionIdFacet, onSuggestionClickFacet } from './cm6/extensions/suggestions';
import { slashCommandsExtension } from './cm6/extensions/slashCommands';
import { smartFormattingExtension } from './cm6/extensions/smartFormatting';
import { keyboardSoundsExtension } from './cm6/extensions/keyboardSounds';
import { imagePasteDropExtension } from './cm6/extensions/imagePasteDrop';
import SuggestionPanel from './SuggestionPanel';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview').then(mod => mod.default), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--text-tertiary)' }}>Loading preview...</div>
});

interface AcceptedRevision {
  id: string;
  originalText: string;
  revisedText: string;
  position: number;
}

export default function CodeMirrorEditor() {
  const { settings } = useSettings();
  const {
    state,
    requestReview,
    requestRewrite,
    setActiveSuggestion,
    acceptSuggestion,
    dismissSuggestion,
    clearSuggestions,
    updateSuggestions,
  } = useMiku();
  const {
    setContent: setDocContent,
    activeDocumentId,
    registerContentGetter,
    openDocuments,
  } = useDocument();
  const { playKeySound } = useKeyboardSounds();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef<string>('');
  const reviewedContentRef = useRef<string>('');
  const lastLoadedContentRef = useRef<string>('');
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compartments for dynamic reconfiguration
  const themeCompartment = useRef(new Compartment());
  const suggestionsCompartment = useRef(new Compartment());
  const livePreviewCompartment = useRef(new Compartment());
  const imagePasteCompartment = useRef(new Compartment());
  const smartFormattingCompartment = useRef(new Compartment());

  // ── State ─────────────────────────────────────────────────────────────────
  const [editingDocId, setEditingDocId] = useState<string | null>(activeDocumentId);
  const [lastReviewedContent, setLastReviewedContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [acceptedRevisions, setAcceptedRevisions] = useState<AcceptedRevision[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  // content state for preview mode and status indicators
  const [content, setContentState] = useState('');

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeDocumentPath = useMemo(() => {
    const doc = openDocuments.find(d => d.id === activeDocumentId);
    return doc?.path ?? null;
  }, [openDocuments, activeDocumentId]);

  // ── Callbacks that need stable refs for use in CM extensions ─────────────
  const callbacksRef = useRef({
    triggerManualReview: () => {},
    handleRewriteSelection: async () => {},
    handleAcceptAll: () => {},
    handleDeclineAll: () => {},
  });

  // ── setContent helper ─────────────────────────────────────────────────────
  const setContent = useCallback((newContent: string) => {
    contentRef.current = newContent;
    setContentState(newContent);
    setDocContent(newContent);
  }, [setDocContent]);

  // ── Register content getter ───────────────────────────────────────────────
  useEffect(() => {
    registerContentGetter(() => contentRef.current);
  }, [registerContentGetter]);

  // ── Build content for review ──────────────────────────────────────────────
  const getContentForReview = useCallback(() => {
    const cur = contentRef.current;
    if (acceptedRevisions.length === 0) return cur;
    const exclusions: string[] = [];
    for (const rev of acceptedRevisions) {
      if (cur.includes(rev.revisedText)) exclusions.push(rev.revisedText);
    }
    if (exclusions.length > 0) {
      return `${cur}\n\n---\n[Note to reviewer: The following text segments have already been reviewed and accepted by the user. Please do not suggest changes to them: ${exclusions.map(e => `"${e}"`).join(', ')}]`;
    }
    return cur;
  }, [acceptedRevisions]);

  // ── Manual review ─────────────────────────────────────────────────────────
  const triggerManualReview = useCallback(() => {
    const cur = contentRef.current;
    if (!cur.trim()) return;
    reviewedContentRef.current = cur;
    const reviewContent = getContentForReview();
    requestReview(reviewContent, {
      aggressiveness: settings.aggressiveness,
      writingContext: settings.writingContext,
      forceReview: true,
    });
    setLastReviewedContent(cur);
  }, [getContentForReview, requestReview, settings.aggressiveness, settings.writingContext]);

  // ── Accept handler ────────────────────────────────────────────────────────
  const handleAccept = useCallback((id: string) => {
    const suggestion = state.suggestions.find(s => s.id === id);
    if (!suggestion) return;

    const cur = contentRef.current;
    let startIndex = suggestion.startIndex;
    let endIndex = suggestion.endIndex;
    const currentText = cur.slice(startIndex, endIndex);

    if (currentText !== suggestion.originalText) {
      const foundIndex = cur.indexOf(suggestion.originalText);
      if (foundIndex === -1) {
        acceptSuggestion(id);
        return;
      }
      startIndex = foundIndex;
      endIndex = foundIndex + suggestion.originalText.length;
    }

    const newContent = cur.slice(0, startIndex) + suggestion.suggestedRevision + cur.slice(endIndex);
    const lengthDiff = suggestion.suggestedRevision.length - (endIndex - startIndex);

    const remainingSuggestions = state.suggestions
      .filter(s => s.id !== id)
      .map(s => s.startIndex > endIndex ? { ...s, startIndex: s.startIndex + lengthDiff, endIndex: s.endIndex + lengthDiff } : s);

    reviewedContentRef.current = newContent;
    updateSuggestions(remainingSuggestions);

    setAcceptedRevisions(prev => {
      const updated = prev.map(r => r.position > endIndex ? { ...r, position: r.position + lengthDiff } : r);
      return [...updated, { id: suggestion.id, originalText: suggestion.originalText, revisedText: suggestion.suggestedRevision, position: startIndex }];
    });

    // Apply change in CM6 editor
    const view = viewRef.current;
    if (view) {
      view.dispatch({ changes: { from: startIndex, to: endIndex, insert: suggestion.suggestedRevision } });
    } else {
      setContent(newContent);
    }
  }, [state.suggestions, acceptSuggestion, updateSuggestions, setContent]);

  // ── Undo handler ──────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (acceptedRevisions.length === 0) return;
    const lastRevision = acceptedRevisions[acceptedRevisions.length - 1];
    const cur = contentRef.current;
    const expectedText = cur.slice(lastRevision.position, lastRevision.position + lastRevision.revisedText.length);
    let undoPosition = lastRevision.position;

    if (expectedText !== lastRevision.revisedText) {
      const foundIndex = cur.indexOf(lastRevision.revisedText);
      if (foundIndex === -1) {
        setAcceptedRevisions(prev => prev.slice(0, -1));
        return;
      }
      undoPosition = foundIndex;
    }

    const lengthDiff = lastRevision.originalText.length - lastRevision.revisedText.length;
    const endOfRevisedText = undoPosition + lastRevision.revisedText.length;

    const adjustedSuggestions = state.suggestions.map(s =>
      s.startIndex >= endOfRevisedText
        ? { ...s, startIndex: s.startIndex + lengthDiff, endIndex: s.endIndex + lengthDiff }
        : s
    );

    const newContent = cur.slice(0, undoPosition) + lastRevision.originalText + cur.slice(undoPosition + lastRevision.revisedText.length);
    reviewedContentRef.current = newContent;

    if (state.suggestions.length > 0) updateSuggestions(adjustedSuggestions);

    setAcceptedRevisions(prev => {
      const remaining = prev.slice(0, -1);
      return remaining.map(r => r.position > endOfRevisedText ? { ...r, position: r.position + lengthDiff } : r);
    });

    const view = viewRef.current;
    if (view) {
      view.dispatch({ changes: { from: undoPosition, to: undoPosition + lastRevision.revisedText.length, insert: lastRevision.originalText } });
    } else {
      setContent(newContent);
    }
    setLastReviewedContent('');
  }, [acceptedRevisions, state.suggestions, updateSuggestions, setContent]);

  // ── Accept all ────────────────────────────────────────────────────────────
  const handleAcceptAll = useCallback(() => {
    if (state.suggestions.length === 0) return;
    const sorted = [...state.suggestions].sort((a, b) => a.startIndex - b.startIndex);
    let cur = contentRef.current;
    let offset = 0;
    const newRevisions: AcceptedRevision[] = [];

    for (const s of sorted) {
      const adjStart = s.startIndex + offset;
      const adjEnd = s.endIndex + offset;
      let startIndex = adjStart;
      let endIndex = adjEnd;

      const currentText = cur.slice(adjStart, adjEnd);
      if (currentText !== s.originalText) {
        const found = cur.indexOf(s.originalText);
        if (found === -1) continue;
        startIndex = found;
        endIndex = found + s.originalText.length;
      }

      cur = cur.slice(0, startIndex) + s.suggestedRevision + cur.slice(endIndex);
      const diff = s.suggestedRevision.length - (endIndex - startIndex);
      offset += diff;
      newRevisions.push({ id: s.id, originalText: s.originalText, revisedText: s.suggestedRevision, position: startIndex });
    }

    reviewedContentRef.current = cur;
    clearSuggestions();
    setAcceptedRevisions(prev => [...prev, ...newRevisions]);
    setActiveSuggestion(null);

    const view = viewRef.current;
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: cur } });
    } else {
      setContent(cur);
    }
  }, [state.suggestions, clearSuggestions, setActiveSuggestion, setContent]);

  // ── Decline all ───────────────────────────────────────────────────────────
  const handleDeclineAll = useCallback(() => {
    clearSuggestions();
    setActiveSuggestion(null);
  }, [clearSuggestions, setActiveSuggestion]);

  // ── Rewrite selection ─────────────────────────────────────────────────────
  const handleRewriteSelection = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    if (from === to) return;

    const selectedText = view.state.doc.sliceString(from, to);
    const result = await requestRewrite(selectedText, from, to);

    if (result) {
      const cur = contentRef.current;
      const newContent = cur.slice(0, result.startIndex) + result.rewrittenText + cur.slice(result.endIndex);
      const lengthDiff = result.rewrittenText.length - (result.endIndex - result.startIndex);

      reviewedContentRef.current = newContent;

      setAcceptedRevisions(prev => {
        const updated = prev.map(r => r.position > result.endIndex ? { ...r, position: r.position + lengthDiff } : r);
        return [...updated, { id: `rewrite-${Date.now()}`, originalText: selectedText, revisedText: result.rewrittenText, position: result.startIndex }];
      });

      view.dispatch({
        changes: { from: result.startIndex, to: result.endIndex, insert: result.rewrittenText },
        selection: { anchor: result.startIndex + result.rewrittenText.length },
      });
    }
  }, [requestRewrite]);

  // ── Keep callbacksRef current ─────────────────────────────────────────────
  useEffect(() => {
    callbacksRef.current = {
      triggerManualReview,
      handleRewriteSelection,
      handleAcceptAll,
      handleDeclineAll,
    };
  }, [triggerManualReview, handleRewriteSelection, handleAcceptAll, handleDeclineAll]);

  // ── canUndo tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    setCanUndo(acceptedRevisions.length > 0);
  }, [acceptedRevisions]);

  // ── Auto-review timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

    if (settings.reviewMode === 'auto' && content && content !== lastReviewedContent && state.status === 'idle') {
      pauseTimeoutRef.current = setTimeout(() => {
        reviewedContentRef.current = contentRef.current;
        const reviewContent = getContentForReview();
        requestReview(reviewContent, {
          aggressiveness: settings.aggressiveness,
          writingContext: settings.writingContext,
        });
        setLastReviewedContent(contentRef.current);
      }, 3000);
    }

    return () => { if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current); };
  }, [content, lastReviewedContent, state.status, requestReview, settings.reviewMode, settings.aggressiveness, settings.writingContext, getContentForReview]);

  // ── Adjust suggestion positions on content change ─────────────────────────
  useEffect(() => {
    const reviewedContent = reviewedContentRef.current;
    if (!reviewedContent || reviewedContent === content) return;
    if (state.suggestions.length === 0) { reviewedContentRef.current = content; return; }

    const lengthRatio = Math.min(content.length, reviewedContent.length) / Math.max(content.length, reviewedContent.length);
    if (lengthRatio < 0.5) { clearSuggestions(); reviewedContentRef.current = content; return; }

    const adjusted = adjustSuggestions(state.suggestions, reviewedContent, content);
    const validated = validateSuggestionPositions(adjusted, content);
    reviewedContentRef.current = content;

    if (validated.length < state.suggestions.length * 0.5) { clearSuggestions(); return; }

    if (validated.length !== state.suggestions.length ||
        validated.some((s, i) => s.startIndex !== state.suggestions[i]?.startIndex || s.endIndex !== state.suggestions[i]?.endIndex)) {
      updateSuggestions(validated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // ── Event listeners (FloatingBar / keyboard shortcuts) ────────────────────
  useEffect(() => {
    const handleUndoEvent = () => handleUndo();
    const handlePreviewToggle = () => setIsPreviewMode(prev => !prev);
    const handleAcceptAllEvent = () => callbacksRef.current.handleAcceptAll();
    const handleDeclineAllEvent = () => callbacksRef.current.handleDeclineAll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        void callbacksRef.current.handleRewriteSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        callbacksRef.current.handleAcceptAll();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        callbacksRef.current.handleDeclineAll();
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
  }, [handleUndo]);

  // ── Emit editor state for FloatingBar ─────────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('miku:editorState', {
      detail: { canUndo, isPreviewMode }
    }));
  }, [canUndo, isPreviewMode]);

  // ── Initialize CM6 editor ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const initialDoc = openDocuments.find(d => d.id === activeDocumentId)?.content ?? '';
    contentRef.current = initialDoc;
    lastLoadedContentRef.current = initialDoc;
    setContentState(initialDoc);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Check if this was triggered by our own dispatch (suggestion accept, etc.)
        const isUserEdit = update.transactions.some(tr => !tr.annotation(Transaction.remote));
        const newContent = update.state.doc.toString();
        contentRef.current = newContent;
        if (isUserEdit) {
          setContentState(newContent);
          setDocContent(newContent);
        }
      }
    });

    const startState = EditorState.create({
      doc: initialDoc,
      extensions: [
        themeCompartment.current.of(mikuTheme({
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: settings.fontFamily,
        })),
        livePreviewCompartment.current.of(livePreview(activeDocumentPath)),
        suggestionsCompartment.current.of([
          suggestionsFacet.of([]),
          activeSuggestionIdFacet.of(null),
          onSuggestionClickFacet.of(() => {}),
          suggestionsPlugin,
        ]),
        imagePasteCompartment.current.of(imagePasteDropExtension(activeDocumentPath)),
        smartFormattingCompartment.current.of(smartFormattingExtension({
          onManualReview: () => callbacksRef.current.triggerManualReview(),
          onRewriteSelection: () => void callbacksRef.current.handleRewriteSelection(),
          onAcceptAll: () => callbacksRef.current.handleAcceptAll(),
          onDeclineAll: () => callbacksRef.current.handleDeclineAll(),
        })),
        keyboardSoundsExtension(playKeySound),
        slashCommandsExtension(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        search({ top: true }),
        drawSelection(),
        EditorView.lineWrapping,
        placeholder(settings.reviewMode === 'manual'
          ? 'Start writing...\n\nPress Cmd+Enter or click Review to analyze your writing.'
          : 'Start writing...\n\nMiku will review your writing after you pause for a few seconds.'),
        updateListener,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reconfigure theme when font settings change ───────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(mikuTheme({
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        fontFamily: settings.fontFamily,
      })),
    });
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily]);

  // ── Reconfigure suggestions when state changes ────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: suggestionsCompartment.current.reconfigure([
        suggestionsFacet.of(state.suggestions),
        activeSuggestionIdFacet.of(state.activeSuggestionId),
        onSuggestionClickFacet.of((id: string) => setActiveSuggestion(id)),
        suggestionsPlugin,
      ]),
    });
  }, [state.suggestions, state.activeSuggestionId, setActiveSuggestion]);

  // ── Reconfigure livePreview + imagePaste when document path changes ────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        livePreviewCompartment.current.reconfigure(livePreview(activeDocumentPath)),
        imagePasteCompartment.current.reconfigure(imagePasteDropExtension(activeDocumentPath)),
      ],
    });
  }, [activeDocumentPath]);

  // ── Reconfigure smartFormatting callbacks (stable, only reconfigure if needed) ──
  // (Callbacks are referenced via callbacksRef so they don't need reconfiguration)

  // ── Document switching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeDocumentId === editingDocId) return;

    setEditingDocId(activeDocumentId);
    const targetDoc = openDocuments.find(d => d.id === activeDocumentId);
    const newContent = targetDoc?.content ?? '';

    contentRef.current = newContent;
    lastLoadedContentRef.current = newContent;
    setContentState(newContent);

    clearSuggestions();
    setActiveSuggestion(null);
    setAcceptedRevisions([]);
    setLastReviewedContent('');
    reviewedContentRef.current = '';

    // Replace CM6 doc
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
        annotations: Transaction.remote.of(true),
      });
    }
  }, [activeDocumentId, editingDocId, openDocuments, clearSuggestions, setActiveSuggestion]);

  // ── External content sync (file opened from disk) ─────────────────────────
  useEffect(() => {
    if (activeDocumentId !== editingDocId) return;

    const currentDoc = openDocuments.find(d => d.id === activeDocumentId);
    const contextContent = currentDoc?.content ?? '';

    if (contextContent !== lastLoadedContentRef.current && contextContent !== contentRef.current) {
      contentRef.current = contextContent;
      lastLoadedContentRef.current = contextContent;
      setContentState(contextContent);

      const view = viewRef.current;
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: contextContent },
          annotations: Transaction.remote.of(true),
        });
      }
    }
  }, [activeDocumentId, editingDocId, openDocuments]);

  const activeSuggestion = state.suggestions.find(s => s.id === state.activeSuggestionId);

  return (
    <div
      className="editor-wrapper"
      style={{ background: 'var(--bg-primary)', minHeight: '100vh', width: '100%' }}
    >
      <div
        className="editor-container"
        style={{ width: '100%', maxWidth: '100%', padding: '32px 24px', minHeight: '100vh', boxSizing: 'border-box' }}
      >
        {isPreviewMode ? (
          <MarkdownPreview
            source={content || '*Start writing to see preview...*'}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
            }}
          />
        ) : (
          <div ref={containerRef} className="cm-editor-container" />
        )}

        {/* Status indicators */}
        {state.status === 'thinking' && (
          <div className="status-indicator">Miku is reviewing...</div>
        )}
        {state.status === 'ready' && state.suggestions.length > 0 && !activeSuggestion && (
          <div className="status-indicator">
            {state.suggestions.length} suggestion{state.suggestions.length !== 1 ? 's' : ''} — click highlighted text to review
          </div>
        )}
        {state.status === 'error' && state.error && (
          <div className="status-indicator error">Error: {state.error}</div>
        )}
      </div>

      {activeSuggestion && (
        <SuggestionPanel
          suggestion={activeSuggestion}
          suggestionCount={state.suggestions.length}
          onAccept={handleAccept}
          onDismiss={dismissSuggestion}
          onAcceptAll={handleAcceptAll}
          onDeclineAll={handleDeclineAll}
          onClose={() => setActiveSuggestion(null)}
        />
      )}

      <style jsx>{`
        .cm-editor-container :global(.cm-editor) {
          width: 100%;
          min-height: calc(100vh - 64px);
        }
        .cm-editor-container :global(.cm-scroller) {
          scrollbar-width: thin;
          scrollbar-color: var(--border-default) transparent;
        }
        .cm-editor-container :global(.cm-scroller::-webkit-scrollbar) {
          width: 8px;
        }
        .cm-editor-container :global(.cm-scroller::-webkit-scrollbar-track) {
          background: transparent;
        }
        .cm-editor-container :global(.cm-scroller::-webkit-scrollbar-thumb) {
          background: var(--border-default);
          border-radius: 4px;
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
          white-space: nowrap;
        }
        .status-indicator.error {
          background: var(--highlight-grammar);
          color: white;
        }
        .editor-wrapper {
          scrollbar-width: thin;
          scrollbar-color: var(--border-default) transparent;
        }
      `}</style>
    </div>
  );
}
