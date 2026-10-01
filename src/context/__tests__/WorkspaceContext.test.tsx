import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceProvider, useWorkspace, type Workspace, type WorkspaceFile } from '../WorkspaceContext';

const { invokeMock, openDialogMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openDialogMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openDialogMock }));
vi.mock('@/lib/tauri', () => ({ isTauri: isTauriMock }));

const alpha: Workspace = { path: '/folders/alpha', name: 'alpha' };
const beta: Workspace = { path: '/folders/beta', name: 'beta' };
const alphaFiles: WorkspaceFile[] = [{ name: 'alpha.md', path: `${alpha.path}/alpha.md`, isDirectory: false }];
const betaFiles: WorkspaceFile[] = [{ name: 'beta.md', path: `${beta.path}/beta.md`, isDirectory: false }];
const alphaEnv: WorkspaceFile[] = [{ name: 'alpha.miku-env', path: `${alpha.path}/alpha.miku-env`, isDirectory: false }];
const betaEnv: WorkspaceFile[] = [{ name: 'beta.miku-env', path: `${beta.path}/beta.miku-env`, isDirectory: false }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let savedWorkspace: Workspace | null;
let recentWorkspaces: Workspace[];

async function respond(command: string, args?: Record<string, unknown>): Promise<unknown> {
  switch (command) {
    case 'get_current_workspace': return savedWorkspace;
    case 'get_recent_workspaces': return recentWorkspaces;
    case 'get_workspace_info': return args?.path === beta.path ? beta : alpha;
    case 'list_workspace_files': return args?.workspacePath === beta.path ? betaFiles : alphaFiles;
    case 'list_env_files': return args?.workspacePath === beta.path ? betaEnv : alphaEnv;
    case 'set_workspace': {
      savedWorkspace = args?.path === beta.path ? beta : alpha;
      recentWorkspaces = [savedWorkspace, ...recentWorkspaces.filter(item => item.path !== savedWorkspace?.path)];
      return;
    }
    default: throw new Error(`Unexpected command: ${command}`);
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

async function renderLoadedWorkspace() {
  const hook = renderHook(useWorkspace, { wrapper });
  await waitFor(() => expect(hook.result.current.workspace.isLoading).toBe(false));
  return hook;
}

beforeEach(() => {
  vi.resetAllMocks();
  savedWorkspace = alpha;
  recentWorkspaces = [alpha, beta];
  isTauriMock.mockReturnValue(true);
  openDialogMock.mockResolvedValue(null);
  invokeMock.mockImplementation(respond);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WorkspaceProvider', () => {
  it('keeps startup loading until saved files and recent folders are ready', async () => {
    const files = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files'
      ? files.promise
      : respond(command, args));
    const { result } = renderHook(useWorkspace, { wrapper });

    expect(result.current.workspace.isLoading).toBe(true);
    expect(result.current.workspace.currentWorkspace).toBeNull();
    await act(async () => { files.resolve(alphaFiles); });

    await waitFor(() => expect(result.current.workspace.isLoading).toBe(false));
    expect(result.current.workspace).toEqual({
      currentWorkspace: alpha,
      files: alphaFiles,
      envFiles: alphaEnv,
      recentWorkspaces: [alpha, beta],
      isLoading: false,
      error: null,
    });
  });

  it('loads recent folders even when no workspace was saved', async () => {
    savedWorkspace = null;
    const { result } = await renderLoadedWorkspace();

    expect(result.current.hasWorkspace).toBe(false);
    expect(result.current.workspace.recentWorkspaces).toEqual([alpha, beta]);
    expect(invokeMock).not.toHaveBeenCalledWith('list_workspace_files', expect.anything());
  });

  it('shows a startup error and still exposes available recent folders', async () => {
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files'
      ? Promise.reject(new Error('Folder is unavailable'))
      : respond(command, args));
    const { result } = await renderLoadedWorkspace();

    expect(result.current.workspace.currentWorkspace).toBeNull();
    expect(result.current.workspace.files).toEqual([]);
    expect(result.current.workspace.recentWorkspaces).toEqual([alpha, beta]);
    expect(result.current.workspace.error).toContain('Folder is unavailable');
  });

  it('settles without invoking native commands in a browser', async () => {
    isTauriMock.mockReturnValue(false);
    const { result } = await renderLoadedWorkspace();
    await act(async () => {
      await result.current.selectWorkspace();
      await result.current.openWorkspace(beta.path);
      await result.current.refreshFiles();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(openDialogMock).not.toHaveBeenCalled();
    expect(result.current.workspace.error).toBeNull();
  });

  it('validates and lists a recent folder before persisting the successful open', async () => {
    const { result } = await renderLoadedWorkspace();
    const files = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files' && args?.workspacePath === beta.path
      ? files.promise
      : respond(command, args));
    let opening!: Promise<void>;
    act(() => { opening = result.current.openWorkspace(beta.path); });

    expect(result.current.workspace.isLoading).toBe(true);
    expect(result.current.workspace.currentWorkspace).toEqual(alpha);
    expect(invokeMock).not.toHaveBeenCalledWith('set_workspace', expect.anything());
    await act(async () => { files.resolve(betaFiles); await opening; });

    expect(result.current.workspace).toEqual({
      currentWorkspace: beta,
      files: betaFiles,
      envFiles: betaEnv,
      recentWorkspaces: [beta, alpha],
      isLoading: false,
      error: null,
    });
    expect(invokeMock).toHaveBeenCalledWith('set_workspace', { path: beta.path });
  });

  it('preserves the last good folder and history when opening a recent folder fails', async () => {
    const { result } = await renderLoadedWorkspace();
    const before = result.current.workspace;
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files' && args?.workspacePath === beta.path
      ? Promise.reject('Permission denied')
      : respond(command, args));

    await act(async () => { await result.current.openWorkspace(beta.path); });

    expect(result.current.workspace).toEqual({ ...before, error: 'Could not open folder: Permission denied' });
    expect(invokeMock).not.toHaveBeenCalledWith('set_workspace', expect.anything());
    expect(savedWorkspace).toEqual(alpha);

    invokeMock.mockImplementation(respond);
    await act(async () => { await result.current.openWorkspace(beta.path); });
    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(result.current.workspace.error).toBeNull();
  });

  it('preserves the old workspace when saving the new folder fails', async () => {
    const { result } = await renderLoadedWorkspace();
    const before = result.current.workspace;
    invokeMock.mockImplementation((command, args) => command === 'set_workspace'
      ? Promise.reject(new Error('Could not save settings'))
      : respond(command, args));

    await act(async () => { await result.current.openWorkspace(beta.path); });

    expect(result.current.workspace).toEqual({ ...before, error: 'Could not open folder: Could not save settings' });
  });

  it('keeps a successfully persisted folder open if updating recent history fails', async () => {
    const { result } = await renderLoadedWorkspace();
    invokeMock.mockImplementation((command, args) => command === 'get_recent_workspaces'
      ? Promise.reject('History unavailable')
      : respond(command, args));

    await act(async () => { await result.current.openWorkspace(beta.path); });

    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(result.current.workspace.files).toEqual(betaFiles);
    expect(result.current.workspace.recentWorkspaces).toEqual([beta, alpha]);
    expect(result.current.workspace.isLoading).toBe(false);
    expect(result.current.workspace.error).toContain('Folder opened, but recent folders could not be refreshed');
  });

  it('leaves folder state and an existing error intact when the native chooser is canceled', async () => {
    const { result } = await renderLoadedWorkspace();
    invokeMock.mockImplementation((command, args) => command === 'get_workspace_info'
      ? Promise.reject('Folder is unavailable')
      : respond(command, args));
    await act(async () => { await result.current.openWorkspace(beta.path); });
    const before = result.current.workspace;
    invokeMock.mockClear();

    await act(async () => { await result.current.selectWorkspace(); });

    expect(result.current.workspace).toEqual(before);
    expect(openDialogMock).toHaveBeenCalledWith({ directory: true, multiple: false, title: 'Select Workspace Folder' });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('ignores repeated native chooser and recent-open clicks while a chooser is pending', async () => {
    const { result } = await renderLoadedWorkspace();
    const dialog = deferred<string | null>();
    openDialogMock.mockReturnValue(dialog.promise);
    let selection!: Promise<void>;
    act(() => {
      selection = result.current.selectWorkspace();
      void result.current.selectWorkspace();
      void result.current.openWorkspace(beta.path);
    });
    await waitFor(() => expect(openDialogMock).toHaveBeenCalledTimes(1));
    expect(result.current.workspace.isLoading).toBe(true);
    expect(invokeMock).not.toHaveBeenCalledWith('set_workspace', expect.anything());

    await act(async () => { dialog.resolve(beta.path); await selection; });

    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(result.current.workspace.isLoading).toBe(false);
    expect(invokeMock.mock.calls.filter(([command]) => command === 'set_workspace')).toHaveLength(1);
  });

  it('ignores repeated recent-open and chooser clicks until the first open finishes', async () => {
    const { result } = await renderLoadedWorkspace();
    const files = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files' && args?.workspacePath === beta.path
      ? files.promise
      : respond(command, args));
    let opening!: Promise<void>;
    act(() => {
      opening = result.current.openWorkspace(beta.path);
      void result.current.openWorkspace(beta.path);
      void result.current.openWorkspace(alpha.path);
      void result.current.selectWorkspace();
    });
    expect(invokeMock.mock.calls.filter(([command, args]) => command === 'list_workspace_files' && args.workspacePath === beta.path)).toHaveLength(1);
    expect(openDialogMock).not.toHaveBeenCalled();

    await act(async () => { files.resolve(betaFiles); await opening; });

    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(invokeMock.mock.calls.filter(([command]) => command === 'set_workspace')).toHaveLength(1);
  });

  it('does not let late saved-folder startup responses replace a newly opened folder', async () => {
    const startup = deferred<Workspace | null>();
    invokeMock.mockImplementation((command, args) => command === 'get_current_workspace'
      ? startup.promise
      : respond(command, args));
    const { result } = renderHook(useWorkspace, { wrapper });
    await act(async () => { await result.current.openWorkspace(beta.path); });
    expect(result.current.workspace.isLoading).toBe(false);

    await act(async () => { startup.resolve(alpha); await startup.promise; });

    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(result.current.workspace.files).toEqual(betaFiles);
    expect(result.current.workspace.envFiles).toEqual(betaEnv);
    expect(result.current.workspace.recentWorkspaces).toEqual([beta, alpha]);
    expect(result.current.workspace.error).toBeNull();
  });

  it.each(['list_workspace_files', 'list_env_files'] as const)('ignores a stale %s refresh after navigating to another folder', async (commandToDelay) => {
    const { result } = await renderLoadedWorkspace();
    const refresh = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === commandToDelay && args?.workspacePath === alpha.path
      ? refresh.promise
      : respond(command, args));
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = commandToDelay === 'list_workspace_files' ? result.current.refreshFiles() : result.current.refreshEnvFiles();
    });
    expect(result.current.workspace.isLoading).toBe(true);
    await act(async () => { await result.current.openWorkspace(beta.path); });
    expect(result.current.workspace.isLoading).toBe(false);
    await act(async () => { refresh.resolve(alphaFiles); await refreshing; });

    expect(result.current.workspace.files).toEqual(betaFiles);
    expect(result.current.workspace.envFiles).toEqual(betaEnv);
    expect(result.current.workspace.error).toBeNull();
  });

  it('ignores an old refresh error and loading completion while a newer folder is opening', async () => {
    const { result } = await renderLoadedWorkspace();
    const oldRefresh = deferred<WorkspaceFile[]>();
    const newFiles = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files'
      ? args?.workspacePath === alpha.path ? oldRefresh.promise : newFiles.promise
      : respond(command, args));
    let refreshing!: Promise<void>;
    let opening!: Promise<void>;
    act(() => { refreshing = result.current.refreshFiles(); });
    act(() => { opening = result.current.openWorkspace(beta.path); });

    await act(async () => { oldRefresh.reject('Old folder disappeared'); await refreshing; });
    expect(result.current.workspace.isLoading).toBe(true);
    expect(result.current.workspace.error).toBeNull();
    await act(async () => { newFiles.resolve(betaFiles); await opening; });
    expect(result.current.workspace.currentWorkspace).toEqual(beta);
    expect(result.current.workspace.isLoading).toBe(false);
  });

  it('reports a refresh failure without discarding the existing files', async () => {
    const { result } = await renderLoadedWorkspace();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files'
      ? Promise.reject('Drive disconnected')
      : respond(command, args));

    await act(async () => { await result.current.refreshFiles(); });

    expect(result.current.workspace.files).toEqual(alphaFiles);
    expect(result.current.workspace.currentWorkspace).toEqual(alpha);
    expect(result.current.workspace.isLoading).toBe(false);
    expect(result.current.workspace.error).toContain('Drive disconnected');
  });

  it('tracks simultaneous file and environment refreshes until both settle', async () => {
    const { result } = await renderLoadedWorkspace();
    const files = deferred<WorkspaceFile[]>();
    const env = deferred<WorkspaceFile[]>();
    invokeMock.mockImplementation((command, args) => command === 'list_workspace_files'
      ? files.promise
      : command === 'list_env_files' ? env.promise : respond(command, args));
    let fileRefresh!: Promise<void>;
    let envRefresh!: Promise<void>;
    act(() => {
      fileRefresh = result.current.refreshFiles();
      envRefresh = result.current.refreshEnvFiles();
    });
    await act(async () => { files.resolve([]); await fileRefresh; });
    expect(result.current.workspace.isLoading).toBe(true);
    await act(async () => { env.resolve([]); await envRefresh; });
    expect(result.current.workspace.isLoading).toBe(false);
    expect(result.current.workspace.files).toEqual([]);
    expect(result.current.workspace.envFiles).toEqual([]);
  });

  it('loads correctly when React Strict Mode replays the startup effect', async () => {
    const { result } = renderHook(useWorkspace, {
      wrapper: ({ children }) => <StrictMode><WorkspaceProvider>{children}</WorkspaceProvider></StrictMode>,
    });
    await waitFor(() => expect(result.current.workspace.isLoading).toBe(false));
    expect(result.current.workspace.currentWorkspace).toEqual(alpha);
    expect(result.current.workspace.files).toEqual(alphaFiles);
    expect(result.current.workspace.error).toBeNull();
  });
});
