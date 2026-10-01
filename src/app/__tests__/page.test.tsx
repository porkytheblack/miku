import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../page';
import { DocumentProvider, useDocument } from '@/context/DocumentContext';

const lifecycle = vi.hoisted(() => ({ mounts: vi.fn(), unmounts: vi.fn() }));

vi.mock('@/lib/tauri', () => ({ isTauri: () => false }));
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    workspace: { currentWorkspace: null, recentWorkspaces: [], files: [], envFiles: [], isLoading: false, error: null },
    selectWorkspace: vi.fn(), openWorkspace: vi.fn(), refreshFiles: vi.fn(), refreshEnvFiles: vi.fn(), createFile: vi.fn(),
  }),
}));
vi.mock('@/components/EditorSwitcher', () => ({
  default: function StatefulEditor() {
    const { registerContentGetter } = useDocument();
    const [buffer, setBuffer] = useState('');
    useEffect(() => {
      lifecycle.mounts();
      return () => { lifecycle.unmounts(); };
    }, []);
    useEffect(() => { registerContentGetter(() => buffer); }, [buffer, registerContentGetter]);
    return <textarea aria-label="Editor buffer" value={buffer} onChange={event => setBuffer(event.target.value)} />;
  },
}));
vi.mock('@/components/TopBar', () => ({
  default: function TopBar({ onToggleFileBrowser }: { onToggleFileBrowser: () => void }) {
    const { showHome } = useDocument();
    return <><button onClick={showHome}>Go Home</button><button onClick={onToggleFileBrowser}>Toggle sidebar</button></>;
  },
}));
vi.mock('@/components/FileBrowser', () => ({ default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <aside aria-label="File browser" /> : null }));
vi.mock('@/components/FloatingBar', () => ({ default: () => null }));
vi.mock('@/components/SoundNotifier', () => ({ default: () => null }));
vi.mock('@/components/CommandPalette', () => ({ default: () => null }));
vi.mock('@/components/GlobalSearch', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmDialog', () => ({ default: () => null }));
vi.mock('@/components/ui/InputDialog', () => ({ default: () => null }));
vi.mock('@/components/ui/UpdateNotification', () => ({ default: () => null }));
vi.mock('@/components/SettingsPanel', () => ({ default: () => null }));
vi.mock('@/components/AutoSaveManager', () => ({ default: () => null }));
vi.mock('@/components/ExternalLinkHandler', () => ({ default: () => null }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Home page editor lifetime', () => {
  it('starts on Home with the mounted editor hidden and inert', () => {
    render(<DocumentProvider><Home /></DocumentProvider>);
    expect(screen.getByRole('heading', { name: 'Home', level: 1 })).toBeInTheDocument();
    const editor = screen.getByLabelText('Editor buffer');
    expect(editor).not.toBeVisible();
    expect(editor.parentElement).toHaveAttribute('hidden');
    expect(editor.parentElement).toHaveAttribute('inert');
    expect(lifecycle.mounts).toHaveBeenCalledTimes(1);
  });

  it('retains editor state and its DOM instance when Home resumes an unsaved document', () => {
    render(<DocumentProvider><Home /></DocumentProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'New Document' }));
    const editor = screen.getByRole('textbox', { name: 'Editor buffer' });
    fireEvent.change(editor, { target: { value: 'Draft with unsaved edits' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go Home' }));
    expect(editor).not.toBeVisible();
    expect(editor.parentElement).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: /^Untitled\s*Unsaved changes$/ }));
    expect(screen.getByRole('textbox', { name: 'Editor buffer' })).toBe(editor);
    expect(editor).toHaveValue('Draft with unsaved edits');
    expect(editor).toBeVisible();
    expect(editor.parentElement).not.toHaveAttribute('inert');
    expect(lifecycle.mounts).toHaveBeenCalledTimes(1);
    expect(lifecycle.unmounts).not.toHaveBeenCalled();
  });

  it('opens the file browser and returns to the editor when the sidebar action is used on Home', () => {
    render(<DocumentProvider><Home /></DocumentProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.queryByRole('heading', { name: 'Home', level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'File browser' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Editor buffer' })).toBeVisible();
  });

  it('lets the existing tab keyboard shortcut leave Home', () => {
    render(<DocumentProvider><Home /></DocumentProvider>);
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(screen.queryByRole('heading', { name: 'Home', level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Editor buffer' })).toBeVisible();
  });
});
