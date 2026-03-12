/**
 * Miku Remote — Remote Workspace Manager
 *
 * Bridges the MikuPeer file-sync channel with workspace file operations.
 * Coordinates between the peer connection, file sync manager, and workspace context.
 */

import { MikuPeer } from './peer';
import { FileSyncManager, type FileSyncHandlers } from './fileSync';
import type { FileSyncMessage } from './types';

export interface RemoteWorkspaceHandlers extends FileSyncHandlers {
  /** Called when workspace file list should be refreshed */
  onRefreshFiles?: () => void;
}

export class RemoteWorkspaceManager {
  private peer: MikuPeer;
  private fileSync: FileSyncManager;
  private handlers: RemoteWorkspaceHandlers = {};
  private started = false;

  constructor(peer: MikuPeer, workspacePath: string, peerId: string) {
    this.peer = peer;
    this.fileSync = new FileSyncManager(peer, workspacePath, peerId);
  }

  setHandlers(handlers: RemoteWorkspaceHandlers): void {
    this.handlers = handlers;
    this.fileSync.setHandlers({
      onFileUpdated: (path) => {
        handlers.onFileUpdated?.(path);
        handlers.onRefreshFiles?.();
      },
      onFileDeleted: (path) => {
        handlers.onFileDeleted?.(path);
        handlers.onRefreshFiles?.();
      },
      onSyncStatusChange: handlers.onSyncStatusChange,
    });
  }

  /**
   * Start the remote workspace sync.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Wire up the peer's file sync messages to our file sync manager
    this.peer.setHandlers({
      ...this.peer['handlers'], // Preserve existing handlers
      onFileSyncMessage: (message: FileSyncMessage) => {
        this.fileSync.handleMessage(message);
      },
    });

    await this.fileSync.start();
  }

  /**
   * Stop the remote workspace sync.
   */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.fileSync.stop();
  }

  /**
   * Get the underlying file sync manager for direct access.
   */
  getFileSync(): FileSyncManager {
    return this.fileSync;
  }

  get isActive(): boolean {
    return this.started;
  }
}
