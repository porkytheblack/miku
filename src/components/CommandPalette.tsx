'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useMiku } from '@/context/MikuContext';
import { isTauri } from '@/lib/tauri';

interface Command {
  id: string;
  label: string;
  category: 'file' | 'edit' | 'view' | 'workspace' | 'ai';
  shortcut?: string[];
  action: () => void;
  icon?: React.ReactNode;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleFileBrowser?: () => void;
  onToggleSettings?: () => void;
  onToggleHelp?: () => void;
  onRequestEnvFileName?: () => void;
  onRequestKanbanFileName?: () => void;
  onRequestDocsFileName?: () => void;
  onToggleGlobalSearch?: () => void;
}

const categoryLabels: Record<Command['category'], string> = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  workspace: 'Workspace',
  ai: 'AI',
};

const categoryOrder: Command['category'][] = ['file', 'edit', 'ai', 'view', 'workspace'];

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 0 };

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) {
    return { match: true, score: 100 };
  }

  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) {
    return { match: true, score: 80 };
  }

  // Contains query gets medium score
  if (textLower.includes(queryLower)) {
    return { match: true, score: 60 };
  }

  // Fuzzy match - all characters must be present in order
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let prevMatchIndex = -2;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      if (i === prevMatchIndex + 1) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 1;
      }
      prevMatchIndex = i;
      queryIndex++;
    }
  }

  if (queryIndex === queryLower.length) {
    // Score based on consecutive matches and position
    const score = 20 + maxConsecutive * 10;
    return { match: true, score };
  }

  return { match: false, score: 0 };
}

export default function CommandPalette({
  isOpen,
  onClose,
  onToggleFileBrowser,
  onToggleSettings,
  onToggleHelp,
  onRequestEnvFileName,
  onRequestKanbanFileName,
  onRequestDocsFileName,
  onToggleGlobalSearch,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { openDocument, saveDocument, newDoc } = useDocument();
  const { selectWorkspace, refreshFiles, workspace } = useWorkspace();
  const { requestReview } = useMiku();
  const inTauri = isTauri();

  // Load recent commands from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('miku-recent-commands');
      if (saved) {
        setRecentCommands(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load recent commands:', e);
    }
  }, []);

  // Save recent command
  const saveRecentCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const newRecent = [commandId, ...prev.filter((id) => id !== commandId)].slice(0, 5);
      try {
        localStorage.setItem('miku-recent-commands', JSON.stringify(newRecent));
      } catch (e) {
        console.error('Failed to save recent commands:', e);
      }
      return newRecent;
    });
  }, []);

  // Define all available commands
  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      // File commands
      {
        id: 'file.new',
        label: 'New Document',
        category: 'file',
        shortcut: ['Cmd', 'N'],
        action: () => newDoc(),
        keywords: ['create', 'new', 'document', 'file'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        id: 'file.newEnv',
        label: 'New Environment File',
        category: 'file',
        action: () => {
          if (workspace.currentWorkspace && onRequestEnvFileName) {
            onRequestEnvFileName();
          }
        },
        keywords: ['create', 'new', 'env', 'environment', 'secrets', 'variables', 'miku-env'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 118 0v3" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        ),
      },
      {
        id: 'file.newKanban',
        label: 'New Kanban Board',
        category: 'file',
        action: () => {
          if (workspace.currentWorkspace && onRequestKanbanFileName) {
            onRequestKanbanFileName();
          }
        },
        keywords: ['create', 'new', 'kanban', 'board', 'tasks', 'todo', 'project'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        ),
      },
      {
        id: 'file.newDocs',
        label: 'New Documentation Collection',
        category: 'file',
        action: () => {
          if (workspace.currentWorkspace && onRequestDocsFileName) {
            onRequestDocsFileName();
          }
        },
        keywords: ['create', 'new', 'docs', 'documentation', 'readme', 'github', 'markdown'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="12" y2="15" />
          </svg>
        ),
      },
      {
        id: 'file.save',
        label: 'Save',
        category: 'file',
        shortcut: ['Cmd', 'S'],
        action: () => saveDocument(),
        keywords: ['save', 'write', 'export'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        ),
      },
      // Edit commands
      {
        id: 'edit.undo',
        label: 'Undo',
        category: 'edit',
        shortcut: ['Cmd', 'Z'],
        action: () => window.dispatchEvent(new Event('miku:undo')),
        keywords: ['undo', 'revert', 'back'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        ),
      },
      // AI commands
      {
        id: 'ai.review',
        label: 'Request AI Review',
        category: 'ai',
        shortcut: ['Cmd', 'Enter'],
        action: () => {
          const editor = window.document.querySelector('textarea');
          if (editor) {
            requestReview((editor as HTMLTextAreaElement).value);
          }
        },
        keywords: ['review', 'ai', 'analyze', 'check', 'miku'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
      {
        id: 'ai.acceptAll',
        label: 'Accept All Suggestions',
        category: 'ai',
        shortcut: ['Cmd', 'Shift', 'A'],
        action: () => window.dispatchEvent(new Event('miku:acceptAll')),
        keywords: ['accept', 'approve', 'suggestions', 'all'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      },
      {
        id: 'ai.declineAll',
        label: 'Decline All Suggestions',
        category: 'ai',
        shortcut: ['Cmd', 'Shift', 'D'],
        action: () => window.dispatchEvent(new Event('miku:declineAll')),
        keywords: ['decline', 'reject', 'dismiss', 'suggestions', 'all'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ),
      },
      // View commands
      {
        id: 'view.preview',
        label: 'Toggle Preview',
        category: 'view',
        action: () => window.dispatchEvent(new Event('miku:togglePreview')),
        keywords: ['preview', 'markdown', 'render', 'view'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ];

    // Tauri-only commands
    if (inTauri) {
      cmds.push(
        {
          id: 'file.open',
          label: 'Open File...',
          category: 'file',
          shortcut: ['Cmd', 'O'],
          action: () => openDocument(),
          keywords: ['open', 'load', 'file'],
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
        {
          id: 'workspace.open',
          label: 'Open Workspace...',
          category: 'workspace',
          shortcut: ['Cmd', 'Shift', 'O'],
          action: () => selectWorkspace(),
          keywords: ['workspace', 'folder', 'directory', 'project'],
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
        {
          id: 'workspace.refresh',
          label: 'Refresh Files',
          category: 'workspace',
          action: () => refreshFiles(),
          keywords: ['refresh', 'reload', 'files', 'workspace'],
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          ),
        }
      );
    }

    // Optional callbacks
    if (onToggleGlobalSearch) {
      cmds.push({
        id: 'view.globalSearch',
        label: 'Search Everything',
        category: 'view',
        shortcut: ['Cmd', 'P'],
        action: () => onToggleGlobalSearch(),
        keywords: ['search', 'find', 'global', 'files', 'variables', 'cards', 'tasks', 'docs'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        ),
      });
    }

    if (onToggleFileBrowser) {
      cmds.push({
        id: 'view.fileBrowser',
        label: 'Toggle File Browser',
        category: 'view',
        shortcut: ['Cmd', '\\'],
        action: () => onToggleFileBrowser(),
        keywords: ['sidebar', 'files', 'browser', 'explorer'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        ),
      });
    }

    if (onToggleSettings) {
      cmds.push({
        id: 'view.settings',
        label: 'Open Settings',
        category: 'view',
        shortcut: ['Cmd', ','],
        action: () => onToggleSettings(),
        keywords: ['settings', 'preferences', 'options', 'config'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      });
    }

    if (onToggleHelp) {
      cmds.push({
        id: 'view.help',
        label: 'Keyboard Shortcuts',
        category: 'view',
        shortcut: ['Cmd', '?'],
        action: () => onToggleHelp(),
        keywords: ['help', 'shortcuts', 'keyboard', 'hotkeys'],
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      });
    }

    return cmds;
  }, [
    inTauri,
    newDoc,
    openDocument,
    saveDocument,
    selectWorkspace,
    refreshFiles,
    requestReview,
    onToggleFileBrowser,
    onToggleSettings,
    onToggleHelp,
    onToggleGlobalSearch,
    onRequestEnvFileName,
    workspace,
  ]);

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    const results: Array<Command & { score: number }> = [];

    for (const cmd of commands) {
      // Match against label
      const labelMatch = fuzzyMatch(query, cmd.label);

      // Match against keywords
      let keywordScore = 0;
      if (cmd.keywords) {
        for (const keyword of cmd.keywords) {
          const match = fuzzyMatch(query, keyword);
          if (match.match) {
            keywordScore = Math.max(keywordScore, match.score);
          }
        }
      }

      // Match against category
      const categoryMatch = fuzzyMatch(query, categoryLabels[cmd.category]);

      const maxScore = Math.max(labelMatch.score, keywordScore, categoryMatch.score);

      if (labelMatch.match || keywordScore > 0 || categoryMatch.match) {
        // Boost recent commands
        const recentBoost = recentCommands.includes(cmd.id)
          ? 10 + (5 - recentCommands.indexOf(cmd.id))
          : 0;
        results.push({ ...cmd, score: maxScore + recentBoost });
      }
    }

    // Sort by score (descending), then by category order
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    });
  }, [commands, query, recentCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<Command['category'], (Command & { score: number })[]> = {
      file: [],
      edit: [],
      ai: [],
      view: [],
      workspace: [],
    };

    for (const cmd of filteredCommands) {
      groups[cmd.category].push(cmd);
    }

    return groups;
  }, [filteredCommands]);

  // Execute selected command
  const executeCommand = useCallback(
    (command: Command) => {
      saveRecentCommand(command.id);
      onClose();
      // Execute after close to prevent UI issues
      setTimeout(() => command.action(), 50);
    },
    [onClose, saveRecentCommand]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onClose]
  );

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 199,
        }}
        onClick={onClose}
      />

      {/* Palette */}
      <div
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'paletteIn 0.15s ease',
        }}
        role="dialog"
        aria-label="Command Palette"
      >
        {/* Search input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontFamily: 'var(--font-sans)',
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <kbd
              style={{
                padding: '2px 8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
              }}
            >
              esc
            </kbd>
          </div>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '14px',
              }}
            >
              No commands found
            </div>
          ) : (
            categoryOrder.map((category) => {
              const categoryCommands = groupedCommands[category];
              if (categoryCommands.length === 0) return null;

              return (
                <div key={category}>
                  <div
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {categoryLabels[category]}
                  </div>
                  {categoryCommands.map((cmd) => {
                    const index = currentIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        data-selected={isSelected}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        {/* Icon */}
                        <span
                          style={{
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {cmd.icon}
                        </span>

                        {/* Label */}
                        <span
                          style={{
                            flex: 1,
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                          }}
                        >
                          {cmd.label}
                        </span>

                        {/* Recent indicator */}
                        {recentCommands.includes(cmd.id) && !query && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-tertiary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Recent
                          </span>
                        )}

                        {/* Shortcut */}
                        {cmd.shortcut && (
                          <span style={{ display: 'flex', gap: '4px' }}>
                            {cmd.shortcut.map((key, keyIndex) => (
                              <kbd
                                key={keyIndex}
                                style={{
                                  padding: '2px 6px',
                                  background: isSelected
                                    ? 'var(--bg-secondary)'
                                    : 'var(--bg-tertiary)',
                                  border: '1px solid var(--border-default)',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-tertiary)',
                                }}
                              >
                                {key === 'Cmd' ? '\u2318' : key === 'Shift' ? '\u21E7' : key}
                              </kbd>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <kbd
                style={{
                  padding: '1px 4px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  fontSize: '10px',
                }}
              >
                {'\u2191'}
              </kbd>
              <kbd
                style={{
                  padding: '1px 4px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  fontSize: '10px',
                }}
              >
                {'\u2193'}
              </kbd>
            </span>
            <span>to navigate</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <kbd
              style={{
                padding: '1px 4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              {'\u23CE'}
            </kbd>
            <span>to select</span>
          </span>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes paletteIn {
          from {
            opacity: 0;
            transform: translateX(-50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}
