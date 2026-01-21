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

export interface Workspace {
  path: string;
  name: string;
}

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  files: WorkspaceFile[];
  recentWorkspaces: Workspace[];
  isLoading: boolean;
}

interface WorkspaceContextType {
  workspace: WorkspaceState;
  selectWorkspace: () => Promise<void>;
  openWorkspace: (path: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  createFile: (name: string, parentPath?: string) => Promise<string | null>;
  createFolder: (name: string, parentPath?: string) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  hasWorkspace: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    currentWorkspace: null,
    files: [],
    recentWorkspaces: [],
    isLoading: false,
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
          setWorkspace(prev => ({ ...prev, files }));
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

      // Get recent workspaces
      const recentWorkspaces = await invoke<Workspace[]>('get_recent_workspaces');

      setWorkspace({
        currentWorkspace: workspaceInfo,
        files,
        recentWorkspaces,
        isLoading: false,
      });
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

  const createFile = useCallback(async (name: string, parentPath?: string): Promise<string | null> => {
    if (!isTauri() || !workspace.currentWorkspace) return null;

    try {
      const basePath = parentPath || workspace.currentWorkspace.path;
      const filePath = await invoke<string>('create_file', {
        basePath,
        name: name.endsWith('.md') ? name : `${name}.md`
      });
      await refreshFiles();
      return filePath;
    } catch (error) {
      console.error('Failed to create file:', error);
      return null;
    }
  }, [workspace.currentWorkspace, refreshFiles]);

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

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        selectWorkspace,
        openWorkspace,
        refreshFiles,
        createFile,
        createFolder,
        deleteFile,
        renameFile,
        hasWorkspace: workspace.currentWorkspace !== null,
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
