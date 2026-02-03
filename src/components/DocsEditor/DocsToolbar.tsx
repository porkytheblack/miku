'use client';

interface DocsToolbarProps {
  name?: string;
  entryCount: number;
  isSyncing: boolean;
  onAddEntry: () => void;
  onSyncAll: () => void;
}

/**
 * Toolbar for the docs editor
 * Shows collection name, entry count, and action buttons
 */
export default function DocsToolbar({
  name,
  entryCount,
  isSyncing,
  onAddEntry,
  onSyncAll,
}: DocsToolbarProps) {
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
      {/* Collection name */}
      {name && (
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {name}
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
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Sync all button */}
      {entryCount > 0 && (
        <button
          onClick={onSyncAll}
          disabled={isSyncing}
          title="Sync all GitHub entries"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            color: isSyncing ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            border: 'none',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            transition: 'all var(--duration-fast) var(--easing-default)',
          }}
          onMouseEnter={(e) => {
            if (!isSyncing) {
              e.currentTarget.style.background = 'var(--bg-hover)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
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
            style={{
              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
          </svg>
          {isSyncing ? 'Syncing...' : 'Sync All'}
        </button>
      )}

      {/* Add entry button */}
      <button
        onClick={onAddEntry}
        title="Add documentation"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          transition: 'opacity var(--duration-fast) var(--easing-default)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
