'use client';

/**
 * Remote Context
 *
 * Orchestrates the Miku Remote system: peer connections, file sync, and agent relay.
 * Coordinates between WorkspaceContext and AgentEditorContext.
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
import type {
  RemoteConnectionStatus,
  RemoteRole,
  RemotePeerInfo,
  AgentRelayMessage,
  FileSyncMessage,
} from '@/lib/remote/types';
import { DEFAULT_REMOTE_STATE } from '@/lib/remote/types';

// ============================================
// Context Types
// ============================================

interface RemoteState {
  status: RemoteConnectionStatus;
  role: RemoteRole | null;
  roomCode: string | null;
  connectedPeers: RemotePeerInfo[];
  syncStatus: 'idle' | 'syncing' | 'error';
  error?: string;
}

interface RemoteContextType {
  remote: RemoteState;
  /** Create a room as host and start sharing the workspace */
  startSharing: (workspacePath: string) => Promise<string>;
  /** Join a room by code as guest */
  joinRoom: (code: string, workspacePath: string) => Promise<void>;
  /** Disconnect from the remote session */
  disconnect: () => Promise<void>;
  /** Whether remote is currently active */
  isActive: boolean;
  /** Get the agent relay host (for wiring into agent context) */
  getAgentRelayHost: () => AgentRelayHost | null;
  /** Get the agent relay remote (for wiring into agent context) */
  getAgentRelayRemote: () => AgentRelayRemote | null;
}

const RemoteContext = createContext<RemoteContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface RemoteProviderProps {
  children: ReactNode;
  /** Callback to refresh workspace files after remote sync changes */
  onRefreshFiles?: () => void;
  /** Callback to dispatch remote agent events */
  onRemoteAgentEvent?: (event: AgentRelayMessage) => void;
}

export function RemoteProvider({ children, onRefreshFiles, onRemoteAgentEvent }: RemoteProviderProps) {
  const [remote, setRemote] = useState<RemoteState>({
    status: 'disconnected',
    role: null,
    roomCode: null,
    connectedPeers: [],
    syncStatus: 'idle',
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
        onRefreshFiles,
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
          // Forward to parent for agent context integration
          onRemoteAgentEvent?.(message);
        },
      });
    },
    [onRefreshFiles, onRemoteAgentEvent],
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
      });

      // Save to localStorage for reconnect hints
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
    async (code: string, workspacePath: string): Promise<void> => {
      if (peerRef.current) {
        await peerRef.current.disconnect();
      }

      const peer = new MikuPeer();
      peerRef.current = peer;

      setupPeerHandlers(peer, workspacePath, 'guest');

      await peer.joinRoom(code);

      // Update the FileSyncManager with the actual peerId now that the peer is connected
      if (workspaceManagerRef.current && peer.peerId) {
        workspaceManagerRef.current.getFileSync().setPeerId(peer.peerId);
      }

      setRemote({
        status: 'connected',
        role: 'guest',
        roomCode: code.toUpperCase(),
        connectedPeers: peer.connectedPeers,
        syncStatus: 'idle',
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
    [setupPeerHandlers],
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
    });

    try {
      localStorage.removeItem('miku-remote-last');
    } catch {
      // localStorage may not be available
    }
  }, []);

  const getAgentRelayHost = useCallback(() => agentRelayHostRef.current, []);
  const getAgentRelayRemote = useCallback(() => agentRelayRemoteRef.current, []);

  const value: RemoteContextType = {
    remote,
    startSharing,
    joinRoom,
    disconnect,
    isActive: remote.status === 'connected',
    getAgentRelayHost,
    getAgentRelayRemote,
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
