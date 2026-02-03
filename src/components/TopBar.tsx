'use client';

import { useState, useEffect } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';
import { getFileTypeFromPath } from '@/lib/fileTypes';
import type { FileType } from '@/types';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface TopBarProps {
  onToggleFileBrowser?: () => void;
  onToggleCommandPalette?: () => void;
  onToggleSettings?: () => void;
}

/**
 * Extensions to strip from display names (in order of specificity)
 */
const EXTENSIONS_TO_STRIP = [
  '.miku-env', '.mikuenv',
  '.miku-kanban', '.kanban',
  '.miku-docs', '.docs',
  '.markdown', '.mdown', '.md',
  '.txt', '.json'
];

/**
 * Get display name without file extension
 */
function getDisplayName(filePath: string | null): string {
  if (!filePath) {
    return 'Untitled';
  }

  const fileName = filePath.split('/').pop() || 'Untitled';

  for (const ext of EXTENSIONS_TO_STRIP) {
    if (fileName.toLowerCase().endsWith(ext)) {
      const stripped = fileName.slice(0, -ext.length);
      // Don't return empty string (e.g., if file is just ".md")
      return stripped || fileName;
    }
  }

  return fileName;
}

/**
 * Get file type icon for tab
 */
function TabIcon({ fileType, isActive }: { fileType: FileType; isActive: boolean }) {
  const specialColor = isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)';
  const defaultColor = 'var(--text-tertiary)';

  switch (fileType) {
    case 'miku-env':
      // Lock/key icon for env files
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="3" y="7" width="10" height="7" rx="1.5"
            fill={isActive ? 'var(--accent-subtle)' : 'transparent'}
            stroke={specialColor} strokeWidth="1.5" />
          <path d="M5 7V5a3 3 0 116 0v2"
            stroke={specialColor} strokeWidth="1.5" fill="none" />
          <circle cx="8" cy="10.5" r="1" fill={specialColor} />
        </svg>
      );

    case 'kanban':
      // Three columns icon for kanban
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="2" y="2" width="12" height="12" rx="1.5"
            stroke={specialColor} strokeWidth="1.5"
            fill={isActive ? 'var(--accent-subtle)' : 'transparent'} />
          <line x1="6" y1="2" x2="6" y2="14" stroke={specialColor} strokeWidth="1" />
          <line x1="10" y1="2" x2="10" y2="14" stroke={specialColor} strokeWidth="1" />
        </svg>
      );

    case 'docs':
      // Book icon for docs
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 13V3C3 2.45 3.45 2 4 2H12V14H4C3.45 14 3 13.55 3 13Z"
            fill={isActive ? 'var(--accent-subtle)' : 'transparent'}
            stroke={specialColor} strokeWidth="1.5" />
          <path d="M3 13C3 12.45 3.45 12 4 12H12"
            stroke={specialColor} strokeWidth="1.5" />
          <line x1="5.5" y1="5" x2="10" y2="5"
            stroke={specialColor} strokeWidth="1" strokeLinecap="round" />
          <line x1="5.5" y1="7.5" x2="9" y2="7.5"
            stroke={specialColor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'markdown':
    default:
      // Document with lines icon for markdown
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 2h7l3 3v9H3V2z"
            stroke={defaultColor} strokeWidth="1.5" fill="none" />
          <path d="M10 2v3h3"
            stroke={defaultColor} strokeWidth="1.5" fill="none" />
          <path d="M5 8h6M5 10.5h4"
            stroke={defaultColor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function TopBar({ onToggleFileBrowser, onToggleCommandPalette, onToggleSettings }: TopBarProps) {
  const { openDocuments, activeDocumentId, switchToDocument, closeDocument, newDoc } = useDocument();
  const [isMounted, setIsMounted] = useState(false);

  // Only check isTauri after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only show Tauri-specific features after mount
  const inTauri = isMounted && isTauri();

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {/* Workspace switcher (left side, only in Tauri) */}
      {inTauri && (
        <>
          <WorkspaceSwitcher />

          {/* Vertical divider */}
          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'var(--border-default)',
              marginLeft: '6px',
              marginRight: '6px',
              flexShrink: 0,
            }}
          />
        </>
      )}

      {/* Document tabs - scrollable area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          flex: 1,
          overflowX: 'auto',
          minWidth: 0,
        }}
      >
        {openDocuments.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const fileType = doc.path ? getFileTypeFromPath(doc.path) : 'markdown';
          const displayName = getDisplayName(doc.path);

          return (
            <div
              key={doc.id}
              onClick={() => switchToDocument(doc.id)}
              title={doc.path || 'Untitled'} // Full path as tooltip
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease',
                flexShrink: 0,
                maxWidth: '180px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {/* File type icon */}
              <TabIcon fileType={fileType} isActive={isActive} />

              {/* Document name (truncated) */}
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {displayName}
              </span>

              {/* Modified indicator */}
              {doc.isModified && (
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>*</span>
              )}

              {/* Close button */}
              {openDocuments.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDocument(doc.id);
                  }}
                  aria-label={`Close ${displayName} tab`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    color: 'var(--text-tertiary)',
                    marginLeft: '2px',
                    flexShrink: 0,
                    opacity: 0.7,
                    transition: 'opacity 0.1s ease, background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.opacity = '0.7';
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M1 1l8 8M9 1L1 9" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {/* New tab button */}
        <button
          onClick={newDoc}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-tertiary)',
            marginLeft: '4px',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
          title="New document (Cmd+N)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1v12M1 7h12" />
          </svg>
        </button>
      </div>

      {/* Right side actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: '8px',
          flexShrink: 0,
        }}
      >
        {/* Command palette button */}
        {onToggleCommandPalette && (
          <button
            onClick={onToggleCommandPalette}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            title="Command Palette (Cmd+K)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        )}

        {/* File browser toggle (only in Tauri) */}
        {inTauri && onToggleFileBrowser && (
          <button
            onClick={onToggleFileBrowser}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            title="Toggle sidebar (Cmd+\\)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}

        {/* Settings button (gear icon) */}
        {onToggleSettings && (
          <button
            onClick={onToggleSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            title="Settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
