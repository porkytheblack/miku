'use client';

/**
 * RemoteStatusBoard
 *
 * Dashboard displayed when a remote workspace is active and no document is open.
 * Shows connection status, sync status, agent status, and connected peers.
 */

import { useRemote } from '@/context/RemoteContext';
import { useWorkspace } from '@/context/WorkspaceContext';

// ============================================
// Styles
// ============================================

const S: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: 32,
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)',
    color: 'var(--text-primary, #e0e0e0)',
    background: 'var(--bg-primary, #1a1a2e)',
    overflow: 'auto',
  },
  board: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    maxWidth: 480,
    width: '100%',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary, #e0e0e0)',
  },
  roomCode: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: 4,
    color: 'var(--accent-color, #5b8def)',
    margin: '8px 0 0',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-secondary, #888)',
    margin: '4px 0 0',
  },
  card: {
    background: 'var(--bg-secondary, #16213e)',
    border: '1px solid var(--border-color, #2a2a4a)',
    borderRadius: 10,
    padding: 16,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: 'var(--text-secondary, #888)',
    margin: '0 0 12px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  statusLabel: {
    fontSize: 14,
    color: 'var(--text-primary, #e0e0e0)',
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 12,
    textTransform: 'capitalize' as const,
  },
  peerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    fontSize: 13,
    color: 'var(--text-secondary, #888)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  disconnectBtn: {
    width: '100%',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid var(--border-color, #2a2a4a)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text-secondary, #888)',
    cursor: 'pointer',
    marginTop: 8,
  },
  emptyPeers: {
    fontSize: 13,
    color: 'var(--text-tertiary, #555)',
    fontStyle: 'italic',
  },
};

// ============================================
// Helpers
// ============================================

function badgeColor(variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray'): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    green: { bg: 'rgba(39, 174, 96, 0.15)', fg: '#27ae60' },
    yellow: { bg: 'rgba(245, 166, 35, 0.15)', fg: '#f5a623' },
    red: { bg: 'rgba(235, 87, 87, 0.15)', fg: '#eb5757' },
    blue: { bg: 'rgba(91, 141, 239, 0.15)', fg: '#5b8def' },
    gray: { bg: 'rgba(136, 136, 136, 0.15)', fg: '#888' },
  };
  const c = colors[variant] || colors.gray;
  return { ...S.badge, background: c.bg, color: c.fg };
}

function connectionBadge(status: string) {
  switch (status) {
    case 'connected': return { label: 'Connected', variant: 'green' as const };
    case 'connecting': return { label: 'Connecting...', variant: 'yellow' as const };
    case 'error': return { label: 'Error', variant: 'red' as const };
    default: return { label: 'Disconnected', variant: 'gray' as const };
  }
}

function syncBadge(status: string) {
  switch (status) {
    case 'syncing': return { label: 'Syncing', variant: 'yellow' as const };
    case 'error': return { label: 'Sync Error', variant: 'red' as const };
    default: return { label: 'Idle', variant: 'green' as const };
  }
}

function agentBadge(status: string | null, connStatus: string | null) {
  if (!connStatus || connStatus === 'disconnected') {
    return { label: 'Not Connected', variant: 'gray' as const };
  }
  switch (status) {
    case 'thinking':
    case 'working': return { label: status === 'thinking' ? 'Thinking' : 'Working', variant: 'yellow' as const };
    case 'waiting_approval': return { label: 'Awaiting Approval', variant: 'blue' as const };
    case 'idle': return { label: 'Idle', variant: 'green' as const };
    default: return { label: 'Unknown', variant: 'gray' as const };
  }
}

// ============================================
// Component
// ============================================

export default function RemoteStatusBoard() {
  const { remote, disconnect } = useRemote();
  const { workspace } = useWorkspace();

  const conn = connectionBadge(remote.status);
  const sync = syncBadge(remote.syncStatus);
  const agent = agentBadge(remote.agentStatus, remote.agentConnectionStatus);

  const fileCount = workspace.files.length;

  return (
    <div style={S.container}>
      <div style={S.board}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>Remote Workspace</h2>
          {remote.roomCode && <div style={S.roomCode}>{remote.roomCode}</div>}
          <div style={S.subtitle}>
            {remote.role === 'host' ? 'Hosting' : 'Connected as guest'}
          </div>
        </div>

        {/* Connection Status */}
        <div style={S.card}>
          <div style={S.cardTitle}>Status</div>

          <div style={S.statusRow}>
            <span style={S.statusLabel}>Connection</span>
            <span style={badgeColor(conn.variant)}>{conn.label}</span>
          </div>

          <div style={S.statusRow}>
            <span style={S.statusLabel}>File Sync</span>
            <span style={badgeColor(sync.variant)}>{sync.label}</span>
          </div>

          <div style={S.statusRow}>
            <span style={S.statusLabel}>Agent</span>
            <span style={badgeColor(agent.variant)}>{agent.label}</span>
          </div>

          <div style={S.statusRow}>
            <span style={S.statusLabel}>Files</span>
            <span style={S.statusLabel}>{fileCount}</span>
          </div>
        </div>

        {/* Connected Peers */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            Connected Peers ({remote.connectedPeers.length})
          </div>
          {remote.connectedPeers.length === 0 ? (
            <div style={S.emptyPeers}>No peers connected yet</div>
          ) : (
            remote.connectedPeers.map((peer) => (
              <div key={peer.peerId} style={S.peerItem}>
                <span style={{ ...S.dot, background: '#27ae60' }} />
                <span>{peer.peerId.slice(0, 12)}...</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>
                  {peer.role}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {remote.error && (
          <div style={{ ...S.card, borderColor: 'rgba(235, 87, 87, 0.3)' }}>
            <div style={{ ...S.cardTitle, color: '#eb5757' }}>Error</div>
            <div style={{ fontSize: 13, color: '#eb5757' }}>{remote.error}</div>
          </div>
        )}

        {/* Disconnect */}
        <button
          style={S.disconnectBtn}
          onClick={disconnect}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#eb5757';
            e.currentTarget.style.color = '#eb5757';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color, #2a2a4a)';
            e.currentTarget.style.color = 'var(--text-secondary, #888)';
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
