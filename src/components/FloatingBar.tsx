'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';
import SettingsPanel from './SettingsPanel';

interface FloatingBarProps {
  onToggleFileBrowser?: () => void;
}

export default function FloatingBar({ onToggleFileBrowser }: FloatingBarProps) {
  const { state, requestReview } = useMiku();
  const { document, openDocument, saveDocument, newDoc } = useDocument();
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [inTauri, setInTauri] = useState(false);

  // Check if running in Tauri
  useEffect(() => {
    setInTauri(isTauri());
  }, []);

  // Listen for editor state changes
  useEffect(() => {
    const handleEditorState = (e: CustomEvent<{ canUndo: boolean; isPreviewMode: boolean }>) => {
      setCanUndo(e.detail.canUndo);
      setIsPreviewMode(e.detail.isPreviewMode);
    };

    window.addEventListener('miku:editorState', handleEditorState as EventListener);
    return () => {
      window.removeEventListener('miku:editorState', handleEditorState as EventListener);
    };
  }, []);

  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New document
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        newDoc();
      }
      // Cmd/Ctrl + O: Open document
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        openDocument();
      }
      // Cmd/Ctrl + S: Save document
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
      // Cmd/Ctrl + B: Toggle file browser
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && onToggleFileBrowser) {
        e.preventDefault();
        onToggleFileBrowser();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newDoc, openDocument, saveDocument, onToggleFileBrowser]);

  const isVisible = isHovered || state.status !== 'idle' || showSettings || showFileMenu;

  const handleManualReview = useCallback(() => {
    const editor = window.document.querySelector('textarea');
    if (editor) {
      requestReview((editor as HTMLTextAreaElement).value);
    }
  }, [requestReview]);

  const handleUndo = useCallback(() => {
    window.dispatchEvent(new Event('miku:undo'));
  }, []);

  const handleTogglePreview = useCallback(() => {
    window.dispatchEvent(new Event('miku:togglePreview'));
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
          className="flex items-center justify-center gap-3 px-4 py-2"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '120px',
            height: '40px',
          }}
        >
          {/* File browser button (only in Tauri) */}
          {inTauri && onToggleFileBrowser && (
            <>
              <button
                onClick={onToggleFileBrowser}
                className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                aria-label="File browser"
                title="Open file browser (Cmd+B)"
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
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              {/* Divider */}
              <div
                className="w-px h-4"
                style={{ background: 'var(--border-default)' }}
              />
            </>
          )}

          {/* File menu button (only in Tauri) */}
          {inTauri && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowFileMenu(!showFileMenu)}
                  className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                  aria-label="File menu"
                  title="File menu"
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
                  </svg>
                </button>

                {/* File menu dropdown */}
                {showFileMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-2"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '180px',
                      padding: 'var(--spacing-1)',
                    }}
                  >
                    <button
                      onClick={() => { newDoc(); setShowFileMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                      style={{ fontSize: '14px', color: 'var(--text-primary)' }}
                    >
                      <span>New</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Cmd+N</span>
                    </button>
                    <button
                      onClick={() => { openDocument(); setShowFileMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                      style={{ fontSize: '14px', color: 'var(--text-primary)' }}
                    >
                      <span>Open...</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Cmd+O</span>
                    </button>
                    <button
                      onClick={() => { saveDocument(); setShowFileMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                      style={{ fontSize: '14px', color: 'var(--text-primary)' }}
                    >
                      <span>Save</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Cmd+S</span>
                    </button>
                    <button
                      onClick={() => { saveDocument(undefined); setShowFileMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                      style={{ fontSize: '14px', color: 'var(--text-primary)' }}
                    >
                      <span>Save As...</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Cmd+Shift+S</span>
                    </button>
                    {document.path && (
                      <div
                        className="px-3 py-2 border-t"
                        style={{
                          borderColor: 'var(--border-default)',
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          marginTop: '4px',
                          paddingTop: '8px',
                        }}
                      >
                        {document.path.split('/').pop()}
                        {document.isModified && ' (modified)'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div
                className="w-px h-4"
                style={{ background: 'var(--border-default)' }}
              />
            </>
          )}

          {/* Preview toggle button */}
          <button
            onClick={handleTogglePreview}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            aria-label={isPreviewMode ? 'Edit' : 'Preview'}
            title={isPreviewMode ? 'Edit (exit preview)' : 'Preview'}
          >
            {isPreviewMode ? (
              // Edit icon (pencil)
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
              // Eye icon for preview
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

          {/* Divider */}
          <div
            className="w-px h-4"
            style={{ background: 'var(--border-default)' }}
          />

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

          {/* Undo button - only show when there's something to undo */}
          {canUndo && (
            <>
              {/* Divider */}
              <div
                className="w-px h-4"
                style={{ background: 'var(--border-default)' }}
              />
              <button
                onClick={handleUndo}
                className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                aria-label="Undo last change"
                title="Undo last accepted suggestion"
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
            </>
          )}

          {/* Divider */}
          <div
            className="w-px h-4"
            style={{ background: 'var(--border-default)' }}
          />

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

      {/* Click outside to close file menu */}
      {showFileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFileMenu(false)}
        />
      )}

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </>
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
