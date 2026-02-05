'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { SearchResult, SearchResultCategory, SearchFilter, GlobalSearchProps } from '@/types';

// ============================================
// Filter Configuration
// ============================================

const FILTER_OPTIONS: { value: SearchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'file', label: 'Files' },
  { value: 'env-variable', label: 'Env Vars' },
  { value: 'kanban-card', label: 'Cards' },
  { value: 'kanban-task', label: 'Tasks' },
  { value: 'docs-entry', label: 'Docs' },
];

// ============================================
// Icons
// ============================================

const SearchIcons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h7l3 3v9H3V2z" />
      <path d="M10 2v3h3" />
    </svg>
  ),
  'env-variable': (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 116 0v2" />
    </svg>
  ),
  'kanban-card': (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <line x1="6" y1="2" x2="6" y2="14" />
      <line x1="10" y1="2" x2="10" y2="14" />
    </svg>
  ),
  'kanban-task': (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <path d="M5.5 8l2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'docs-entry': (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 13V3C3 2.44772 3.44772 2 4 2H12V14H4C3.44772 14 3 13.5523 3 13Z" />
      <path d="M3 13C3 12.4477 3.44772 12 4 12H12" />
      <line x1="5.5" y1="5" x2="10" y2="5" strokeLinecap="round" />
      <line x1="5.5" y1="7.5" x2="9" y2="7.5" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 5V12.5C2 13.0523 2.44772 13.5 3 13.5H13C13.5523 13.5 14 13.0523 14 12.5V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
    </svg>
  ),
};

function getIcon(category: SearchResultCategory): React.ReactNode {
  return SearchIcons[category] || SearchIcons.file;
}

// ============================================
// Main Component
// ============================================

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { openDocument } = useDocument();
  const { results, isSearching, hasWorkspace } = useGlobalSearch({
    query,
    filter,
    maxResults: 50,
  });

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setFilter('all');
      // Focus input after a small delay to ensure the component is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle result selection
  const handleSelect = useCallback(async (result: SearchResult) => {
    onClose();

    // Small delay to let the modal close
    await new Promise(resolve => setTimeout(resolve, 50));

    switch (result.category) {
      case 'file':
        if (result.filePath) {
          await openDocument(result.filePath);
        }
        break;

      case 'env-variable':
        // Dispatch custom event to navigate to env variable
        window.dispatchEvent(new CustomEvent('miku:navigateToEnvVar', {
          detail: { variableId: result.itemId }
        }));
        break;

      case 'kanban-card':
        // Dispatch custom event to open kanban card
        window.dispatchEvent(new CustomEvent('miku:navigateToKanbanCard', {
          detail: { cardId: result.itemId, columnId: result.parentId }
        }));
        break;

      case 'kanban-task':
        // Dispatch custom event to navigate to kanban task
        window.dispatchEvent(new CustomEvent('miku:navigateToKanbanTask', {
          detail: { taskId: result.itemId, cardId: result.parentId }
        }));
        break;

      case 'docs-entry':
        // Dispatch custom event to navigate to docs entry
        window.dispatchEvent(new CustomEvent('miku:navigateToDocsEntry', {
          detail: { entryId: result.itemId, fileIndex: result.fileIndex }
        }));
        break;
    }
  }, [onClose, openDocument]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        // Tab through filters
        e.preventDefault();
        const currentFilterIndex = FILTER_OPTIONS.findIndex(f => f.value === filter);
        const nextIndex = e.shiftKey
          ? (currentFilterIndex - 1 + FILTER_OPTIONS.length) % FILTER_OPTIONS.length
          : (currentFilterIndex + 1) % FILTER_OPTIONS.length;
        setFilter(FILTER_OPTIONS[nextIndex].value);
        break;
    }
  }, [results, selectedIndex, handleSelect, onClose, filter]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultCategory, SearchResult[]> = {
      'file': [],
      'env-variable': [],
      'kanban-card': [],
      'kanban-task': [],
      'docs-entry': [],
    };

    for (const result of results) {
      groups[result.category].push(result);
    }

    return groups;
  }, [results]);

  // Get display order for categories
  const categoryOrder: SearchResultCategory[] = ['file', 'env-variable', 'kanban-card', 'kanban-task', 'docs-entry'];

  const categoryLabels: Record<SearchResultCategory, string> = {
    'file': 'Files',
    'env-variable': 'Environment Variables',
    'kanban-card': 'Kanban Cards',
    'kanban-task': 'Kanban Tasks',
    'docs-entry': 'Documentation',
  };

  if (!isOpen) return null;

  // Track current index for keyboard navigation across groups
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

      {/* Search Modal */}
      <div
        style={{
          position: 'fixed',
          top: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '600px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'globalSearchIn 0.15s ease',
        }}
        role="dialog"
        aria-label="Global Search"
      >
        {/* Search Input */}
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
            <span style={{ color: 'var(--text-tertiary)', display: 'flex' }}>
              {SearchIcons.search}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search files, variables, cards, tasks, docs..."
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

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              marginTop: '10px',
              overflowX: 'auto',
            }}
          >
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                style={{
                  padding: '4px 10px',
                  background: filter === option.value ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                  border: filter === option.value ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: filter === option.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.1s ease',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {!hasWorkspace && query.trim() && filter !== 'env-variable' && filter !== 'kanban-card' && filter !== 'kanban-task' && filter !== 'docs-entry' ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '14px',
              }}
            >
              <p style={{ margin: '0 0 8px 0' }}>No workspace open</p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                Open a workspace to search files
              </p>
            </div>
          ) : !query.trim() ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '14px',
              }}
            >
              <p style={{ margin: 0 }}>
                Start typing to search across all your content
              </p>
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '14px',
              }}
            >
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : filter === 'all' ? (
            // Grouped view
            categoryOrder.map((category) => {
              const categoryResults = groupedResults[category];
              if (categoryResults.length === 0) return null;

              return (
                <div key={category}>
                  <div
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {categoryLabels[category]}
                  </div>
                  {categoryResults.map((result) => {
                    const index = currentIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <ResultItem
                        key={result.id}
                        result={result}
                        isSelected={isSelected}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      />
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Flat view (filtered)
            results.map((result, index) => {
              const isSelected = index === selectedIndex;

              return (
                <ResultItem
                  key={result.id}
                  result={result}
                  isSelected={isSelected}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              );
            })
          )}
        </div>

        {/* Footer */}
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
            <span>navigate</span>
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
              tab
            </kbd>
            <span>filter</span>
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
            <span>select</span>
          </span>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes globalSearchIn {
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

// ============================================
// Result Item Component
// ============================================

interface ResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ResultItem({ result, isSelected, onClick, onMouseEnter }: ResultItemProps) {
  return (
    <button
      data-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
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
          color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {getIcon(result.category)}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: 'var(--text-primary)',
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {result.title}
        </div>
        {result.subtitle && (
          <div
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '2px',
            }}
          >
            {result.subtitle}
          </div>
        )}
      </div>

      {/* Category badge */}
      <span
        style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          background: isSelected ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
          padding: '2px 6px',
          borderRadius: '4px',
          flexShrink: 0,
        }}
      >
        {getCategoryLabel(result.category)}
      </span>
    </button>
  );
}

function getCategoryLabel(category: SearchResultCategory): string {
  switch (category) {
    case 'file':
      return 'File';
    case 'env-variable':
      return 'Env';
    case 'kanban-card':
      return 'Card';
    case 'kanban-task':
      return 'Task';
    case 'docs-entry':
      return 'Doc';
    default:
      return 'Item';
  }
}
