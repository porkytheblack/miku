'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { isTauri } from '@/lib/tauri';
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
  envFiles: WorkspaceFile[];
  recentWorkspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
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
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Please check that the folder is available and try again.';
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    currentWorkspace: null,
    files: [],
    envFiles: [],
    recentWorkspaces: [],
    isLoading: true,
    error: null,
  });
  const navigationVersion = useRef(0);
  const opening = useRef<symbol | null>(null);
  const pendingLoads = useRef(new Set<symbol>());
  const latestFileRefresh = useRef<symbol | null>(null);
  const latestEnvRefresh = useRef<symbol | null>(null);

  const startLoading = useCallback(() => {
    const request = Symbol();
    pendingLoads.current.add(request);
    setWorkspace(prev => ({ ...prev, isLoading: true }));
    return request;
  }, []);

  const finishLoading = useCallback((request: symbol) => {
    // Navigation discards older requests, including their loading indicators.
    if (!pendingLoads.current.delete(request)) return;
    const isLoading = pendingLoads.current.size > 0;
    setWorkspace(prev => ({ ...prev, isLoading }));
  }, []);

  // Load saved state atomically, without letting a late startup response replace
  // a folder the user has already chosen.
  useEffect(() => {
    if (!isTauri()) {
      setWorkspace(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const version = navigationVersion.current;
    const request = startLoading();
    const loads = pendingLoads.current;
    let cancelled = false;

    const loadSavedWorkspace = async () => {
      const [saved, recent] = await Promise.allSettled([
        (async () => {
          const currentWorkspace = await invoke<Workspace | null>('get_current_workspace');
          if (!currentWorkspace) return null;
          const [files, envFiles] = await Promise.all([
            invoke<WorkspaceFile[]>('list_workspace_files', { workspacePath: currentWorkspace.path }),
            invoke<WorkspaceFile[]>('list_env_files', { workspacePath: currentWorkspace.path }),
          ]);
          return { currentWorkspace, files, envFiles };
        })(),
        invoke<Workspace[]>('get_recent_workspaces'),
      ]);

      if (cancelled || navigationVersion.current !== version) return;
      const errors: string[] = [];
      if (saved.status === 'rejected') {
        console.error('Failed to load workspace:', saved.reason);
        errors.push(`Could not load the saved folder: ${errorMessage(saved.reason)}`);
      }
      if (recent.status === 'rejected') {
        console.error('Failed to load recent workspaces:', recent.reason);
        errors.push(`Could not load recent folders: ${errorMessage(recent.reason)}`);
      }
      setWorkspace(prev => ({
        ...prev,
        ...(saved.status === 'fulfilled' && saved.value ? saved.value : {}),
        ...(recent.status === 'fulfilled' ? { recentWorkspaces: recent.value } : {}),
        error: errors.length ? errors.join(' ') : null,
      }));
      finishLoading(request);
    };

    void loadSavedWorkspace();
    return () => {
      cancelled = true;
      navigationVersion.current += 1;
      loads.clear();
      opening.current = null;
    };
  }, [startLoading, finishLoading]);

  const openWorkspaceInternal = useCallback(async (workspacePath: string) => {
    const version = ++navigationVersion.current;
    pendingLoads.current.clear();
    const request = startLoading();
    setWorkspace(prev => ({ ...prev, error: null }));

    try {
      // Listing first validates that the folder exists and is readable. A failed
      // open must not replace the last good workspace in the backend or the UI.
      const [workspaceInfo, files, envFiles] = await Promise.all([
        invoke<Workspace>('get_workspace_info', { path: workspacePath }),
        invoke<WorkspaceFile[]>('list_workspace_files', { workspacePath }),
        invoke<WorkspaceFile[]>('list_env_files', { workspacePath }),
      ]);
      if (navigationVersion.current !== version) return;
      await invoke('set_workspace', { path: workspacePath });
      if (navigationVersion.current !== version) return;

      setWorkspace(prev => ({
        ...prev,
        currentWorkspace: workspaceInfo,
        files,
        envFiles,
        recentWorkspaces: [
          workspaceInfo,
          ...prev.recentWorkspaces.filter(item => item.path !== workspacePath),
        ].slice(0, 10),
      }));

      // Once persistence succeeds the folder is open. A history-read failure
      // must not leave the UI pointing at the previous backend workspace.
      try {
        const recentWorkspaces = await invoke<Workspace[]>('get_recent_workspaces');
        if (navigationVersion.current === version) {
          setWorkspace(prev => ({ ...prev, recentWorkspaces }));
        }
      } catch (error) {
        if (navigationVersion.current === version) {
          console.error('Failed to load recent workspaces:', error);
          setWorkspace(prev => ({
            ...prev,
            error: `Folder opened, but recent folders could not be refreshed: ${errorMessage(error)}`,
          }));
        }
      }
    } catch (error) {
      if (navigationVersion.current === version) {
        console.error('Failed to open workspace:', error);
        setWorkspace(prev => ({
          ...prev,
          error: `Could not open folder: ${errorMessage(error)}`,
        }));
      }
    } finally {
      finishLoading(request);
    }
  }, [startLoading, finishLoading]);

  const selectWorkspace = useCallback(async () => {
    if (!isTauri() || opening.current) return;
    const selection = Symbol();
    opening.current = selection;
    const version = navigationVersion.current;
    const request = startLoading();

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Workspace Folder',
      });
      // Cancellation preserves the current folder, files, history, and error.
      if (typeof selected !== 'string' || navigationVersion.current !== version) return;
      await openWorkspaceInternal(selected);
    } catch (error) {
      if (navigationVersion.current === version) {
        console.error('Failed to select workspace:', error);
        setWorkspace(prev => ({
          ...prev,
          error: `Could not select a folder: ${errorMessage(error)}`,
        }));
      }
    } finally {
      if (opening.current === selection) opening.current = null;
      finishLoading(request);
    }
  }, [openWorkspaceInternal, startLoading, finishLoading]);

  const openWorkspace = useCallback(async (path: string) => {
    if (!isTauri() || opening.current) return;
    const selection = Symbol();
    opening.current = selection;
    try {
      await openWorkspaceInternal(path);
    } finally {
      if (opening.current === selection) opening.current = null;
    }
  }, [openWorkspaceInternal]);

  const refreshFiles = useCallback(async () => {
    if (!isTauri() || !workspace.currentWorkspace || opening.current) return;
    const workspacePath = workspace.currentWorkspace.path;
    const version = navigationVersion.current;
    const request = startLoading();
    latestFileRefresh.current = request;
    setWorkspace(prev => ({ ...prev, error: null }));
    const isCurrent = () => navigationVersion.current === version && latestFileRefresh.current === request;

    try {
      const files = await invoke<WorkspaceFile[]>('list_workspace_files', { workspacePath });
      if (isCurrent()) {
        setWorkspace(prev => prev.currentWorkspace?.path === workspacePath ? { ...prev, files } : prev);
      }
    } catch (error) {
      if (isCurrent()) {
        console.error('Failed to refresh files:', error);
        setWorkspace(prev => prev.currentWorkspace?.path === workspacePath
          ? { ...prev, error: `Could not refresh files: ${errorMessage(error)}` }
          : prev);
      }
    } finally {
      finishLoading(request);
    }
  }, [workspace.currentWorkspace, startLoading, finishLoading]);

  const refreshEnvFiles = useCallback(async () => {
    if (!isTauri() || !workspace.currentWorkspace || opening.current) return;
    const workspacePath = workspace.currentWorkspace.path;
    const version = navigationVersion.current;
    const request = startLoading();
    latestEnvRefresh.current = request;
    setWorkspace(prev => ({ ...prev, error: null }));
    const isCurrent = () => navigationVersion.current === version && latestEnvRefresh.current === request;

    try {
      const envFiles = await invoke<WorkspaceFile[]>('list_env_files', { workspacePath });
      if (isCurrent()) {
        setWorkspace(prev => prev.currentWorkspace?.path === workspacePath ? { ...prev, envFiles } : prev);
      }
    } catch (error) {
      if (isCurrent()) {
        console.error('Failed to refresh env files:', error);
        setWorkspace(prev => prev.currentWorkspace?.path === workspacePath
          ? { ...prev, error: `Could not refresh environment files: ${errorMessage(error)}` }
          : prev);
      }
    } finally {
      finishLoading(request);
    }
  }, [workspace.currentWorkspace, startLoading, finishLoading]);

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
