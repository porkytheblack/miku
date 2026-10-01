import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeOverview from '../HomeOverview';
import { useWorkspace, type WorkspaceFile } from '@/context/WorkspaceContext';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';

vi.mock('@/context/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/context/DocumentContext', () => ({ useDocument: vi.fn() }));
vi.mock('@/lib/tauri', () => ({ isTauri: vi.fn() }));

type WorkspaceContext = ReturnType<typeof useWorkspace>;
type DocumentContext = ReturnType<typeof useDocument>;
let workspace: WorkspaceContext;
let documents: DocumentContext;

const files: WorkspaceFile[] = [
  { name: 'README.md', path: '/project/README.md', isDirectory: false },
  { name: 'Notes', path: '/project/Notes', isDirectory: true, children: [
    { name: 'Ideas.md', path: '/project/Notes/Ideas.md', isDirectory: false },
    { name: 'Archive', path: '/project/Notes/Archive', isDirectory: true, children: [
      { name: 'Launch.miku-kanban', path: '/project/Notes/Archive/Launch.miku-kanban', isDirectory: false },
    ] },
  ] },
  { name: 'Empty', path: '/project/Empty', isDirectory: true, children: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  workspace = {
    workspace: {
      currentWorkspace: { name: 'Project', path: '/project' }, files,
      envFiles: [{ name: 'production.miku-env', path: '/project/production.miku-env', isDirectory: false }],
      recentWorkspaces: [{ name: 'Project', path: '/project' }, { name: 'Other', path: '/other' }],
      isLoading: false, error: null,
    },
    hasWorkspace: true,
    selectWorkspace: vi.fn().mockResolvedValue(undefined), openWorkspace: vi.fn().mockResolvedValue(undefined),
    refreshFiles: vi.fn().mockResolvedValue(undefined), refreshEnvFiles: vi.fn().mockResolvedValue(undefined),
    createFile: vi.fn(), createFolder: vi.fn(), deleteFile: vi.fn(), renameFile: vi.fn(),
  };
  documents = {
    document: { path: null, content: '', isModified: false, recentFiles: [] },
    openDocuments: [{ id: 'blank', path: null, content: '', originalContent: '', isModified: false }],
    activeDocumentId: 'blank', isHome: true, isOpeningDocument: false, documentError: null,
    showHome: vi.fn(), setContent: vi.fn(), setContentForDocument: vi.fn(), setOriginalContent: vi.fn(),
    openDocument: vi.fn().mockResolvedValue(undefined), saveDocument: vi.fn(), newDoc: vi.fn(),
    loadRecentFiles: vi.fn(), switchToDocument: vi.fn(), closeDocument: vi.fn(), registerContentGetter: vi.fn(),
    getEditorContent: vi.fn(), markDocumentSaved: vi.fn(),
  };
  vi.mocked(useWorkspace).mockImplementation(() => workspace);
  vi.mocked(useDocument).mockImplementation(() => documents);
  vi.mocked(isTauri).mockReturnValue(true);
});

afterEach(cleanup);

describe('Home overview', () => {
  it('opens a folder, file picker, or new document through the existing contexts', () => {
    render(<HomeOverview />);
    expect(screen.getByRole('heading', { name: 'Home', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open File' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Document' }));
    expect(workspace.selectWorkspace).toHaveBeenCalledTimes(1);
    expect(documents.openDocument).toHaveBeenCalledWith();
    expect(documents.newDoc).toHaveBeenCalledTimes(1);
  });

  it('renders workspace and environment files and opens files by their full path', () => {
    render(<HomeOverview />);
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'README.md' }));
    expect(documents.openDocument).toHaveBeenCalledWith('/project/README.md');
    fireEvent.click(screen.getByRole('button', { name: 'production.miku-env' }));
    expect(documents.openDocument).toHaveBeenCalledWith('/project/production.miku-env');
  });

  it('expands nested folders without opening them as files and supports collapsing', () => {
    render(<HomeOverview />);
    const notes = screen.getByRole('button', { name: 'Notes' });
    expect(notes).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Ideas.md' })).not.toBeInTheDocument();
    fireEvent.click(notes);
    expect(notes).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Launch.miku-kanban' }));
    expect(documents.openDocument).toHaveBeenCalledExactlyOnceWith('/project/Notes/Archive/Launch.miku-kanban');
    fireEvent.click(notes);
    expect(screen.queryByRole('button', { name: 'Launch.miku-kanban' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Empty' }));
    expect(screen.getByText('No Miku files in this folder')).toBeInTheDocument();
  });

  it('filters nested files case-insensitively and automatically exposes matching descendants', () => {
    render(<HomeOverview />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter files' }), { target: { value: ' LAUNCH ' } });
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Launch.miku-kanban' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'README.md' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ideas.md' })).not.toBeInTheDocument();
  });

  it('shows a no-match state and lets the user clear the filter', () => {
    render(<HomeOverview />);
    const filter = screen.getByRole('searchbox', { name: 'Filter files' });
    fireEvent.change(filter, { target: { value: 'absent' } });
    expect(screen.getByRole('heading', { name: 'No matching files' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(filter).toHaveValue('');
    expect(screen.getByRole('button', { name: 'README.md' })).toBeInTheDocument();
  });

  it('switches recent folders and clears the previous file filter', () => {
    render(<HomeOverview />);
    const recent = screen.getByRole('region', { name: 'Recent folders' });
    expect(within(recent).getByRole('button', { name: /^Project\s*\/project$/ })).toHaveAttribute('aria-current', 'true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter files' }), { target: { value: 'README' } });
    fireEvent.click(within(recent).getByRole('button', { name: /^Other\s*\/other$/ }));
    expect(workspace.openWorkspace).toHaveBeenCalledWith('/other');
    expect(screen.getByRole('searchbox', { name: 'Filter files' })).toHaveValue('');
  });

  it('resumes saved files and unsaved drafts while hiding the initial empty tab', () => {
    documents.openDocuments.push(
      { id: 'saved', path: 'C:\\notes\\saved.md', content: 'Saved', originalContent: 'Saved', isModified: false },
      { id: 'draft', path: null, content: 'Unsaved draft', originalContent: '', isModified: true },
    );
    render(<HomeOverview />);
    const open = screen.getByRole('region', { name: 'Open documents' });
    expect(within(open).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(open).getByRole('button', { name: /^saved\.md\s*Continue editing$/ }));
    expect(documents.switchToDocument).toHaveBeenCalledWith('saved');
    fireEvent.click(within(open).getByRole('button', { name: /^Untitled\s*Unsaved changes$/ }));
    expect(documents.switchToDocument).toHaveBeenCalledWith('draft');
  });

  it('refreshes both regular and environment file lists', () => {
    render(<HomeOverview />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh files' }));
    expect(workspace.refreshFiles).toHaveBeenCalledTimes(1);
    expect(workspace.refreshEnvFiles).toHaveBeenCalledTimes(1);
  });

  it('shows the first-run empty state without file filtering or refresh controls', () => {
    workspace.workspace.currentWorkspace = null;
    workspace.workspace.files = [];
    workspace.workspace.envFiles = [];
    workspace.workspace.recentWorkspaces = [];
    render(<HomeOverview />);
    expect(screen.getByRole('heading', { name: 'A little room for your ideas' })).toBeInTheDocument();
    expect(screen.getByText('Folders you open will appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Open documents' })).not.toBeInTheDocument();
  });

  it('distinguishes an empty workspace from no matching files', () => {
    workspace.workspace.files = [];
    workspace.workspace.envFiles = [];
    render(<HomeOverview />);
    expect(screen.getByRole('heading', { name: 'No Miku files yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No matching files' })).not.toBeInTheDocument();
  });

  it('shows loading feedback and prevents overlapping file and folder actions', () => {
    workspace.workspace.isLoading = true;
    render(<HomeOverview />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading folder…');
    expect(screen.getByRole('region', { name: 'Project' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh files' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Other\s*\/other$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Document' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'No Miku files yet' })).not.toBeInTheDocument();
  });

  it('shows an opening status and disables file rows until opening finishes', () => {
    documents.isOpeningDocument = true;
    render(<HomeOverview />);
    expect(screen.getByRole('status')).toHaveTextContent('Opening file…');
    expect(screen.getByRole('button', { name: 'README.md' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeDisabled();
  });

  it.each(['workspace', 'document'])('announces a %s error without removing Home actions', (source) => {
    if (source === 'workspace') workspace.workspace.error = 'Folder is unavailable';
    else documents.documentError = 'File is unavailable';
    render(<HomeOverview />);
    expect(screen.getByRole('alert')).toHaveTextContent(source === 'workspace' ? 'Folder is unavailable' : 'File is unavailable');
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'New Document' })).toBeEnabled();
  });

  it('shows both folder and file errors without masking either recovery message', () => {
    workspace.workspace.error = 'Folder refresh failed';
    documents.documentError = 'Selected file could not be opened';
    render(<HomeOverview />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts.some(alert => alert.textContent === 'Folder refresh failed')).toBe(true);
    expect(alerts.some(alert => alert.textContent === 'Selected file could not be opened')).toBe(true);
  });

  it('explains browser limitations and keeps new documents available', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    render(<HomeOverview />);
    expect(screen.getByText(/Folders and local files are available in the Miku desktop app/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Document' })).toBeEnabled();
  });
});
