'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useNotes } from '@/context/NotesContext';
import { useAuth } from '@/components/AuthProvider';
import SettingsPanel from './SettingsPanel';
import NotesModal from './NotesModal';
import ClerkButtons from './ClerkButtons';

export default function FloatingBar() {
  const { state, requestReview } = useMiku();
  const { createNote, updateNote } = useNotes();
  const { isSignedIn } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);

  // Listen for editor state changes
  useEffect(() => {
    const handleEditorState = (e: CustomEvent<{
      canUndo: boolean;
      canRedo: boolean;
      isPreviewMode: boolean;
      noteId?: string | null;
    }>) => {
      setCanUndo(e.detail.canUndo);
      setCanRedo(e.detail.canRedo ?? false);
      setIsPreviewMode(e.detail.isPreviewMode);
      if (e.detail.noteId !== undefined) {
        setCurrentNoteId(e.detail.noteId);
      }
    };

    window.addEventListener('miku:editorState', handleEditorState as EventListener);
    return () => {
      window.removeEventListener('miku:editorState', handleEditorState as EventListener);
    };
  }, []);

  const isVisible = isHovered || state.status !== 'idle' || showSettings || showNotes;

  const handleManualReview = useCallback(() => {
    const editor = document.querySelector('textarea');
    if (editor) {
      requestReview((editor as HTMLTextAreaElement).value);
    }
  }, [requestReview]);

  const handleUndo = useCallback(() => {
    window.dispatchEvent(new Event('miku:undo'));
  }, []);

  const handleRedo = useCallback(() => {
    window.dispatchEvent(new Event('miku:redo'));
  }, []);

  const handleTogglePreview = useCallback(() => {
    window.dispatchEvent(new Event('miku:togglePreview'));
  }, []);

  const handleCopyAll = useCallback(async () => {
    const editor = document.querySelector('textarea');
    if (editor) {
      const content = (editor as HTMLTextAreaElement).value;
      try {
        await navigator.clipboard.writeText(content);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!isSignedIn) return;

    const editor = document.querySelector('textarea');
    if (!editor) return;

    const content = (editor as HTMLTextAreaElement).value;
    if (!content.trim()) return;

    setIsSaving(true);

    try {
      // Extract title from first line or use "Untitled"
      const firstLine = content.split('\n')[0];
      const title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 100) || 'Untitled';

      if (currentNoteId) {
        // Update existing note
        await updateNote(currentNoteId, {
          title,
          content,
          suggestions: state.suggestions,
        });
      } else {
        // Create new note
        const note = await createNote(title, content, state.suggestions);
        if (note) {
          setCurrentNoteId(note.id);
          // Notify editor of new note ID
          window.dispatchEvent(new CustomEvent('miku:noteCreated', {
            detail: { noteId: note.id },
          }));
        }
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [isSignedIn, currentNoteId, state.suggestions, createNote, updateNote]);

  const handleLoadNote = useCallback((content: string, title: string, noteId: string) => {
    setCurrentNoteId(noteId);
    // Dispatch event to load content into editor
    window.dispatchEvent(new CustomEvent('miku:loadNote', {
      detail: { content, title, noteId },
    }));
  }, []);

  const handleNewNote = useCallback(() => {
    setCurrentNoteId(null);
    // Clear the editor
    window.dispatchEvent(new CustomEvent('miku:newNote'));
  }, []);

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
          className="flex items-center justify-center gap-2 px-3 py-2"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '120px',
            height: '44px',
          }}
        >
          {/* User button / Sign in */}
          <ClerkButtons isSignedIn={isSignedIn} />

          <Divider />

          {/* New note button */}
          <button
            onClick={handleNewNote}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label="New note"
            title="New note"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-secondary)' }}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {/* Notes button */}
          <button
            onClick={() => setShowNotes(true)}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label="Browse notes"
            title="Browse notes"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-secondary)' }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>

          {/* Save button */}
          {isSignedIn && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
              aria-label="Save note"
              title={currentNoteId ? 'Save changes' : 'Save as new note'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: isSaving ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {isSaving ? (
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                ) : (
                  <>
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </>
                )}
              </svg>
            </button>
          )}

          <Divider />

          {/* Preview toggle button */}
          <button
            onClick={handleTogglePreview}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label={isPreviewMode ? 'Edit' : 'Preview'}
            title={isPreviewMode ? 'Edit (exit preview)' : 'Preview'}
          >
            {isPreviewMode ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--accent-primary)' }}
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--text-secondary)' }}
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopyAll}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label="Copy all content"
            title="Copy all content"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: copyFeedback ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {copyFeedback ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>

          <Divider />

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

          {/* Undo/Redo buttons */}
          {(canUndo || canRedo) && (
            <>
              <Divider />
              {canUndo && (
                <button
                  onClick={handleUndo}
                  className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                  aria-label="Undo"
                  title="Undo (Cmd+Z)"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                </button>
              )}
              {canRedo && (
                <button
                  onClick={handleRedo}
                  className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                  aria-label="Redo"
                  title="Redo (Cmd+Shift+Z)"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                  </svg>
                </button>
              )}
            </>
          )}

          <Divider />

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

      {/* Notes modal */}
      <NotesModal
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
        onLoadNote={handleLoadNote}
      />
    </>
  );
}

function Divider() {
  return (
    <div
      className="w-px h-4"
      style={{ background: 'var(--border-default)' }}
    />
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
