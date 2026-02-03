'use client';

import type { DocsEntry, GitHubFolderEntry, DocsSyncStatus } from '@/types';

interface DocsSidebarProps {
  entries: DocsEntry[];
  activeEntryId: string | null;
  activeFileIndex: number | null;
  expandedEntries: Set<string>;
  syncStatus: Map<string, DocsSyncStatus>;
  onSelectEntry: (id: string, fileIndex?: number) => void;
  onToggleExpanded: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onSyncEntry: (id: string) => void;
}

/**
 * Sidebar showing the list of documentation entries
 */
export default function DocsSidebar({
  entries,
  activeEntryId,
  activeFileIndex,
  expandedEntries,
  syncStatus,
  onSelectEntry,
  onToggleExpanded,
  onDeleteEntry,
  onSyncEntry,
}: DocsSidebarProps) {
  const getEntryIcon = (entry: DocsEntry) => {
    switch (entry.type) {
      case 'pasted':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
      case 'github-file':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        );
      case 'github-folder':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        );
    }
  };

  const getSyncStatusIndicator = (status: DocsSyncStatus | undefined) => {
    if (!status || status === 'idle') return null;

    switch (status) {
      case 'syncing':
        return (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth={2}
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
          </svg>
        );
      case 'success':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth={2}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'error':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: '280px',
        minWidth: '200px',
        maxWidth: '400px',
        borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-2)',
        }}
      >
        {entries.map((entry) => {
          const isActive = entry.id === activeEntryId;
          const isExpanded = expandedEntries.has(entry.id);
          const status = syncStatus.get(entry.id);
          const isFolderEntry = entry.type === 'github-folder';

          return (
            <div key={entry.id}>
              {/* Entry row */}
              <div
                onClick={() => {
                  if (isFolderEntry) {
                    onToggleExpanded(entry.id);
                    if (!isExpanded && (entry as GitHubFolderEntry).files.length > 0) {
                      onSelectEntry(entry.id, 0);
                    }
                  } else {
                    onSelectEntry(entry.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: isActive && !isFolderEntry ? 'var(--bg-tertiary)' : 'transparent',
                  color: 'var(--text-primary)',
                  transition: 'background var(--duration-fast) var(--easing-default)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive || isFolderEntry) {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive && !isFolderEntry ? 'var(--bg-tertiary)' : 'transparent';
                }}
              >
                {/* Expand/collapse arrow for folders */}
                {isFolderEntry && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform var(--duration-fast) var(--easing-default)',
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}

                {/* Entry icon */}
                <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                  {getEntryIcon(entry)}
                </span>

                {/* Entry title */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 'var(--text-sm)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.title}
                </span>

                {/* Sync status */}
                {getSyncStatusIndicator(status)}

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    transition: 'opacity var(--duration-fast) var(--easing-default)',
                  }}
                  className="entry-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.type !== 'pasted' && (
                    <button
                      onClick={() => onSyncEntry(entry.id)}
                      title="Sync"
                      style={{
                        padding: '4px',
                        background: 'var(--bg-tertiary)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    title="Delete"
                    style={{
                      padding: '4px',
                      background: 'var(--bg-tertiary)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.color = 'var(--highlight-grammar)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Folder files */}
              {isFolderEntry && isExpanded && (
                <div style={{ marginLeft: 'var(--spacing-6)' }}>
                  {(entry as GitHubFolderEntry).files.map((file, index) => {
                    const isFileActive = isActive && activeFileIndex === index;

                    return (
                      <div
                        key={file.cacheKey}
                        onClick={() => onSelectEntry(entry.id, index)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-2)',
                          padding: 'var(--spacing-1) var(--spacing-3)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          background: isFileActive ? 'var(--bg-tertiary)' : 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: 'var(--text-xs)',
                          transition: 'background var(--duration-fast) var(--easing-default)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isFileActive) {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isFileActive ? 'var(--bg-tertiary)' : 'transparent';
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .entry-actions {
          opacity: 0;
        }
        div:hover > .entry-actions {
          opacity: 1;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
