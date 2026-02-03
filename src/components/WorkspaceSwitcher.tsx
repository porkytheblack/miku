'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspace, Workspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';

interface WorkspaceSwitcherProps {
  className?: string;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else {
    return `${diffMonths}mo ago`;
  }
}

function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;

  const parts = path.split('/');
  if (parts.length <= 2) return '...' + path.slice(-maxLength + 3);

  const fileName = parts[parts.length - 1];
  const parentDir = parts[parts.length - 2];

  if (fileName.length + parentDir.length + 4 > maxLength) {
    return '.../' + fileName.slice(-maxLength + 4);
  }

  return '.../' + parentDir + '/' + fileName;
}

export default function WorkspaceSwitcher({ className = '' }: WorkspaceSwitcherProps) {
  const { workspace, selectWorkspace, openWorkspace, hasWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Track client-side mounting to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleOpenOther = useCallback(async () => {
    handleClose();
    await selectWorkspace();
  }, [selectWorkspace, handleClose]);

  const handleSelectWorkspace = useCallback(async (path: string) => {
    handleClose();
    await openWorkspace(path);
  }, [openWorkspace, handleClose]);

  // Handle keyboard shortcut (Cmd+Shift+O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'o') {
        e.preventDefault();
        handleOpenOther();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenOther]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  // Don't render until mounted (prevents hydration mismatch) or in browser mode
  if (!isMounted || !isTauri()) {
    return null;
  }

  const currentWorkspace = workspace.currentWorkspace;
  const recentWorkspaces = workspace.recentWorkspaces.filter(
    (ws) => ws.path !== currentWorkspace?.path
  );

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          background: isOpen ? 'var(--bg-tertiary)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'background 0.15s ease',
          maxWidth: '200px',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={currentWorkspace?.path || 'Select workspace'}
      >
        {/* Folder icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
        </svg>

        {/* Workspace name */}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentWorkspace?.name || 'No workspace'}
        </span>

        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="M2 4L5 7L8 4" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '280px',
            maxWidth: '360px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '4px',
            zIndex: 1000,
            animation: 'dropdownFadeIn 0.15s ease',
          }}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Current workspace section */}
          {currentWorkspace && (
            <>
              <div
                style={{
                  padding: '8px 12px 4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Current Workspace
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '2px',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
                  </svg>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {currentWorkspace.name}
                  </span>
                </div>
                <div
                  style={{
                    paddingLeft: '22px',
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={currentWorkspace.path}
                >
                  {truncatePath(currentWorkspace.path)}
                </div>
              </div>
            </>
          )}

          {/* Recent workspaces section */}
          {recentWorkspaces.length > 0 && (
            <>
              <div
                style={{
                  padding: '12px 12px 4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Recent Workspaces
              </div>
              {recentWorkspaces.slice(0, 5).map((ws) => (
                <button
                  key={ws.path}
                  onClick={() => handleSelectWorkspace(ws.path)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  role="menuitem"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="2"
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  >
                    <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ws.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={ws.path}
                    >
                      {truncatePath(ws.path)}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Separator */}
          <div
            style={{
              height: '1px',
              background: 'var(--border-default)',
              margin: '4px 0',
            }}
          />

          {/* Open other folder option */}
          <button
            onClick={handleOpenOther}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            role="menuitem"
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ flexShrink: 0 }}
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              Open Other Folder...
            </span>
            <kbd
              style={{
                padding: '2px 6px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
              }}
            >
              {'\u2318\u21E7O'}
            </kbd>
          </button>
        </div>
      )}

      {/* Dropdown animation styles */}
      <style jsx>{`
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
