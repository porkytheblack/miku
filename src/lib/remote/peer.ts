/**
 * Miku Remote — Peer Management
 *
 * Wraps PeerJS to manage WebRTC connections for workspace sync and agent relay.
 * The host creates a room (identified by a 6-char code), and guests join by code.
 */

import Peer, { DataConnection } from 'peerjs';
import type {
  RemoteRole,
  RemoteConnectionStatus,
  RemotePeerInfo,
  RemoteMessage,
  ControlMessage,
  FileSyncMessage,
  AgentRelayMessage,
} from './types';
import {
  ROOM_CODE_LENGTH,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY_MS,
} from './types';

// ============================================
// Room Code Utilities
// ============================================

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I)
const PEER_ID_PREFIX = 'miku-remote-';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function roomCodeToPeerId(code: string): string {
  return `${PEER_ID_PREFIX}${code.toUpperCase()}`;
}

// ============================================
// Event Handlers Interface
// ============================================

export interface MikuPeerHandlers {
  onStatusChange?: (status: RemoteConnectionStatus, error?: string) => void;
  onPeerConnected?: (peer: RemotePeerInfo) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onFileSyncMessage?: (message: FileSyncMessage, fromPeerId: string) => void;
  onAgentRelayMessage?: (message: AgentRelayMessage, fromPeerId: string) => void;
}

// ============================================
// MikuPeer Class
// ============================================

export class MikuPeer {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastPongTimes = new Map<string, number>();
  private handlers: MikuPeerHandlers = {};
  private reconnectAttempts = 0;
  private _role: RemoteRole | null = null;
  private _roomCode: string | null = null;
  private _status: RemoteConnectionStatus = 'disconnected';
  private _destroyed = false;

  get role(): RemoteRole | null {
    return this._role;
  }

  get roomCode(): string | null {
    return this._roomCode;
  }

  get status(): RemoteConnectionStatus {
    return this._status;
  }

  get peerId(): string | null {
    return this.peer?.id ?? null;
  }

  get connectedPeers(): RemotePeerInfo[] {
    const peers: RemotePeerInfo[] = [];
    for (const [id, conn] of this.connections) {
      if (conn.open) {
        peers.push({
          peerId: id,
          role: this._role === 'host' ? 'guest' : 'host',
          connectedAt: new Date().toISOString(),
        });
      }
    }
    return peers;
  }

  setHandlers(handlers: MikuPeerHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Create a room as host. Returns the room code for guests to join.
   */
  async createRoom(): Promise<string> {
    if (this.peer) {
      throw new Error('Already connected. Disconnect first.');
    }

    this._role = 'host';
    this._roomCode = generateRoomCode();
    const peerId = roomCodeToPeerId(this._roomCode);

    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        resolve(this._roomCode!);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[MikuPeer] Error:', err);
        if (this._status === 'connecting') {
          this.setStatus('error', err.message);
          reject(err);
        } else {
          this.handleDisconnect();
        }
      });

      this.peer.on('disconnected', () => {
        this.handleDisconnect();
      });
    });
  }

  /**
   * Join a room by code as guest.
   */
  async joinRoom(code: string): Promise<void> {
    if (this.peer) {
      throw new Error('Already connected. Disconnect first.');
    }

    this._role = 'guest';
    this._roomCode = code.toUpperCase();
    const hostPeerId = roomCodeToPeerId(this._roomCode);

    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      // Guest gets a random peer ID
      this.peer = new Peer();

      this.peer.on('open', () => {
        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.setupConnection(conn);
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        conn.on('error', (err) => {
          this.setStatus('error', err.message);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[MikuPeer] Error:', err);
        this.setStatus('error', err.message);
        if (this._status === 'connecting') {
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        this.handleDisconnect();
      });
    });
  }

  /**
   * Send a file sync message to all connected peers.
   */
  sendFileSyncMessage(message: FileSyncMessage): void {
    this.broadcast({ channel: 'file-sync', data: message });
  }

  /**
   * Send an agent relay message to all connected peers.
   */
  sendAgentRelayMessage(message: AgentRelayMessage): void {
    this.broadcast({ channel: 'agent-relay', data: message });
  }

  /**
   * Disconnect and clean up all connections.
   */
  async disconnect(): Promise<void> {
    this._destroyed = true;

    // Stop heartbeats
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
    this.lastPongTimes.clear();

    // Close connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this._role = null;
    this._roomCode = null;
    this.setStatus('disconnected');
  }

  // ============================================
  // Private Methods
  // ============================================

  private setupConnection(conn: DataConnection): void {
    const peerId = conn.peer;

    const onOpen = () => {
      this.connections.set(peerId, conn);
      this.startHeartbeat(peerId);
      this.handlers.onPeerConnected?.({
        peerId,
        role: this._role === 'host' ? 'guest' : 'host',
        connectedAt: new Date().toISOString(),
      });
    };

    // PeerJS can deliver connections that are already open.
    // If so, the 'open' event will never fire, so handle it immediately.
    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (rawData) => {
      try {
        const message = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as RemoteMessage;
        this.handleMessage(message, peerId);
      } catch (err) {
        console.error('[MikuPeer] Failed to parse message:', err);
      }
    });

    conn.on('close', () => {
      this.connections.delete(peerId);
      this.stopHeartbeat(peerId);
      this.handlers.onPeerDisconnected?.(peerId);
    });

    conn.on('error', (err) => {
      console.error(`[MikuPeer] Connection error with ${peerId}:`, err);
    });
  }

  private handleMessage(message: RemoteMessage, fromPeerId: string): void {
    switch (message.channel) {
      case 'file-sync':
        this.handlers.onFileSyncMessage?.(message.data, fromPeerId);
        break;
      case 'agent-relay':
        this.handlers.onAgentRelayMessage?.(message.data, fromPeerId);
        break;
      case 'control':
        this.handleControlMessage(message.data, fromPeerId);
        break;
    }
  }

  private handleControlMessage(message: ControlMessage, fromPeerId: string): void {
    switch (message.type) {
      case 'ping':
        this.sendTo(fromPeerId, { channel: 'control', data: { type: 'pong', timestamp: Date.now() } });
        break;
      case 'pong':
        this.lastPongTimes.set(fromPeerId, Date.now());
        break;
    }
  }

  private broadcast(message: RemoteMessage): void {
    const serialized = JSON.stringify(message);
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(serialized);
      }
    }
  }

  private sendTo(peerId: string, message: RemoteMessage): void {
    const conn = this.connections.get(peerId);
    if (conn?.open) {
      conn.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(peerId: string): void {
    this.lastPongTimes.set(peerId, Date.now());

    const interval = setInterval(() => {
      // Send ping
      this.sendTo(peerId, { channel: 'control', data: { type: 'ping', timestamp: Date.now() } });

      // Check for timeout
      const lastPong = this.lastPongTimes.get(peerId) ?? 0;
      if (Date.now() - lastPong > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[MikuPeer] Heartbeat timeout for ${peerId}`);
        const conn = this.connections.get(peerId);
        if (conn) {
          conn.close();
        }
        this.connections.delete(peerId);
        this.stopHeartbeat(peerId);
        this.handlers.onPeerDisconnected?.(peerId);
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatIntervals.set(peerId, interval);
  }

  private stopHeartbeat(peerId: string): void {
    const interval = this.heartbeatIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(peerId);
    }
    this.lastPongTimes.delete(peerId);
  }

  private handleDisconnect(): void {
    if (this._destroyed) return;

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[MikuPeer] Reconnecting (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);

      this.setStatus('connecting');
      setTimeout(() => {
        if (this._destroyed) return;
        this.peer?.reconnect();
      }, delay);
    } else {
      this.setStatus('error', 'Connection lost after max reconnect attempts');
    }
  }

  private setStatus(status: RemoteConnectionStatus, error?: string): void {
    this._status = status;
    this.handlers.onStatusChange?.(status, error);
  }
}
