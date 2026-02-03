'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspace, WorkspaceFile } from '@/context/WorkspaceContext';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestConfirm?: (message: string, onConfirm: () => void) => void;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

// ============================================================================
// FILE TYPE ICONS
// Semantic icons that help users quickly identify file types at a glance
// ============================================================================

const FileIcons = {
  // Markdown file - document with lines suggesting text content
  markdown: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 2h7l3 3v9H3V2z" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M10 2v3h3" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M5 8h6M5 10.5h4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  // Folder closed
  folderClosed: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M2 5V12.5C2 13.0523 2.44772 13.5 3 13.5H13C13.5523 13.5 14 13.0523 14 12.5V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z"
        fill="var(--bg-tertiary)"
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
      />
    </svg>
  ),
  // Folder open
  folderOpen: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M2 5V4C2 3.44772 2.44772 3 3 3H6.5L8 5H13C13.5523 5 14 5.44772 14 6V7"
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M2 7H12.5L14 12.5H3.5L2 7Z"
        fill="var(--accent-subtle)"
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
      />
    </svg>
  ),
  // Environment/secrets file - lock icon
  envFile: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="var(--accent-subtle)" stroke="var(--accent-primary)" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 116 0v2" stroke="var(--accent-primary)" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="10.5" r="1" fill="var(--accent-primary)" />
    </svg>
  ),
  // Generic file
  generic: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 2h7l3 3v9H3V2z" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M10 2v3h3" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  // Kanban board file
  kanban: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="var(--accent-primary)" strokeWidth="1.5" fill="var(--accent-subtle)" />
      <line x1="6" y1="2" x2="6" y2="14" stroke="var(--accent-primary)" strokeWidth="1" />
      <line x1="10" y1="2" x2="10" y2="14" stroke="var(--accent-primary)" strokeWidth="1" />
    </svg>
  ),
  // Documentation collection file
  docs: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 13V3C3 2.44772 3.44772 2 4 2H12V14H4C3.44772 14 3 13.5523 3 13Z" fill="var(--accent-subtle)" stroke="var(--accent-primary)" strokeWidth="1.5" />
      <path d="M3 13C3 12.4477 3.44772 12 4 12H12" stroke="var(--accent-primary)" strokeWidth="1.5" />
      <line x1="5.5" y1="5" x2="10" y2="5" stroke="var(--accent-primary)" strokeWidth="1" strokeLinecap="round" />
      <line x1="5.5" y1="7.5" x2="9" y2="7.5" stroke="var(--accent-primary)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  // Chevron for folder expand/collapse
  chevron: (isExpanded: boolean) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        flexShrink: 0,
        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease',
      }}
    >
      <path d="M6 4L10 8L6 12" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// Helper to get appropriate icon for a file
const getFileIcon = (file: WorkspaceFile, isExpanded: boolean = false) => {
  if (file.isDirectory) {
    return isExpanded ? FileIcons.folderOpen : FileIcons.folderClosed;
  }
  if (file.name.endsWith('.miku-env') || file.name.endsWith('.mikuenv')) {
    return FileIcons.envFile;
  }
  if (file.name.endsWith('.kanban') || file.name.endsWith('.miku-kanban')) {
    return FileIcons.kanban;
  }
  if (file.name.endsWith('.docs') || file.name.endsWith('.miku-docs')) {
    return FileIcons.docs;
  }
  if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
    return FileIcons.markdown;
  }
  return FileIcons.generic;
};

// ============================================================================
// EMPTY STATE COMPONENTS
// Friendly, actionable empty states that guide users toward their first action
// ============================================================================

interface EmptyStateProps {
  type: 'documents' | 'environments' | 'no-results';
  filterQuery?: string;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onCreateEnv?: () => void;
}

const EmptyState = ({ type, filterQuery, onCreateFile, onCreateFolder, onCreateEnv }: EmptyStateProps) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
    gap: '12px',
  };

  const iconContainerStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    margin: 0,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '200px',
  };

  const actionButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background 150ms ease',
    marginTop: '4px',
  };

  if (type === 'no-results') {
    return (
      <div style={containerStyle}>
        <div style={iconContainerStyle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6" />
          </svg>
        </div>
        <p style={titleStyle}>No results found</p>
        <p style={descriptionStyle}>
          No files match &ldquo;{filterQuery}&rdquo;. Try a different search term.
        </p>
      </div>
    );
  }

  if (type === 'environments') {
    return (
      <div style={containerStyle}>
        <div style={iconContainerStyle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 118 0v4" />
            <circle cx="12" cy="16" r="1.5" fill="var(--text-tertiary)" />
          </svg>
        </div>
        <p style={titleStyle}>No secrets yet</p>
        <p style={descriptionStyle}>
          Create an environment file to store API keys and secrets securely.
        </p>
        {onCreateEnv && (
          <button
            onClick={onCreateEnv}
            style={actionButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Create env file
          </button>
        )}
      </div>
    );
  }

  // Documents empty state
  return (
    <div style={containerStyle}>
      <div style={iconContainerStyle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
          <path d="M4 4h10l4 4v12H4V4z" />
          <path d="M14 4v4h4" />
          <path d="M8 12h8M8 16h5" />
        </svg>
      </div>
      <p style={titleStyle}>No documents yet</p>
      <p style={descriptionStyle}>
        Create a markdown file to start writing.
      </p>
      {onCreateFile && (
        <button
          onClick={onCreateFile}
          style={actionButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Create file
        </button>
      )}
    </div>
  );
};

// ============================================================================
// KEYBOARD SHORTCUT BADGE
// Small badge to display keyboard shortcuts in context menus
// ============================================================================

const KeyboardShortcut = ({ keys }: { keys: string }) => (
  <span
    style={{
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-tertiary)',
      background: 'var(--bg-tertiary)',
      padding: '2px 4px',
      borderRadius: 'var(--radius-sm)',
      marginLeft: 'auto',
    }}
  >
    {keys}
  </span>
);

export default function FileBrowser({ isOpen, onClose, onRequestConfirm }: FileBrowserProps) {
  const { workspace, createFile, createFolder, deleteFile, renameFile, refreshFiles, refreshEnvFiles, selectWorkspace } = useWorkspace();
  const { openDocument } = useDocument();
  const [activeTab, setActiveTab] = useState<'documents' | 'environments'>('documents');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: WorkspaceFile } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Load saved sidebar width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('miku-sidebar-width');
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
          setSidebarWidth(width);
        }
      }
    } catch (e) {
      console.error('Failed to load sidebar width:', e);
    }
  }, []);

  // Save sidebar width
  useEffect(() => {
    try {
      localStorage.setItem('miku-sidebar-width', String(sidebarWidth));
    } catch (e) {
      console.error('Failed to save sidebar width:', e);
    }
  }, [sidebarWidth]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus filter with /
      if (e.key === '/' && !renaming && !showNewFileInput) {
        e.preventDefault();
        filterInputRef.current?.focus();
        return;
      }

      // Clear filter with Escape
      if (e.key === 'Escape') {
        if (filterQuery) {
          setFilterQuery('');
          return;
        }
        if (renaming) {
          setRenaming(null);
          setRenameValue('');
          return;
        }
        if (showNewFileInput) {
          setShowNewFileInput(null);
          setNewFileName('');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, renaming, showNewFileInput, filterQuery]);

  if (!isOpen || !isTauri()) return null;

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileClick = async (file: WorkspaceFile) => {
    if (file.isDirectory) {
      toggleFolder(file.path);
    } else {
      setSelectedPath(file.path);
      await openDocument(file.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, file: WorkspaceFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleRename = (file: WorkspaceFile) => {
    setRenaming(file.path);
    setRenameValue(file.name);
    closeContextMenu();
  };

  const submitRename = async () => {
    if (renaming && renameValue.trim()) {
      await renameFile(renaming, renameValue.trim());
    }
    setRenaming(null);
    setRenameValue('');
  };

  const handleDelete = (file: WorkspaceFile) => {
    closeContextMenu();
    const confirmMessage = `Are you sure you want to delete "${file.name}"?`;

    if (onRequestConfirm) {
      onRequestConfirm(confirmMessage, async () => {
        await deleteFile(file.path);
      });
    } else {
      // Fallback to window.confirm
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        deleteFile(file.path);
      }
    }
  };

  const handleNewFile = (parentPath: string | null, type: 'file' | 'folder') => {
    setShowNewFileInput(parentPath || workspace.currentWorkspace?.path || null);
    setNewFileType(type);
    setNewFileName('');
    closeContextMenu();
  };

  const submitNewFile = async () => {
    if (showNewFileInput && newFileName.trim()) {
      if (newFileType === 'file') {
        await createFile(newFileName.trim(), showNewFileInput);
      } else {
        await createFolder(newFileName.trim(), showNewFileInput);
      }
    }
    setShowNewFileInput(null);
    setNewFileName('');
  };

  // Filter files recursively
  const filterFiles = (files: WorkspaceFile[], query: string): WorkspaceFile[] => {
    if (!query.trim()) return files;

    const queryLower = query.toLowerCase();
    const result: WorkspaceFile[] = [];

    for (const file of files) {
      if (file.isDirectory && file.children) {
        const filteredChildren = filterFiles(file.children, query);
        if (filteredChildren.length > 0) {
          result.push({ ...file, children: filteredChildren });
        } else if (file.name.toLowerCase().includes(queryLower)) {
          result.push(file);
        }
      } else if (file.name.toLowerCase().includes(queryLower)) {
        result.push(file);
      }
    }

    return result;
  };

  const filteredFiles = filterFiles(workspace.files, filterQuery);

  // Filter env files
  const filteredEnvFiles = filterQuery.trim()
    ? workspace.envFiles.filter(f => f.name.toLowerCase().includes(filterQuery.toLowerCase()))
    : workspace.envFiles;

  const renderEnvFileItem = (file: WorkspaceFile) => {
    const isRenaming = renaming === file.path;
    const isSelected = selectedPath === file.path;

    return (
      <div key={file.path}>
        <div
          onClick={() => !isRenaming && handleFileClick(file)}
          onContextMenu={(e) => handleContextMenu(e, file)}
          tabIndex={0}
          role="treeitem"
          aria-selected={isSelected}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleFileClick(file);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 8px',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            // Enhanced selected state with left accent border
            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
            borderLeft: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginLeft: isSelected ? '-2px' : '0',
            fontSize: '13px',
            color: 'var(--text-primary)',
            transition: 'all 100ms ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--border-focus)';
            }
          }}
          onBlur={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Lock icon for env files */}
          {FileIcons.envFile}

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') {
                  setRenaming(null);
                  setRenameValue('');
                }
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '2px 6px',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxShadow: '0 0 0 2px var(--accent-subtle)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {file.name}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderFileItem = (file: WorkspaceFile, depth: number = 0) => {
    const isExpanded = expandedFolders.has(file.path);
    const isRenaming = renaming === file.path;
    const isSelected = selectedPath === file.path;

    return (
      <div key={file.path}>
        <div
          onClick={() => !isRenaming && handleFileClick(file)}
          onContextMenu={(e) => handleContextMenu(e, file)}
          tabIndex={0}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={file.isDirectory ? isExpanded : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleFileClick(file);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 8px',
            paddingLeft: `${8 + depth * 16}px`,
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            // Enhanced selected state with left accent border
            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
            borderLeft: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginLeft: isSelected ? '-2px' : '0',
            fontSize: '13px',
            color: 'var(--text-primary)',
            transition: 'all 100ms ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onFocus={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--border-focus)';
            }
          }}
          onBlur={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Chevron for folders, spacer for files to maintain alignment */}
          {file.isDirectory ? (
            FileIcons.chevron(isExpanded)
          ) : (
            <span style={{ width: '12px', flexShrink: 0 }} />
          )}

          {/* File/folder icon */}
          {getFileIcon(file, isExpanded)}

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') {
                  setRenaming(null);
                  setRenameValue('');
                }
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '2px 6px',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxShadow: '0 0 0 2px var(--accent-subtle)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {file.name}
            </span>
          )}
        </div>

        {/* Show new file input if adding to this folder */}
        {showNewFileInput === file.path && file.isDirectory && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              paddingLeft: `${8 + (depth + 1) * 16}px`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent-primary)" strokeWidth="2" style={{ flexShrink: 0 }}>
              {newFileType === 'folder' ? (
                <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
              ) : (
                <>
                  <path d="M3 2V14H13V5L10 2H3Z" />
                  <path d="M10 2V5H13" />
                </>
              )}
            </svg>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={() => {
                if (newFileName.trim()) submitNewFile();
                else setShowNewFileInput(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewFile();
                if (e.key === 'Escape') setShowNewFileInput(null);
              }}
              placeholder={newFileType === 'folder' ? 'Folder name' : 'File name'}
              autoFocus
              style={{
                flex: 1,
                padding: '2px 4px',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Render children if expanded */}
        {file.isDirectory && isExpanded && file.children && (
          <div>
            {file.children.map((child) => renderFileItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={sidebarRef}
      style={{
        position: 'relative',
        width: `${sidebarWidth}px`,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          onClick={selectWorkspace}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            maxWidth: '180px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
          title="Change workspace"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workspace.currentWorkspace?.name || 'Workspace'}
          </span>
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
          title="Close sidebar (Cmd+\\)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Filter input with keyboard hint */}
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            transition: 'box-shadow 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--border-focus)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={filterInputRef}
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files..."
            aria-label="Filter files"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {filterQuery ? (
            <button
              onClick={() => setFilterQuery('')}
              aria-label="Clear filter"
              style={{
                padding: '2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l8 8M10 2L2 10" />
              </svg>
            </button>
          ) : (
            // Keyboard shortcut hint when input is empty
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                background: 'var(--bg-secondary)',
                padding: '1px 4px',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.8,
              }}
            >
              /
            </span>
          )}
        </div>
      </div>

      {/* Tabs - Pill style for a lighter, more modern look */}
      <div
        style={{
          display: 'flex',
          padding: '8px',
          gap: '4px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}
      >
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: activeTab === 'documents' ? 'var(--bg-primary)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: activeTab === 'documents' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 150ms ease',
            boxShadow: activeTab === 'documents' ? 'var(--shadow-sm)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'documents') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'documents') {
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2h7l3 3v9H3V2z" />
            <path d="M10 2v3h3" />
            <path d="M5 8h6M5 10.5h4" strokeLinecap="round" />
          </svg>
          Documents
        </button>
        <button
          onClick={() => setActiveTab('environments')}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: activeTab === 'environments' ? 'var(--bg-primary)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: activeTab === 'environments' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 150ms ease',
            boxShadow: activeTab === 'environments' ? 'var(--shadow-sm)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'environments') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'environments') {
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="7" width="10" height="7" rx="1" />
            <path d="M5 7V5a3 3 0 116 0v2" />
          </svg>
          Secrets
        </button>
      </div>

      {/* Toolbar - only show for documents tab */}
      {activeTab === 'documents' && (
        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => handleNewFile(workspace.currentWorkspace?.path || null, 'file')}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="New file"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3V13M3 8H13" />
            </svg>
            File
          </button>
          <button
            onClick={() => handleNewFile(workspace.currentWorkspace?.path || null, 'folder')}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="New folder"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3V13M3 8H13" />
            </svg>
            Folder
          </button>
          <button
            onClick={refreshFiles}
            style={{
              marginLeft: 'auto',
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8C2 4.68629 4.68629 2 8 2C10.5 2 12.5 3.5 13.5 5.5M14 8C14 11.3137 11.3137 14 8 14C5.5 14 3.5 12.5 2.5 10.5" />
              <path d="M13 2V6H9" />
              <path d="M3 14V10H7" />
            </svg>
          </button>
        </div>
      )}

      {/* Toolbar for environments tab */}
      {activeTab === 'environments' && (
        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setShowNewFileInput(workspace.currentWorkspace?.path || null);
              setNewFileType('file');
              setNewFileName('');
            }}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="New env file"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3V13M3 8H13" />
            </svg>
            New Env
          </button>
          <button
            onClick={refreshEnvFiles}
            style={{
              marginLeft: 'auto',
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8C2 4.68629 4.68629 2 8 2C10.5 2 12.5 3.5 13.5 5.5M14 8C14 11.3137 11.3137 14 8 14C5.5 14 3.5 12.5 2.5 10.5" />
              <path d="M13 2V6H9" />
              <path d="M3 14V10H7" />
            </svg>
          </button>
        </div>
      )}

      {/* New file input at root level - for documents tab */}
      {activeTab === 'documents' && showNewFileInput === workspace.currentWorkspace?.path && (
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent-primary)" strokeWidth="2" style={{ flexShrink: 0 }}>
            {newFileType === 'folder' ? (
              <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
            ) : (
              <>
                <path d="M3 2V14H13V5L10 2H3Z" />
                <path d="M10 2V5H13" />
              </>
            )}
          </svg>
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onBlur={() => {
              if (newFileName.trim()) submitNewFile();
              else setShowNewFileInput(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewFile();
              if (e.key === 'Escape') setShowNewFileInput(null);
            }}
            placeholder={newFileType === 'folder' ? 'Folder name' : 'File name'}
            autoFocus
            style={{
              flex: 1,
              padding: '4px 8px',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* New env file input - for environments tab */}
      {activeTab === 'environments' && showNewFileInput === workspace.currentWorkspace?.path && (
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <rect x="3" y="7" width="10" height="7" rx="1" />
            <path d="M5 7V5a3 3 0 116 0v2" />
          </svg>
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onBlur={async () => {
              if (newFileName.trim()) {
                // Ensure .miku-env extension
                const fileName = newFileName.trim().endsWith('.miku-env')
                  ? newFileName.trim()
                  : `${newFileName.trim()}.miku-env`;
                await createFile(fileName, showNewFileInput || undefined);
                await refreshEnvFiles();
              }
              setShowNewFileInput(null);
              setNewFileName('');
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                // Ensure .miku-env extension
                const fileName = newFileName.trim().endsWith('.miku-env')
                  ? newFileName.trim()
                  : `${newFileName.trim()}.miku-env`;
                await createFile(fileName, showNewFileInput || undefined);
                await refreshEnvFiles();
                setShowNewFileInput(null);
                setNewFileName('');
              }
              if (e.key === 'Escape') {
                setShowNewFileInput(null);
                setNewFileName('');
              }
            }}
            placeholder="production.miku-env"
            autoFocus
            style={{
              flex: 1,
              padding: '4px 8px',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* File List - Documents tab */}
      {activeTab === 'documents' && (
        <div
          role="tree"
          aria-label="Documents"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px',
            minHeight: 0,
          }}
        >
          {filteredFiles.length === 0 ? (
            filterQuery ? (
              <EmptyState type="no-results" filterQuery={filterQuery} />
            ) : (
              <EmptyState
                type="documents"
                onCreateFile={() => handleNewFile(workspace.currentWorkspace?.path || null, 'file')}
                onCreateFolder={() => handleNewFile(workspace.currentWorkspace?.path || null, 'folder')}
              />
            )
          ) : (
            filteredFiles.map((file) => renderFileItem(file))
          )}
        </div>
      )}

      {/* File List - Environments tab */}
      {activeTab === 'environments' && (
        <div
          role="tree"
          aria-label="Environment files"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px',
            minHeight: 0,
          }}
        >
          {filteredEnvFiles.length === 0 ? (
            filterQuery ? (
              <EmptyState type="no-results" filterQuery={filterQuery} />
            ) : (
              <EmptyState
                type="environments"
                onCreateEnv={() => {
                  setShowNewFileInput(workspace.currentWorkspace?.path || null);
                  setNewFileType('file');
                  setNewFileName('');
                }}
              />
            )
          ) : (
            filteredEnvFiles.map((file) => renderEnvFileItem(file))
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
          background: isResizing ? 'var(--accent-primary)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = 'var(--border-default)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      />

      {/* Context Menu - Improved with icons and keyboard shortcuts */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <div
            role="menu"
            aria-label="File actions"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '4px',
              minWidth: '180px',
              zIndex: 1000,
            }}
          >
            {/* Header showing file name */}
            <div
              style={{
                padding: '6px 12px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {contextMenu.file.name}
            </div>

            {contextMenu.file.isDirectory && (
              <>
                <button
                  role="menuitem"
                  onClick={() => handleNewFile(contextMenu.file.path, 'file')}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                    <path d="M3 2h7l3 3v9H3V2z" />
                    <path d="M10 2v3h3" />
                    <path d="M8 6v4M6 8h4" strokeLinecap="round" />
                  </svg>
                  <span style={{ flex: 1 }}>New File</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => handleNewFile(contextMenu.file.path, 'folder')}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                    <path d="M2 5V12.5C2 13.0523 2.44772 13.5 3 13.5H13C13.5523 13.5 14 13.0523 14 12.5V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
                    <path d="M8 7v3M6.5 8.5h3" strokeLinecap="round" />
                  </svg>
                  <span style={{ flex: 1 }}>New Folder</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowNewFileInput(contextMenu.file.path);
                    setNewFileType('file');
                    setNewFileName('.miku-env');
                    closeContextMenu();
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="7" width="10" height="7" rx="1" />
                    <path d="M5 7V5a3 3 0 116 0v2" />
                  </svg>
                  <span style={{ flex: 1 }}>New Env File</span>
                </button>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
              </>
            )}
            <button
              role="menuitem"
              onClick={() => handleRename(contextMenu.file)}
              style={{
                width: '100%',
                padding: '7px 12px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
                <path d="M10 4l2 2" />
              </svg>
              <span style={{ flex: 1 }}>Rename</span>
              <KeyboardShortcut keys="F2" />
            </button>
            <button
              role="menuitem"
              onClick={() => handleDelete(contextMenu.file)}
              style={{
                width: '100%',
                padding: '7px 12px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" />
                <path d="M7 7v4M9 7v4" />
              </svg>
              <span style={{ flex: 1 }}>Delete</span>
              <KeyboardShortcut keys="Del" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
