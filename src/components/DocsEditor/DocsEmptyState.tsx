'use client';

interface DocsEmptyStateProps {
  onAddEntry: () => void;
}

/**
 * Empty state displayed when no documentation entries exist
 */
export default function DocsEmptyState({ onAddEntry }: DocsEmptyStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-8)',
      }}
    >
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {/* Document icon */}
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </div>

        <h3
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          No documentation yet
        </h3>

        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          Add documentation by pasting markdown or importing from GitHub
        </p>

        <button
          onClick={onAddEntry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Documentation
        </button>

        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: '16px',
          }}
        >
          Tip: Import documentation from any public GitHub repository
        </p>
      </div>
    </div>
  );
}
