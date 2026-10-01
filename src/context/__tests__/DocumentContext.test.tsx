import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentProvider, useDocument } from '../DocumentContext';

const native = vi.hoisted(() => ({
  isTauri: vi.fn(),
  openFile: vi.fn(),
  saveFile: vi.fn(),
  addRecentFile: vi.fn(),
  getRecentFiles: vi.fn(),
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  openDialog: vi.fn(),
  listen: vi.fn(),
}));

vi.mock('@/lib/tauri', () => ({
  ...native,
  safeTauriCall: async (operation: () => Promise<unknown>, fallback: unknown) => {
    try { return await operation(); } catch { return fallback; }
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: native.openDialog, save: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderDocument() {
  return renderHook(() => useDocument(), { wrapper: DocumentProvider });
}

beforeEach(() => {
  vi.resetAllMocks();
  native.isTauri.mockReturnValue(true);
  native.loadSession.mockResolvedValue(null);
  native.saveSession.mockResolvedValue(undefined);
  native.openFile.mockImplementation(async (path: string) => ({ path, content: `Content of ${path}` }));
  native.addRecentFile.mockResolvedValue(undefined);
  native.getRecentFiles.mockResolvedValue([]);
  native.openDialog.mockResolvedValue(null);
  native.listen.mockResolvedValue(vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Home document navigation', () => {
  it('starts on Home and restores a persisted active tab without opening its editor', async () => {
    native.loadSession.mockResolvedValue({
      tabs: [{ path: '/notes/first.md', content: 'Old content' }, { path: null, content: 'Saved draft' }],
      active_index: 1,
    });
    const { result } = renderDocument();
    expect(result.current.isHome).toBe(true);

    await waitFor(() => expect(result.current.openDocuments).toHaveLength(2));
    expect(result.current.isHome).toBe(true);
    expect(result.current.document.content).toBe('Saved draft');
    expect(result.current.openDocuments[0].content).toBe('Content of /notes/first.md');

    act(() => result.current.switchToDocument(result.current.activeDocumentId!));
    expect(result.current.isHome).toBe(false);
    expect(result.current.document.content).toBe('Saved draft');
  });

  it('does not overwrite a newly edited document with a delayed persisted session', async () => {
    const savedSession = deferred<{ tabs: { path: null; content: string }[]; active_index: number }>();
    native.loadSession.mockReturnValue(savedSession.promise);
    const { result } = renderDocument();
    act(() => result.current.newDoc());
    const newId = result.current.activeDocumentId;
    act(() => result.current.setContent('Typed before restoration completed'));
    await act(async () => {
      savedSession.resolve({ tabs: [{ path: null, content: 'Old session' }], active_index: 0 });
      await savedSession.promise;
    });
    expect(result.current.activeDocumentId).toBe(newId);
    expect(result.current.isHome).toBe(false);
    expect(result.current.document.content).toBe('Typed before restoration completed');
    expect(result.current.openDocuments.some(doc => doc.content === 'Old session')).toBe(true);
  });

  it('does not persist the initial blank tab before a slow session restore completes', async () => {
    vi.useFakeTimers();
    const savedSession = deferred<{ tabs: { path: null; content: string }[]; active_index: number }>();
    native.loadSession.mockReturnValue(savedSession.promise);
    renderDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    act(() => window.dispatchEvent(new Event('beforeunload')));
    expect(native.saveSession).not.toHaveBeenCalled();

    await act(async () => {
      savedSession.resolve({ tabs: [{ path: null, content: 'Recovered draft' }], active_index: 0 });
      await savedSession.promise;
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(native.saveSession).toHaveBeenCalledWith({
      tabs: [{ path: null, content: 'Recovered draft' }], active_index: 0,
    });
  });

  it('retains recovered unsaved drafts if Home is chosen before restoration completes', async () => {
    const savedSession = deferred<{ tabs: { path: null; content: string }[]; active_index: number }>();
    native.loadSession.mockReturnValue(savedSession.promise);
    const { result } = renderDocument();
    const currentId = result.current.activeDocumentId;
    act(() => result.current.showHome());
    await act(async () => {
      savedSession.resolve({ tabs: [{ path: null, content: 'Recovered draft' }], active_index: 0 });
      await savedSession.promise;
    });
    expect(result.current.isHome).toBe(true);
    expect(result.current.activeDocumentId).toBe(currentId);
    expect(result.current.openDocuments.some(doc => doc.content === 'Recovered draft')).toBe(true);
  });

  it('deduplicates a file restored while the same explicit file open is still reading', async () => {
    const savedSession = deferred<{ tabs: { path: string; content: string }[]; active_index: number }>();
    const userRead = deferred<{ path: string; content: string }>();
    native.loadSession.mockReturnValue(savedSession.promise);
    native.openFile.mockReturnValueOnce(userRead.promise).mockResolvedValue({ path: '/notes/race.md', content: 'Restored content' });
    const { result } = renderDocument();
    let opening!: Promise<void>;
    act(() => { opening = result.current.openDocument('/notes/race.md'); });
    await act(async () => {
      savedSession.resolve({ tabs: [{ path: '/notes/race.md', content: 'Previous session' }], active_index: 0 });
      await savedSession.promise;
    });
    await act(async () => {
      userRead.resolve({ path: '/notes/race.md', content: 'Explicitly opened content' });
      await opening;
    });
    expect(result.current.openDocuments.filter(doc => doc.path === '/notes/race.md')).toHaveLength(1);
    expect(result.current.document.path).toBe('/notes/race.md');
    expect(result.current.isHome).toBe(false);
  });

  it('preserves an unsaved editor buffer when returning from Home to the same tab', () => {
    const { result } = renderDocument();
    const initialId = result.current.activeDocumentId!;
    act(() => result.current.switchToDocument(initialId));
    act(() => result.current.registerContentGetter(() => 'Unsaved editor buffer'));

    act(() => result.current.showHome());
    expect(result.current.isHome).toBe(true);
    expect(result.current.activeDocumentId).toBe(initialId);
    act(() => result.current.switchToDocument(initialId));

    expect(result.current.isHome).toBe(false);
    expect(result.current.document.content).toBe('Unsaved editor buffer');
    expect(result.current.document.isModified).toBe(true);
    expect(result.current.openDocuments).toHaveLength(1);
  });

  it('preserves both tab buffers when Home resumes a different open document', () => {
    const { result } = renderDocument();
    const firstId = result.current.activeDocumentId!;
    let buffer = 'First unsaved buffer';
    act(() => result.current.registerContentGetter(() => buffer));
    act(() => result.current.newDoc());
    const secondId = result.current.activeDocumentId!;
    buffer = 'Second unsaved buffer';
    act(() => result.current.registerContentGetter(() => buffer));
    act(() => result.current.showHome());
    act(() => result.current.switchToDocument(firstId));

    expect(result.current.document.content).toBe('First unsaved buffer');
    expect(result.current.openDocuments.find(doc => doc.id === secondId)?.content).toBe('Second unsaved buffer');
    buffer = result.current.document.content;
    act(() => result.current.registerContentGetter(() => buffer));
    act(() => result.current.showHome());
    act(() => result.current.switchToDocument(secondId));
    expect(result.current.document.content).toBe('Second unsaved buffer');
    expect(result.current.document.isModified).toBe(true);
  });

  it('opens a new empty document from Home without discarding the existing buffer', () => {
    const { result } = renderDocument();
    const previousId = result.current.activeDocumentId;
    act(() => result.current.registerContentGetter(() => 'Keep my draft'));
    act(() => result.current.newDoc());

    expect(result.current.isHome).toBe(false);
    expect(result.current.activeDocumentId).not.toBe(previousId);
    expect(result.current.document.content).toBe('');
    expect(result.current.openDocuments.find(doc => doc.id === previousId)).toMatchObject({ content: 'Keep my draft', isModified: true });
  });

  it('opens a selected file and leaves Home only after the read succeeds', async () => {
    const read = deferred<{ path: string; content: string }>();
    native.openDialog.mockResolvedValue('/notes/picked.md');
    native.openFile.mockReturnValue(read.promise);
    const { result } = renderDocument();
    let opening!: Promise<void>;
    act(() => { opening = result.current.openDocument(); });

    await waitFor(() => expect(native.openFile).toHaveBeenCalledWith('/notes/picked.md'));
    expect(result.current.isHome).toBe(true);
    expect(result.current.isOpeningDocument).toBe(true);
    await act(async () => {
      read.resolve({ path: '/notes/picked.md', content: '# Picked' });
      await opening;
    });
    expect(result.current.isHome).toBe(false);
    expect(result.current.isOpeningDocument).toBe(false);
    expect(result.current.document).toMatchObject({ path: '/notes/picked.md', content: '# Picked', isModified: false });
    expect(native.addRecentFile).toHaveBeenCalledWith('/notes/picked.md');
  });

  it('leaves Home and its tabs unchanged when the file picker is canceled', async () => {
    const { result } = renderDocument();
    const originalId = result.current.activeDocumentId;
    await act(async () => { await result.current.openDocument(); });
    expect(native.openFile).not.toHaveBeenCalled();
    expect(result.current.isHome).toBe(true);
    expect(result.current.isOpeningDocument).toBe(false);
    expect(result.current.documentError).toBeNull();
    expect(result.current.activeDocumentId).toBe(originalId);
    expect(result.current.openDocuments).toHaveLength(1);
  });

  it.each(['picker', 'read'])('leaves Home intact and reports a failed %s', async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    if (failure === 'picker') native.openDialog.mockRejectedValue(new Error('Dialog unavailable'));
    else native.openFile.mockRejectedValue(new Error('File missing'));
    const { result } = renderDocument();
    await act(async () => { await result.current.openDocument(failure === 'read' ? '/missing.md' : undefined); });
    expect(result.current.isHome).toBe(true);
    expect(result.current.isOpeningDocument).toBe(false);
    expect(result.current.documentError).toMatch(/Could not open/);
    expect(result.current.openDocuments).toHaveLength(1);
  });

  it('reuses an already open file without creating a duplicate tab or reading again', async () => {
    const { result } = renderDocument();
    await act(async () => { await result.current.openDocument('/notes/existing.md'); });
    const fileId = result.current.activeDocumentId;
    act(() => result.current.showHome());
    await act(async () => { await result.current.openDocument('/notes/existing.md'); });
    expect(result.current.isHome).toBe(false);
    expect(result.current.activeDocumentId).toBe(fileId);
    expect(result.current.openDocuments.filter(doc => doc.path === '/notes/existing.md')).toHaveLength(1);
    expect(native.openFile).toHaveBeenCalledTimes(1);
  });

  it('preserves a live unsaved buffer when Home opens a different file', async () => {
    const { result } = renderDocument();
    const draftId = result.current.activeDocumentId;
    act(() => result.current.registerContentGetter(() => 'Newest editor-only draft'));
    act(() => result.current.showHome());
    await act(async () => { await result.current.openDocument('/notes/new-file.md'); });
    expect(result.current.openDocuments.find(doc => doc.id === draftId)).toMatchObject({
      content: 'Newest editor-only draft', isModified: true,
    });
    expect(result.current.document.path).toBe('/notes/new-file.md');
  });

  it('ignores duplicate open requests while a file read is pending', async () => {
    const read = deferred<{ path: string; content: string }>();
    native.openFile.mockReturnValue(read.promise);
    const { result } = renderDocument();
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.openDocument('/notes/slow.md');
      second = result.current.openDocument('/notes/slow.md');
    });
    expect(native.openFile).toHaveBeenCalledTimes(1);
    await act(async () => {
      read.resolve({ path: '/notes/slow.md', content: 'Slow file' });
      await Promise.all([first, second]);
    });
    expect(result.current.openDocuments.filter(doc => doc.path === '/notes/slow.md')).toHaveLength(1);
    expect(result.current.isOpeningDocument).toBe(false);
  });

  it.each([false, true])('opens distinct queued file paths without losing a request (newer Home: %s)', async (returnHome) => {
    const read = deferred<{ path: string; content: string }>();
    native.openFile.mockImplementation(async (path: string) => path === '/notes/first.md'
      ? read.promise : { path, content: 'Second file' });
    const { result } = renderDocument();
    const previousId = result.current.activeDocumentId;
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.openDocument('/notes/first.md');
      second = result.current.openDocument('/notes/second.md');
    });
    if (returnHome) act(() => result.current.showHome());
    await act(async () => {
      read.resolve({ path: '/notes/first.md', content: 'First file' });
      await Promise.all([first, second]);
    });
    expect(native.openFile).toHaveBeenCalledTimes(2);
    expect(result.current.openDocuments.filter(doc => doc.path)).toHaveLength(2);
    expect(result.current.isHome).toBe(returnHome);
    if (returnHome) expect(result.current.activeDocumentId).toBe(previousId);
    else expect(result.current.document.path).toBe('/notes/second.md');
    expect(result.current.isOpeningDocument).toBe(false);
  });

  it('does not apply another editor’s stale buffer to a document without a registered getter', async () => {
    const { result } = renderDocument();
    act(() => result.current.registerContentGetter(() => 'Markdown buffer'));
    await act(async () => { await result.current.openDocument('/notes/agent.miku'); });
    act(() => result.current.showHome());
    const agent = result.current.openDocuments.find(doc => doc.path === '/notes/agent.miku');
    expect(agent?.content).toBe('Content of /notes/agent.miku');
    expect(agent?.isModified).toBe(false);
  });

  it('does not let a late successful file read undo newer Home navigation', async () => {
    const read = deferred<{ path: string; content: string }>();
    native.openFile.mockReturnValue(read.promise);
    const { result } = renderDocument();
    const previousId = result.current.activeDocumentId;
    let opening!: Promise<void>;
    act(() => { opening = result.current.openDocument('/notes/slow.md'); });
    act(() => result.current.showHome());
    await act(async () => {
      read.resolve({ path: '/notes/slow.md', content: 'Slow file' });
      await opening;
    });
    expect(result.current.isHome).toBe(true);
    expect(result.current.activeDocumentId).toBe(previousId);
    expect(result.current.openDocuments.some(doc => doc.path === '/notes/slow.md')).toBe(true);
  });

  it('does not surface an obsolete error after newer Home navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const read = deferred<{ path: string; content: string }>();
    native.openFile.mockReturnValue(read.promise);
    const { result } = renderDocument();
    let opening!: Promise<void>;
    act(() => { opening = result.current.openDocument('/notes/slow.md'); });
    act(() => result.current.showHome());
    await act(async () => { read.reject(new Error('Missing')); await opening; });
    expect(result.current.isHome).toBe(true);
    expect(result.current.documentError).toBeNull();
    expect(result.current.isOpeningDocument).toBe(false);
  });

  it('offers a recoverable browser-mode error while allowing new documents', async () => {
    native.isTauri.mockReturnValue(false);
    const { result } = renderDocument();
    await act(async () => { await result.current.openDocument(); });
    expect(result.current.isHome).toBe(true);
    expect(result.current.documentError).toMatch(/desktop app/);
    expect(native.openDialog).not.toHaveBeenCalled();
    act(() => result.current.newDoc());
    expect(result.current.isHome).toBe(false);
    expect(result.current.documentError).toBeNull();
  });
});
