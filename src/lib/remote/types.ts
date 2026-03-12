/**
 * Miku Remote — Shared Types
 *
 * Type definitions for the peer-to-peer sync and agent relay protocol.
 */

// ============================================
// Connection Types
// ============================================

export type RemoteRole = 'host' | 'guest';
export type RemoteConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RemotePeerInfo {
  peerId: string;
  role: RemoteRole;
  connectedAt: string;
}

export interface RemotePeerState {
  status: RemoteConnectionStatus;
  role: RemoteRole | null;
  roomCode: string | null;
  peerId: string | null;
  connectedPeers: RemotePeerInfo[];
  error?: string;
}

export const DEFAULT_REMOTE_STATE: RemotePeerState = {
  status: 'disconnected',
  role: null,
  roomCode: null,
  peerId: null,
  connectedPeers: [],
};

// ============================================
// File Sync Protocol
// ============================================

export interface FileManifestEntry {
  /** Relative path from workspace root */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (Unix ms) */
  modifiedAt: number;
}

export type FileSyncMessage =
  | { type: 'manifest'; files: FileManifestEntry[] }
  | { type: 'request_files'; paths: string[] }
  | {
      type: 'file_content';
      path: string;
      content: string;
      modifiedAt: number;
      chunk?: { index: number; total: number };
    }
  | { type: 'file_deleted'; path: string; deletedAt: number }
  | { type: 'file_renamed'; oldPath: string; newPath: string; renamedAt: number };

// ============================================
// Agent Relay Protocol
// ============================================

import type { AcpSessionUpdate, AcpPermissionRequest } from '@/lib/acpClient';
import type {
  AgentMessage,
  AgentTask,
  AgentActivityStatus,
  AgentConnectionStatus,
} from '@/types/agent';

export type AgentRelayMessage =
  | { type: 'agent_event'; event: AcpSessionUpdate }
  | { type: 'agent_status'; status: AgentActivityStatus; connectionStatus: AgentConnectionStatus }
  | { type: 'agent_permission'; request: AcpPermissionRequest }
  | { type: 'remote_command'; prompt: string }
  | { type: 'remote_approval'; approvalId: string; granted: boolean }
  | { type: 'agent_session_state'; conversation: AgentMessage[]; tasks: AgentTask[] };

// ============================================
// Unified Message Envelope
// ============================================

export type RemoteMessage =
  | { channel: 'file-sync'; data: FileSyncMessage }
  | { channel: 'agent-relay'; data: AgentRelayMessage }
  | { channel: 'control'; data: ControlMessage };

export type ControlMessage =
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'peer_info'; role: RemoteRole; workspaceName: string };

// ============================================
// Constants
// ============================================

export const ROOM_CODE_LENGTH = 6;
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const HEARTBEAT_TIMEOUT_MS = 30_000;
export const MAX_RECONNECT_ATTEMPTS = 3;
export const RECONNECT_BASE_DELAY_MS = 2_000;
export const FILE_CHUNK_SIZE = 16 * 1024; // 16KB
