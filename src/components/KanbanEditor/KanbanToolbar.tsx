'use client';

interface KanbanToolbarProps {
  boardName?: string;
  totalCards: number;
  columnCount: number;
  onAddColumn: () => void;
}

/**
 * Toolbar for the kanban board
 * Shows board name, card count, and add column button
 */
export default function KanbanToolbar({
  boardName,
  totalCards,
  columnCount,
  onAddColumn,
}: KanbanToolbarProps) {
  const canAddColumn = columnCount < 10;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-4)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Board name */}
      {boardName && (
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {boardName}
        </span>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          {columnCount} column{columnCount !== 1 ? 's' : ''}
        </span>

        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="9" x2="17" y2="9" />
            <line x1="7" y1="13" x2="12" y2="13" />
          </svg>
          {totalCards} card{totalCards !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Add column button */}
      <button
        onClick={onAddColumn}
        disabled={!canAddColumn}
        title={canAddColumn ? 'Add column' : 'Maximum 10 columns'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: canAddColumn ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          color: canAddColumn ? 'white' : 'var(--text-tertiary)',
          border: 'none',
          cursor: canAddColumn ? 'pointer' : 'not-allowed',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          transition: 'opacity var(--duration-fast) var(--easing-default)',
        }}
        onMouseEnter={(e) => {
          if (canAddColumn) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Column
      </button>
    </div>
  );
}
