'use client';

import { useWorkspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';

export default function WorkspaceSelector() {
  const { workspace, selectWorkspace, openWorkspace, hasWorkspace } = useWorkspace();

  // Don't show in browser mode or if workspace is selected
  if (!isTauri() || hasWorkspace) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--spacing-6)',
      }}
    >
      <div
        style={{
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Logo/Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-2)',
          }}
        >
          Miku
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: 'var(--spacing-8)',
          }}
        >
          The Editor That Listens
        </p>

        {/* Workspace Selection */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-6)',
            border: '1px solid var(--border-default)',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-2)',
            }}
          >
            Choose a Workspace
          </h2>
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '13px',
              marginBottom: 'var(--spacing-6)',
            }}
          >
            Select a folder to store your markdown files
          </p>

          <button
            onClick={selectWorkspace}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
            </svg>
            Open Folder
          </button>
        </div>

        {/* Recent Workspaces */}
        {workspace.recentWorkspaces.length > 0 && (
          <div
            style={{
              marginTop: 'var(--spacing-6)',
            }}
          >
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--spacing-3)',
              }}
            >
              Recent Workspaces
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-2)',
              }}
            >
              {workspace.recentWorkspaces.map((ws) => (
                <button
                  key={ws.path}
                  onClick={() => openWorkspace(ws.path)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                    <path d="M2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4V5Z" />
                  </svg>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
