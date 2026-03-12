/**
 * Miku Remote — File Sync Protocol
 *
 * Handles bidirectional file synchronization between peers over WebRTC data channels.
 * Uses a manifest-based approach for initial sync and event-driven updates for ongoing sync.
 * Conflict resolution: Last-Write-Wins (latest timestamp).
 */

import type { MikuPeer } from './peer';
import type { FileManifestEntry, FileSyncMessage } from './types';
import { FILE_CHUNK_SIZE } from './types';
import { isTauri } from '@/lib/tauri';

// ============================================
// File Sync Manager
// ============================================

export interface FileSyncHandlers {
  /** Called when a remote file is created or updated locally */
  onFileUpdated?: (relativePath: string) => void;
  /** Called when a remote file deletion is applied locally */
  onFileDeleted?: (relativePath: string) => void;
  /** Called when sync status changes */
  onSyncStatusChange?: (status: 'idle' | 'syncing' | 'error', error?: string) => void;
}

export class FileSyncManager {
  private peer: MikuPeer;
  private workspacePath: string;
  private localManifest = new Map<string, FileManifestEntry>();
  private handlers: FileSyncHandlers = {};
  private tauriUnlistener: (() => void) | null = null;
  private chunkBuffers = new Map<string, { chunks: string[]; total: number; modifiedAt: number }>();
  private peerId: string;

  constructor(peer: MikuPeer, workspacePath: string, peerId: string) {
    this.peer = peer;
    this.workspacePath = workspacePath;
    this.peerId = peerId;
  }

  setHandlers(handlers: FileSyncHandlers): void {
    this.handlers = handlers;
  }

  /** Update the peerId (used for LWW tie-breaking). Called after peer connection is established. */
  setPeerId(peerId: string): void {
    this.peerId = peerId;
  }

  /**
   * Start the file sync process. Called after peer connection is established.
   * 1. Build local manifest
   * 2. Send manifest to peer
   * 3. Start watching for local changes
   */
  async start(): Promise<void> {
    this.handlers.onSyncStatusChange?.('syncing');

    try {
      // Build and send local manifest
      await this.buildLocalManifest();
      this.sendManifest();

      // Start watching for local file changes
      await this.startLocalWatcher();

      this.handlers.onSyncStatusChange?.('idle');
    } catch (err) {
      this.handlers.onSyncStatusChange?.('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Handle incoming file sync messages from peer.
   */
  handleMessage(message: FileSyncMessage): void {
    switch (message.type) {
      case 'manifest':
        this.handleRemoteManifest(message.files);
        break;
      case 'request_files':
        this.handleFileRequest(message.paths);
        break;
      case 'file_content':
        this.handleFileContent(message);
        break;
      case 'file_deleted':
        this.handleFileDeleted(message.path, message.deletedAt);
        break;
      case 'file_renamed':
        this.handleFileRenamed(message.oldPath, message.newPath, message.renamedAt);
        break;
    }
  }

  /**
   * Stop file sync and clean up.
   */
  async stop(): Promise<void> {
    if (this.tauriUnlistener) {
      this.tauriUnlistener();
      this.tauriUnlistener = null;
    }

    // Stop the workspace file watcher
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('unwatch_workspace');
      } catch {
        // Ignore errors on cleanup
      }
    }

    this.localManifest.clear();
    this.chunkBuffers.clear();
  }

  /**
   * Notify the peer of a local file change.
   * Called by the workspace watcher when a file is modified locally.
   */
  async notifyFileChanged(relativePath: string, modifiedAt: number): Promise<void> {
    // Update local manifest
    const existing = this.localManifest.get(relativePath);
    if (existing) {
      existing.modifiedAt = modifiedAt;
    }

    // Read and send the file content
    try {
      const content = await this.readFile(relativePath);
      this.sendFileContent(relativePath, content, modifiedAt);
    } catch (err) {
      console.error(`[FileSync] Failed to read changed file ${relativePath}:`, err);
    }
  }

  /**
   * Notify the peer of a local file deletion.
   */
  notifyFileDeleted(relativePath: string): void {
    this.localManifest.delete(relativePath);
    this.peer.sendFileSyncMessage({
      type: 'file_deleted',
      path: relativePath,
      deletedAt: Date.now(),
    });
  }

  /**
   * Notify the peer of a local file rename.
   */
  notifyFileRenamed(oldPath: string, newPath: string): void {
    const entry = this.localManifest.get(oldPath);
    if (entry) {
      this.localManifest.delete(oldPath);
      this.localManifest.set(newPath, { ...entry, path: newPath });
    }

    this.peer.sendFileSyncMessage({
      type: 'file_renamed',
      oldPath,
      newPath,
      renamedAt: Date.now(),
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  private async buildLocalManifest(): Promise<void> {
    if (!isTauri()) return;

    const { invoke } = await import('@tauri-apps/api/core');
    const entries = await invoke<FileManifestEntry[]>('get_workspace_manifest', {
      workspacePath: this.workspacePath,
    });

    this.localManifest.clear();
    for (const entry of entries) {
      this.localManifest.set(entry.path, entry);
    }
  }

  private sendManifest(): void {
    const files = Array.from(this.localManifest.values());
    this.peer.sendFileSyncMessage({ type: 'manifest', files });
  }

  private handleRemoteManifest(remoteFiles: FileManifestEntry[]): void {
    // Compare remote manifest with local and request newer files
    const pathsToRequest: string[] = [];

    for (const remoteFile of remoteFiles) {
      const localFile = this.localManifest.get(remoteFile.path);

      if (!localFile) {
        // File doesn't exist locally — request it
        pathsToRequest.push(remoteFile.path);
      } else if (remoteFile.modifiedAt > localFile.modifiedAt) {
        // Remote is newer — request it
        pathsToRequest.push(remoteFile.path);
      } else if (
        remoteFile.modifiedAt === localFile.modifiedAt &&
        this.peerId > (this.peer.connectedPeers[0]?.peerId ?? '')
      ) {
        // Tie: peer with alphabetically lower ID wins
        pathsToRequest.push(remoteFile.path);
      }
    }

    if (pathsToRequest.length > 0) {
      this.peer.sendFileSyncMessage({ type: 'request_files', paths: pathsToRequest });
    }
  }

  private async handleFileRequest(paths: string[]): Promise<void> {
    for (const relativePath of paths) {
      try {
        const content = await this.readFile(relativePath);
        const entry = this.localManifest.get(relativePath);
        this.sendFileContent(relativePath, content, entry?.modifiedAt ?? Date.now());
      } catch (err) {
        console.error(`[FileSync] Failed to read requested file ${relativePath}:`, err);
      }
    }
  }

  private async handleFileContent(
    message: Extract<FileSyncMessage, { type: 'file_content' }>,
  ): Promise<void> {
    const { path, content, modifiedAt, chunk } = message;

    // Handle chunked transfer
    if (chunk) {
      let buffer = this.chunkBuffers.get(path);
      if (!buffer) {
        buffer = { chunks: new Array(chunk.total).fill(''), total: chunk.total, modifiedAt };
        this.chunkBuffers.set(path, buffer);
      }
      buffer.chunks[chunk.index] = content;

      // Check if all chunks received
      const received = buffer.chunks.filter(c => c !== '').length;
      if (received < buffer.total) return;

      // Reassemble
      const fullContent = buffer.chunks.join('');
      this.chunkBuffers.delete(path);
      await this.applyRemoteFile(path, fullContent, buffer.modifiedAt);
    } else {
      await this.applyRemoteFile(path, content, modifiedAt);
    }
  }

  private async applyRemoteFile(relativePath: string, content: string, remoteModifiedAt: number): Promise<void> {
    // LWW check: only apply if remote is newer
    const localEntry = this.localManifest.get(relativePath);
    if (localEntry && localEntry.modifiedAt > remoteModifiedAt) {
      return; // Local is newer, skip
    }

    // Tie-breaking by peer ID
    if (localEntry && localEntry.modifiedAt === remoteModifiedAt) {
      const remotePeerId = this.peer.connectedPeers[0]?.peerId ?? '';
      if (this.peerId < remotePeerId) {
        return; // We win the tie
      }
    }

    try {
      await this.writeFile(relativePath, content);

      // Update local manifest
      this.localManifest.set(relativePath, {
        path: relativePath,
        size: new Blob([content]).size,
        modifiedAt: remoteModifiedAt,
      });

      this.handlers.onFileUpdated?.(relativePath);
    } catch (err) {
      console.error(`[FileSync] Failed to write remote file ${relativePath}:`, err);
    }
  }

  private async handleFileDeleted(relativePath: string, deletedAt: number): Promise<void> {
    const localEntry = this.localManifest.get(relativePath);

    // Only delete if the deletion is newer than our local version
    if (localEntry && localEntry.modifiedAt > deletedAt) {
      return; // Our local file is newer than the delete event
    }

    try {
      const fullPath = `${this.workspacePath}/${relativePath}`;
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_file', { path: fullPath });
      }
      this.localManifest.delete(relativePath);
      this.handlers.onFileDeleted?.(relativePath);
    } catch (err) {
      console.error(`[FileSync] Failed to delete file ${relativePath}:`, err);
    }
  }

  private async handleFileRenamed(oldPath: string, newPath: string, renamedAt: number): Promise<void> {
    const localEntry = this.localManifest.get(oldPath);
    if (localEntry && localEntry.modifiedAt > renamedAt) {
      return; // Local is newer
    }

    try {
      const newName = newPath.split('/').pop() ?? newPath;
      const fullOldPath = `${this.workspacePath}/${oldPath}`;

      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('rename_file', { oldPath: fullOldPath, newName });
      }

      if (localEntry) {
        this.localManifest.delete(oldPath);
        this.localManifest.set(newPath, { ...localEntry, path: newPath });
      }
    } catch (err) {
      console.error(`[FileSync] Failed to rename file ${oldPath} -> ${newPath}:`, err);
    }
  }

  private sendFileContent(relativePath: string, content: string, modifiedAt: number): void {
    const size = new Blob([content]).size;

    if (size <= FILE_CHUNK_SIZE) {
      this.peer.sendFileSyncMessage({
        type: 'file_content',
        path: relativePath,
        content,
        modifiedAt,
      });
    } else {
      // Send in chunks
      const totalChunks = Math.ceil(content.length / FILE_CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunkContent = content.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE);
        this.peer.sendFileSyncMessage({
          type: 'file_content',
          path: relativePath,
          content: chunkContent,
          modifiedAt,
          chunk: { index: i, total: totalChunks },
        });
      }
    }
  }

  private async readFile(relativePath: string): Promise<string> {
    const fullPath = `${this.workspacePath}/${relativePath}`;

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const doc = await invoke<{ content: string }>('open_file', { path: fullPath });
      return doc.content;
    }

    throw new Error('File reading not available outside Tauri');
  }

  private async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = `${this.workspacePath}/${relativePath}`;

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');

      // Ensure parent directory exists (only if the file is in a subdirectory)
      const lastSlash = relativePath.lastIndexOf('/');
      if (lastSlash > 0) {
        const parentDir = relativePath.substring(0, lastSlash);
        await invoke('create_folder', {
          basePath: this.workspacePath,
          name: parentDir,
        });
      }

      await invoke('save_file', { path: fullPath, content });
    }
  }

  private async startLocalWatcher(): Promise<void> {
    if (!isTauri()) return;

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    // Start the Rust file watcher
    await invoke('watch_workspace', { path: this.workspacePath });

    // Listen for file change events
    this.tauriUnlistener = await listen<{
      path: string;
      eventType: string;
      modifiedAt: number;
    }>('workspace:file_changed', (event) => {
      const { path: relativePath, eventType, modifiedAt } = event.payload;

      switch (eventType) {
        case 'create':
        case 'modify':
          this.notifyFileChanged(relativePath, modifiedAt);
          break;
        case 'delete':
          this.notifyFileDeleted(relativePath);
          break;
      }
    });
  }
}
