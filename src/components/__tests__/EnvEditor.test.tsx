import type { ReactNode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EnvEditor from '../EnvEditor';

const mocks = vi.hoisted(() => ({
  isHome: false,
  registerContentGetter: vi.fn(), setOriginalContent: vi.fn(),
  deleteSelected: vi.fn(), selectAll: vi.fn(), importFromClipboard: vi.fn(),
  clearSelection: vi.fn(), setEditing: vi.fn(),
}));

vi.mock('@/context/DocumentContext', () => ({ useDocument: () => mocks }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/context/EnvEditorContext', () => ({
  EnvEditorProvider: ({ children }: { children: ReactNode }) => children,
  useEnvEditor: () => ({
    state: { document: { variables: [] }, selectedIds: new Set(['selected-variable']), hasLoaded: false },
    filteredVariables: [], getContent: () => '', ...mocks,
  }),
}));
vi.mock('../EnvEditor/SecurityBanner', () => ({ default: () => null }));
vi.mock('../EnvEditor/EnvToolbar', () => ({ default: () => null }));
vi.mock('../EnvEditor/EnvTable', () => ({ default: () => null }));
vi.mock('../EnvEditor/EnvEmptyState', () => ({ default: () => null }));

beforeEach(() => { vi.clearAllMocks(); mocks.isHome = false; });
afterEach(cleanup);

describe('Home environment editor keyboard isolation', () => {
  it.each(['Delete', 'Backspace'])('does not delete selected variables on Home when %s is pressed', (key) => {
    const { rerender } = render(<EnvEditor />);
    fireEvent.keyDown(document.body, { key });
    expect(mocks.deleteSelected).toHaveBeenCalledTimes(1);
    mocks.isHome = true;
    rerender(<EnvEditor />);
    fireEvent.keyDown(document.body, { key });
    expect(mocks.deleteSelected).toHaveBeenCalledTimes(1);
    mocks.isHome = false;
    rerender(<EnvEditor />);
    fireEvent.keyDown(document.body, { key });
    expect(mocks.deleteSelected).toHaveBeenCalledTimes(2);
  });

  it('does not intercept select-all, paste, or Escape while Home is visible', () => {
    mocks.isHome = true;
    render(<EnvEditor />);
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'v', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(mocks.selectAll).not.toHaveBeenCalled();
    expect(mocks.importFromClipboard).not.toHaveBeenCalled();
    expect(mocks.clearSelection).not.toHaveBeenCalled();
    expect(mocks.setEditing).not.toHaveBeenCalled();
  });
});
