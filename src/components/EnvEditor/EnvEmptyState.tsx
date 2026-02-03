'use client';

interface EnvEmptyStateProps {
  onAddVariable: () => void;
  onImportFromClipboard: () => void;
}

/**
 * Empty state displayed when no environment variables exist
 */
export default function EnvEmptyState({ onAddVariable, onImportFromClipboard }: EnvEmptyStateProps) {
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
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
          No environment variables
        </h3>

        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          Get started by adding your first variable or paste from a .env file
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onAddVariable}
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
            Add Variable
          </button>

          <button
            onClick={onImportFromClipboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'background var(--duration-fast) var(--easing-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Paste from Clipboard
          </button>
        </div>

        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: '16px',
          }}
        >
          Tip: You can paste content directly from .env, JSON, or YAML files
        </p>
      </div>
    </div>
  );
}
