'use client';

/**
 * Remote Panel Component
 *
 * Provides the UI for Miku Remote: creating rooms, joining rooms,
 * and showing connection status with clear user guidance.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRemote } from '@/context/RemoteContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';

// ============================================
// Styles
// ============================================

const S = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  panel: {
    backgroundColor: 'var(--bg-primary, #1a1a2e)',
    border: '1px solid var(--border-color, #333)',
    borderRadius: '12px',
    padding: '24px',
    width: '420px',
    maxWidth: '90vw',
    color: 'var(--text-primary, #e0e0e0)',
    fontFamily: 'var(--font-family-ui, system-ui, sans-serif)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary, #888)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary, #888)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-secondary, #252540)',
    border: '1px solid var(--border-color, #333)',
    borderRadius: '8px',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '16px',
    letterSpacing: '4px',
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
  primaryBtn: {
    backgroundColor: 'var(--accent-color, #6366f1)',
    color: 'white',
  },
  secondaryBtn: {
    backgroundColor: 'var(--bg-secondary, #252540)',
    color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border-color, #333)',
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
    color: 'white',
  },
  roomCode: {
    fontSize: '32px',
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '6px',
    textAlign: 'center' as const,
    padding: '16px',
    backgroundColor: 'var(--bg-secondary, #252540)',
    borderRadius: '8px',
    marginBottom: '8px',
    userSelect: 'all' as const,
  },
  hint: {
    fontSize: '12px',
    color: 'var(--text-secondary, #888)',
    textAlign: 'center' as const,
    marginTop: '4px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  peerList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  peerItem: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary, #252540)',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--border-color, #333)',
    margin: '16px 0',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '12px',
    color: 'var(--text-secondary, #888)',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  stepNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
  },
  stepLine: {
    width: '20px',
    height: '1px',
    backgroundColor: 'var(--border-color, #444)',
  },
  syncBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 500,
  },
  toast: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
};

// ============================================
// Toast notification hook
// ============================================

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}

// ============================================
// Step Indicator
// ============================================

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Share', 'Enter code', 'Connected'];
  return (
    <div style={S.stepIndicator}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {i > 0 && <div style={S.stepLine} />}
          <div style={S.step}>
            <div
              style={{
                ...S.stepNumber,
                backgroundColor: i <= currentStep ? 'var(--accent-color, #6366f1)' : 'var(--bg-secondary, #252540)',
                color: i <= currentStep ? 'white' : 'var(--text-secondary, #888)',
              }}
            >
              {i < currentStep ? '\u2713' : i + 1}
            </div>
            <span style={{ color: i <= currentStep ? 'var(--text-primary, #e0e0e0)' : undefined }}>
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Sync Status Badge
// ============================================

function SyncStatusBadge({ status }: { status: 'idle' | 'syncing' | 'error' }) {
  const config = {
    idle: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Synced' },
    syncing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Syncing...' },
    error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Sync error' },
  }[status];

  return (
    <span style={{ ...S.syncBadge, backgroundColor: config.bg, color: config.color }}>
      <span style={{ ...S.statusDot, width: '6px', height: '6px', backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}

// ============================================
// Component
// ============================================

interface RemotePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RemotePanel({ isOpen, onClose }: RemotePanelProps) {
  const { remote, startSharing, joinRoom, disconnect, isActive } = useRemote();
  const { workspace } = useWorkspace();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast, showToast } = useToast();
  const [prevPeerCount, setPrevPeerCount] = useState(0);

  // Toast notifications for peer connect/disconnect
  useEffect(() => {
    const currentCount = remote.connectedPeers.length;
    if (currentCount > prevPeerCount) {
      showToast('A peer connected', 'success');
    } else if (currentCount < prevPeerCount && currentCount >= 0 && prevPeerCount > 0) {
      showToast('A peer disconnected', 'info');
    }
    setPrevPeerCount(currentCount);
  }, [remote.connectedPeers.length, prevPeerCount, showToast]);

  const handleStartSharing = useCallback(async () => {
    if (!workspace.currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      await startSharing(workspace.currentWorkspace.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sharing');
    } finally {
      setIsLoading(false);
    }
  }, [startSharing, workspace.currentWorkspace]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinCode.trim()) return;
    if (!isTauri()) {
      setError('Joining remote workspaces requires the Miku desktop app.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await joinRoom(joinCode.trim());
      showToast('Connected to remote workspace', 'success');
      onClose(); // Auto-close the panel after successful join
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  }, [joinRoom, joinCode, showToast, onClose]);

  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    try {
      await disconnect();
    } finally {
      setIsLoading(false);
    }
  }, [disconnect]);

  const handleCopyCode = useCallback(() => {
    if (remote.roomCode) {
      navigator.clipboard.writeText(remote.roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [remote.roomCode]);

  if (!isOpen) return null;

  const statusColor =
    remote.status === 'connected'
      ? '#22c55e'
      : remote.status === 'connecting'
        ? '#f59e0b'
        : remote.status === 'error'
          ? '#ef4444'
          : '#6b7280';

  // Determine current step for host flow
  const hostStep = !isActive ? 0 : remote.connectedPeers.length === 0 ? 1 : 2;

  return (
    <>
      <div style={S.overlay} onClick={onClose}>
        <div style={S.panel} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={S.header}>
            <h2 style={S.title}>Miku Remote</h2>
            <button style={S.closeBtn} onClick={onClose}>
              &times;
            </button>
          </div>

          {/* Error */}
          {(error || remote.error) && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error || remote.error}
            </div>
          )}

          {/* Connected State */}
          {isActive && (
            <>
              {/* Status + Sync */}
              <div style={{ ...S.section, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  style={{
                    ...S.statusBadge,
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                  }}
                >
                  <div style={{ ...S.statusDot, backgroundColor: statusColor }} />
                  {remote.role === 'host' ? 'Hosting' : 'Connected'} as {remote.role}
                </div>
                <SyncStatusBadge status={remote.syncStatus} />
              </div>

              {/* Room Code (host only) with step indicator */}
              {remote.role === 'host' && remote.roomCode && (
                <div style={S.section}>
                  <StepIndicator currentStep={hostStep} />
                  <div style={S.sectionTitle}>Room Code</div>
                  <div style={S.roomCode}>
                    {remote.roomCode}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                    <button
                      onClick={handleCopyCode}
                      style={{
                        ...S.button,
                        ...S.secondaryBtn,
                        width: 'auto',
                        padding: '6px 16px',
                        fontSize: '13px',
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                  <div style={S.hint}>
                    Share this code with your other device to connect.
                  </div>
                </div>
              )}

              {/* Workspace info for guest */}
              {remote.role === 'guest' && (
                <div style={{
                  ...S.section,
                  padding: '10px 12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}>
                  Viewing remote workspace via room <strong>{remote.roomCode}</strong>
                </div>
              )}

              {/* Connected Peers */}
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  Connected Peers ({remote.connectedPeers.length})
                </div>
                {remote.connectedPeers.length === 0 ? (
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary, #888)',
                    padding: '12px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-secondary, #252540)',
                    borderRadius: '6px',
                  }}>
                    Waiting for peers to connect...
                    {remote.role === 'host' && (
                      <div style={{ marginTop: '4px', fontSize: '11px' }}>
                        Share the room code above with your other device.
                      </div>
                    )}
                  </div>
                ) : (
                  <ul style={S.peerList}>
                    {remote.connectedPeers.map((peer) => (
                      <li key={peer.peerId} style={S.peerItem}>
                        <div style={{ ...S.statusDot, backgroundColor: '#22c55e' }} />
                        <span style={{ flex: 1 }}>
                          {peer.role === 'host' ? 'Host' : 'Guest'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', fontFamily: 'monospace' }}>
                          {peer.peerId.slice(-6)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <hr style={S.divider} />

              {/* Disconnect */}
              <button
                style={{ ...S.button, ...S.dangerBtn }}
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </>
          )}

          {/* Disconnected State */}
          {!isActive && (
            <>
              {/* Host Section */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Share this workspace</div>
                {!workspace.currentWorkspace ? (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '6px',
                      color: '#f59e0b',
                      fontSize: '13px',
                    }}
                  >
                    Open a workspace first to share it.
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary, #888)',
                      marginBottom: '8px',
                    }}>
                      Share <strong style={{ color: 'var(--text-primary, #e0e0e0)' }}>
                        {workspace.currentWorkspace.name}
                      </strong> with another device.
                    </div>
                    <button
                      style={{ ...S.button, ...S.primaryBtn }}
                      onClick={handleStartSharing}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Starting...' : 'Start Sharing'}
                    </button>
                    <div style={S.hint}>
                      Generates a code that another device can use to connect.
                    </div>
                  </>
                )}
              </div>

              <hr style={S.divider} />

              {/* Join Section */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Join a remote workspace</div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary, #888)',
                  marginBottom: '8px',
                }}>
                  A remote workspace will be created automatically.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="ABCDEF"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    style={S.input}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && joinCode.length === 6) {
                        handleJoinRoom();
                      }
                    }}
                  />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button
                    style={{ ...S.button, ...S.secondaryBtn }}
                    onClick={handleJoinRoom}
                    disabled={isLoading || joinCode.length < 6}
                  >
                    {isLoading ? 'Connecting...' : 'Join Room'}
                  </button>
                </div>
                <div style={S.hint}>
                  Enter the 6-character code from the host device.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            ...S.toast,
            backgroundColor: toast.type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(99, 102, 241, 0.9)',
            color: 'white',
          }}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

// ============================================
// Remote Status Badge (for TopBar/Sidebar)
// ============================================

interface RemoteStatusBadgeProps {
  onClick?: () => void;
}

export function RemoteStatusBadge({ onClick }: RemoteStatusBadgeProps) {
  const { remote, isActive } = useRemote();

  if (!isActive) {
    return (
      <button
        onClick={onClick}
        style={{
          background: 'none',
          border: '1px solid var(--border-color, #333)',
          borderRadius: '6px',
          padding: '4px 10px',
          color: 'var(--text-secondary, #888)',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title="Miku Remote"
      >
        Remote
      </button>
    );
  }

  const statusColor = remote.status === 'connected' ? '#22c55e' : '#f59e0b';
  const isSyncing = remote.syncStatus === 'syncing';

  return (
    <button
      onClick={onClick}
      style={{
        background: `${statusColor}15`,
        border: `1px solid ${statusColor}40`,
        borderRadius: '6px',
        padding: '4px 10px',
        color: statusColor,
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      title={`Miku Remote - ${remote.role} (${remote.roomCode})`}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          opacity: isSyncing ? undefined : 1,
          animation: isSyncing ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />
      {remote.role === 'host' ? 'Hosting' : 'Remote'}
      {` (${remote.connectedPeers.length})`}
    </button>
  );
}
