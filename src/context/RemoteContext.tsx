'use client';

/**
 * Remote Context
 *
 * Orchestrates the Miku Remote system: peer connections, file sync, and agent relay.
 * Coordinates between WorkspaceContext and AgentEditorContext.
 *
 * Key behaviors:
 * - Guest joining auto-creates a remote workspace directory
 * - Agent relay events are tracked and exposed for UI rendering
 * - Session state from host auto-opens an agent chat on the guest
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { MikuPeer } from '@/lib/remote/peer';
import { RemoteWorkspaceManager } from '@/lib/remote/remoteWorkspace';
import { AgentRelayHost, AgentRelayRemote } from '@/lib/remote/agentRelay';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';
import type {
  RemoteConnectionStatus,
  RemoteRole,
  RemotePeerInfo,
  AgentRelayMessage,
  FileSyncMessage,
} from '@/lib/remote/types';
import type {
  AgentActivityStatus,
  AgentConnectionStatus,
} from '@/types/agent';

// ============================================
// Context Types
// ============================================

interface RemoteState {
  status: RemoteConnectionStatus;
  role: RemoteRole | null;
  roomCode: string | null;
  connectedPeers: RemotePeerInfo[];
  syncStatus: 'idle' | 'syncing' | 'error';
  agentStatus: AgentActivityStatus | null;
  agentConnectionStatus: AgentConnectionStatus | null;
  /** Path to an agent chat file that should be auto-opened (set when session state arrives) */
  pendingAgentChatPath: string | null;
  /** Increments each time a new peer connects (host side) — used by AgentChatEditor to trigger session state send */
  peerConnectGeneration: number;
  error?: string;
}

interface RemoteContextType {
  remote: RemoteState;
  /** Create a room as host and start sharing the workspace */
  startSharing: (workspacePath: string) => Promise<string>;
  /** Join a room by code as guest (auto-creates remote workspace) */
  joinRoom: (code: string) => Promise<void>;
  /** Disconnect from the remote session */
  disconnect: () => Promise<void>;
  /** Whether remote is currently active */
  isActive: boolean;
  /** Get the agent relay host (for wiring into agent context) */
  getAgentRelayHost: () => AgentRelayHost | null;
  /** Get the agent relay remote (for wiring into agent context) */
  getAgentRelayRemote: () => AgentRelayRemote | null;
  /** Clear the pending agent chat path after it has been opened */
  clearPendingAgentChat: () => void;
}

const RemoteContext = createContext<RemoteContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface RemoteProviderProps {
  children: ReactNode;
}

export function RemoteProvider({ children }: RemoteProviderProps) {
  const { openRemoteWorkspace, refreshFiles } = useWorkspace();

  const [remote, setRemote] = useState<RemoteState>({
    status: 'disconnected',
    role: null,
    roomCode: null,
    connectedPeers: [],
    syncStatus: 'idle',
    agentStatus: null,
    agentConnectionStatus: null,
    pendingAgentChatPath: null,
    peerConnectGeneration: 0,
  });

  const peerRef = useRef<MikuPeer | null>(null);
  const workspaceManagerRef = useRef<RemoteWorkspaceManager | null>(null);
  const agentRelayHostRef = useRef<AgentRelayHost | null>(null);
  const agentRelayRemoteRef = useRef<AgentRelayRemote | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.disconnect();
    };
  }, []);

  const setupPeerHandlers = useCallback(
    (peer: MikuPeer, workspacePath: string, role: RemoteRole) => {
      // Workspace manager is created with a placeholder peerId.
      // The actual peerId is set after the peer connects (see startSharing/joinRoom).
      const wsManager = new RemoteWorkspaceManager(peer, workspacePath, 'pending');
      wsManager.setHandlers({
        onRefreshFiles: refreshFiles,
        onSyncStatusChange: (syncStatus) => {
          setRemote(prev => ({ ...prev, syncStatus }));
        },
      });
      workspaceManagerRef.current = wsManager;

      // Set up agent relay based on role
      if (role === 'host') {
        const relay = new AgentRelayHost(peer);
        agentRelayHostRef.current = relay;
        agentRelayRemoteRef.current = null;
      } else {
        const relay = new AgentRelayRemote(peer);
        // Track agent status from host on the guest side
        relay.setHandlers({
          onAgentStatus: (status, connectionStatus) => {
            setRemote(prev => ({
              ...prev,
              agentStatus: status,
              agentConnectionStatus: connectionStatus,
            }));
          },
          onSessionState: async (_conversation, _tasks) => {
            // Auto-create a .miku-chat file in the remote workspace and signal it should be opened
            if (!workspacePath) return;
            try {
              const chatFileName = 'remote-agent.miku-chat';
              const chatPath = `${workspacePath}/${chatFileName}`;
              if (isTauri()) {
                const { invoke } = await import('@tauri-apps/api/core');
                // Create the file (save_file creates or overwrites)
                await invoke('save_file', { path: chatPath, content: '' });
              }
              setRemote(prev => ({ ...prev, pendingAgentChatPath: chatPath }));
            } catch (err) {
              console.error('Failed to auto-create agent chat file:', err);
            }
          },
        });
        agentRelayRemoteRef.current = relay;
        agentRelayHostRef.current = null;
      }

      // Set peer handlers
      peer.setHandlers({
        onStatusChange: (status, error) => {
          setRemote(prev => ({ ...prev, status, error }));
        },
        onPeerConnected: (peerInfo) => {
          setRemote(prev => ({
            ...prev,
            connectedPeers: [...prev.connectedPeers, peerInfo],
            // Increment generation so host AgentChatEditor can react to new peers
            peerConnectGeneration: prev.peerConnectGeneration + 1,
          }));

          // Start file sync when a peer connects
          wsManager.start().catch(console.error);
        },
        onPeerDisconnected: (peerId) => {
          setRemote(prev => ({
            ...prev,
            connectedPeers: prev.connectedPeers.filter(p => p.peerId !== peerId),
          }));
        },
        onFileSyncMessage: (message: FileSyncMessage) => {
          wsManager.getFileSync().handleMessage(message);
        },
        onAgentRelayMessage: (message: AgentRelayMessage) => {
          if (role === 'host' && agentRelayHostRef.current) {
            agentRelayHostRef.current.handleMessage(message);
          } else if (role === 'guest' && agentRelayRemoteRef.current) {
            agentRelayRemoteRef.current.handleMessage(message);
          }
        },
      });
    },
    [refreshFiles],
  );

  const startSharing = useCallback(
    async (workspacePath: string): Promise<string> => {
      if (peerRef.current) {
        await peerRef.current.disconnect();
      }

      const peer = new MikuPeer();
      peerRef.current = peer;

      setupPeerHandlers(peer, workspacePath, 'host');

      const roomCode = await peer.createRoom();

      // Update the FileSyncManager with the actual peerId now that the peer is connected
      if (workspaceManagerRef.current && peer.peerId) {
        workspaceManagerRef.current.getFileSync().setPeerId(peer.peerId);
      }

      setRemote({
        status: 'connected',
        role: 'host',
        roomCode,
        connectedPeers: [],
        syncStatus: 'idle',
        agentStatus: null,
        agentConnectionStatus: null,
        pendingAgentChatPath: null,
        peerConnectGeneration: 0,
      });

      try {
        localStorage.setItem(
          'miku-remote-last',
          JSON.stringify({ roomCode, role: 'host', workspacePath }),
        );
      } catch {
        // localStorage may not be available
      }

      return roomCode;
    },
    [setupPeerHandlers],
  );

  const joinRoom = useCallback(
    async (code: string): Promise<void> => {
      if (peerRef.current) {
        await peerRef.current.disconnect();
      }

      const upperCode = code.toUpperCase();

      // Auto-create a persistent remote workspace directory
      let workspacePath = '';
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        workspacePath = await invoke<string>('create_remote_workspace', { roomCode: upperCode });
      }

      const peer = new MikuPeer();
      peerRef.current = peer;

      setupPeerHandlers(peer, workspacePath, 'guest');

      await peer.joinRoom(code);

      // Update the FileSyncManager with the actual peerId now that the peer is connected
      if (workspaceManagerRef.current && peer.peerId) {
        workspaceManagerRef.current.getFileSync().setPeerId(peer.peerId);
      }

      // Open the remote workspace in WorkspaceContext
      if (workspacePath) {
        await openRemoteWorkspace(workspacePath, {
          peerId: peer.peerId ?? '',
          roomCode: upperCode,
          role: 'guest',
          status: 'connected',
        });
      }

      setRemote({
        status: 'connected',
        role: 'guest',
        roomCode: upperCode,
        connectedPeers: peer.connectedPeers,
        syncStatus: 'idle',
        agentStatus: null,
        agentConnectionStatus: null,
        pendingAgentChatPath: null,
        peerConnectGeneration: 0,
      });

      try {
        localStorage.setItem(
          'miku-remote-last',
          JSON.stringify({ roomCode: code, role: 'guest', workspacePath }),
        );
      } catch {
        // localStorage may not be available
      }
    },
    [setupPeerHandlers, openRemoteWorkspace],
  );

  const disconnect = useCallback(async () => {
    // Stop workspace manager
    if (workspaceManagerRef.current) {
      await workspaceManagerRef.current.stop();
      workspaceManagerRef.current = null;
    }

    // Disconnect peer
    if (peerRef.current) {
      await peerRef.current.disconnect();
      peerRef.current = null;
    }

    // Clear relay refs
    agentRelayHostRef.current = null;
    agentRelayRemoteRef.current = null;

    setRemote({
      status: 'disconnected',
      role: null,
      roomCode: null,
      connectedPeers: [],
      syncStatus: 'idle',
      agentStatus: null,
      agentConnectionStatus: null,
      pendingAgentChatPath: null,
      peerConnectGeneration: 0,
    });

    try {
      localStorage.removeItem('miku-remote-last');
    } catch {
      // localStorage may not be available
    }
  }, []);

  const getAgentRelayHost = useCallback(() => agentRelayHostRef.current, []);
  const getAgentRelayRemote = useCallback(() => agentRelayRemoteRef.current, []);
  const clearPendingAgentChat = useCallback(() => {
    setRemote(prev => ({ ...prev, pendingAgentChatPath: null }));
  }, []);

  const value: RemoteContextType = {
    remote,
    startSharing,
    joinRoom,
    disconnect,
    isActive: remote.status === 'connected',
    getAgentRelayHost,
    getAgentRelayRemote,
    clearPendingAgentChat,
  };

  return (
    <RemoteContext.Provider value={value}>
      {children}
    </RemoteContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useRemote() {
  const context = useContext(RemoteContext);
  if (!context) {
    throw new Error('useRemote must be used within a RemoteProvider');
  }
  return context;
}
