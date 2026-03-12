'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { isTauri, safeTauriCall } from '@/lib/tauri';
import { invoke } from '@tauri-apps/api/core';

export interface WorkspaceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: WorkspaceFile[];
}

export type RemoteRole = 'host' | 'guest';
export type RemoteSyncStatus = 'connected' | 'disconnected' | 'syncing';

export interface WorkspaceRemoteInfo {
  peerId: string;
  roomCode: string;
  role: RemoteRole;
  status: RemoteSyncStatus;
}

export interface Workspace {
  path: string;
  name: string;
  remote?: WorkspaceRemoteInfo;
}

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  files: WorkspaceFile[];
  envFiles: WorkspaceFile[];
  recentWorkspaces: Workspace[];
  isLoading: boolean;
  remoteStatus: RemoteSyncStatus | null;
}

interface WorkspaceContextType {
  workspace: WorkspaceState;
  selectWorkspace: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  refreshEnvFiles: () => Promise<void>;
  createFile: (name: string, parentPath?: string) => Promise<string | null>;
  createFolder: (name: string, parentPath?: string) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  hasWorkspace: boolean;
  /** Set the remote status for the current workspace */
  setRemoteInfo: (info: WorkspaceRemoteInfo | undefined) => void;
  /** Update just the remote sync status */
  setRemoteStatus: (status: RemoteSyncStatus | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    currentWorkspace: null,
    files: [],
    envFiles: [],
    recentWorkspaces: [],
    isLoading: false,
    remoteStatus: null,
  });

  // Load saved workspace on mount
  useEffect(() => {
    const loadSavedWorkspace = async () => {
      if (!isTauri()) return;

      try {
        const savedWorkspace = await invoke<Workspace | null>('get_current_workspace');
        const recentWorkspaces = await invoke<Workspace[]>('get_recent_workspaces');

        if (savedWorkspace) {
          setWorkspace(prev => ({
            ...prev,
            currentWorkspace: savedWorkspace,
            recentWorkspaces,
          }));

          // Load files for the workspace
          const files = await invoke<WorkspaceFile[]>('list_workspace_files', {
            workspacePath: savedWorkspace.path
          });
          const envFiles = await invoke<WorkspaceFile[]>('list_env_files', {
            workspacePath: savedWorkspace.path
          });
          setWorkspace(prev => ({ ...prev, files, envFiles }));
        } else {
          setWorkspace(prev => ({ ...prev, recentWorkspaces }));
        }
      } catch (error) {
        console.error('Failed to load workspace:', error);
      }
    };

    loadSavedWorkspace();
  }, []);

  const selectWorkspace = useCallback(async () => {
    if (!isTauri()) {
      console.log('Workspace selection not available in browser mode');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Workspace Folder',
      });

      if (!selected) return;

      const workspacePath = selected as string;
      await openWorkspaceInternal(workspacePath);
    } catch (error) {
      console.error('Failed to select workspace:', error);
    }
  }, []);

  const openWorkspaceInternal = async (workspacePath: string) => {
    setWorkspace(prev => ({ ...prev, isLoading: true }));

    try {
      // Save workspace to backend
      await invoke('set_workspace', { path: workspacePath });

      // Get workspace info
      const workspaceInfo = await invoke<Workspace>('get_workspace_info', { path: workspacePath });

      // Load files
      const files = await invoke<WorkspaceFile[]>('list_workspace_files', {
        workspacePath
      });

      // Load env files
      const envFiles = await invoke<WorkspaceFile[]>('list_env_files', {
        workspacePath
      });

      // Get recent workspaces
      const recentWorkspaces = await invoke<Workspace[]>('get_recent_workspaces');

      setWorkspace(prev => ({
        ...prev,
        currentWorkspace: workspaceInfo,
        files,
        envFiles,
        recentWorkspaces,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to open workspace:', error);
      setWorkspace(prev => ({ ...prev, isLoading: false }));
    }
  };

  const openWorkspace = useCallback(async (path: string) => {
    if (!isTauri()) return;
    await openWorkspaceInternal(path);
  }, []);

  const refreshFiles = useCallback(async () => {
    if (!isTauri() || !workspace.currentWorkspace) return;

    try {
      const files = await invoke<WorkspaceFile[]>('list_workspace_files', {
        workspacePath: workspace.currentWorkspace.path
      });
      setWorkspace(prev => ({ ...prev, files }));
    } catch (error) {
      console.error('Failed to refresh files:', error);
    }
  }, [workspace.currentWorkspace]);

  const refreshEnvFiles = useCallback(async () => {
    if (!isTauri() || !workspace.currentWorkspace) return;

    try {
      const envFiles = await invoke<WorkspaceFile[]>('list_env_files', {
        workspacePath: workspace.currentWorkspace.path
      });
      setWorkspace(prev => ({ ...prev, envFiles }));
    } catch (error) {
      console.error('Failed to refresh env files:', error);
    }
  }, [workspace.currentWorkspace]);

  const createFile = useCallback(async (name: string, parentPath?: string): Promise<string | null> => {
    if (!isTauri() || !workspace.currentWorkspace) return null;

    try {
      const basePath = parentPath || workspace.currentWorkspace.path;
      // Add .md extension only if the name has no extension
      // Dotfiles (like .miku-env, .gitignore) and files with extensions should not get .md added
      const hasExtension = name.startsWith('.') || name.includes('.');
      const fileName = hasExtension ? name : `${name}.md`;
      const filePath = await invoke<string>('create_file', {
        basePath,
        name: fileName
      });
      // Refresh the appropriate file list based on file type
      if (fileName.endsWith('.miku-env')) {
        await refreshEnvFiles();
      } else {
        await refreshFiles();
      }
      return filePath;
    } catch (error) {
      console.error('Failed to create file:', error);
      return null;
    }
  }, [workspace.currentWorkspace, refreshFiles, refreshEnvFiles]);

  const createFolder = useCallback(async (name: string, parentPath?: string): Promise<string | null> => {
    if (!isTauri() || !workspace.currentWorkspace) return null;

    try {
      const basePath = parentPath || workspace.currentWorkspace.path;
      const folderPath = await invoke<string>('create_folder', { basePath, name });
      await refreshFiles();
      return folderPath;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return null;
    }
  }, [workspace.currentWorkspace, refreshFiles]);

  const deleteFile = useCallback(async (path: string) => {
    if (!isTauri()) return;

    try {
      await invoke('delete_file', { path });
      await refreshFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, [refreshFiles]);

  const renameFile = useCallback(async (oldPath: string, newName: string) => {
    if (!isTauri()) return;

    try {
      await invoke('rename_file', { oldPath, newName });
      await refreshFiles();
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  }, [refreshFiles]);

  const setRemoteInfo = useCallback((info: WorkspaceRemoteInfo | undefined) => {
    setWorkspace(prev => ({
      ...prev,
      currentWorkspace: prev.currentWorkspace
        ? { ...prev.currentWorkspace, remote: info }
        : prev.currentWorkspace,
      remoteStatus: info?.status ?? null,
    }));
  }, []);

  const setRemoteStatus = useCallback((status: RemoteSyncStatus | null) => {
    setWorkspace(prev => ({
      ...prev,
      remoteStatus: status,
      currentWorkspace: prev.currentWorkspace?.remote
        ? {
            ...prev.currentWorkspace,
            remote: { ...prev.currentWorkspace.remote, status: status ?? 'disconnected' },
          }
        : prev.currentWorkspace,
    }));
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        selectWorkspace,
        openWorkspace,
        refreshFiles,
        refreshEnvFiles,
        createFile,
        createFolder,
        deleteFile,
        renameFile,
        hasWorkspace: workspace.currentWorkspace !== null,
        setRemoteInfo,
        setRemoteStatus,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
