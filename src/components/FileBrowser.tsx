'use client';

import { useState } from 'react';
import { useWorkspace, WorkspaceFile } from '@/context/WorkspaceContext';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FileBrowser({ isOpen, onClose }: FileBrowserProps) {
  const { workspace, createFile, createFolder, deleteFile, renameFile, refreshFiles, selectWorkspace } = useWorkspace();
  const { openDocument } = useDocument();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: WorkspaceFile } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');

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
      await openDocument(file.path);
      onClose();
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

  const handleDelete = async (file: WorkspaceFile) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${file.name}"?`);
    if (confirmed) {
      await deleteFile(file.path);
    }
    closeContextMenu();
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

  const renderFileItem = (file: WorkspaceFile, depth: number = 0) => {
    const isExpanded = expandedFolders.has(file.path);
    const isRenaming = renaming === file.path;

    return (
      <div key={file.path}>
        <div
          onClick={() => !isRenaming && handleFileClick(file)}
          onContextMenu={(e) => handleContextMenu(e, file)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            paddingLeft: `${8 + depth * 16}px`,
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
          }}
        >
          {file.isDirectory ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2"
              style={{
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.1s',
                flexShrink: 0,
              }}
            >
              <path d="M6 4L10 8L6 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M3 2V14H13V5L10 2H3Z" />
              <path d="M10 2V5H13" />
            </svg>
          )}

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
                padding: '2px 4px',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    <>
      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '260px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 500,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: 'var(--radius-sm)',
            }}
            title="Change workspace"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
            </svg>
            {workspace.currentWorkspace?.name || 'Workspace'}
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
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-subtle)',
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
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8C2 4.68629 4.68629 2 8 2C10.5 2 12.5 3.5 13.5 5.5M14 8C14 11.3137 11.3137 14 8 14C5.5 14 3.5 12.5 2.5 10.5" />
              <path d="M13 2V6H9" />
              <path d="M3 14V10H7" />
            </svg>
          </button>
        </div>

        {/* New file input at root level */}
        {showNewFileInput === workspace.currentWorkspace?.path && (
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

        {/* File List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {workspace.files.length === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
              }}
            >
              No markdown files found
            </div>
          ) : (
            workspace.files.map((file) => renderFileItem(file))
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={closeContextMenu}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '4px',
              minWidth: '140px',
              zIndex: 1000,
            }}
          >
            {contextMenu.file.isDirectory && (
              <>
                <button
                  onClick={() => handleNewFile(contextMenu.file.path, 'file')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'none';
                  }}
                >
                  New File
                </button>
                <button
                  onClick={() => handleNewFile(contextMenu.file.path, 'folder')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'none';
                  }}
                >
                  New Folder
                </button>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
              </>
            )}
            <button
              onClick={() => handleRename(contextMenu.file)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'none';
              }}
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(contextMenu.file)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: '#ef4444',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'none';
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Click outside to close sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '260px',
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 499,
        }}
        onClick={onClose}
      />
    </>
  );
}
