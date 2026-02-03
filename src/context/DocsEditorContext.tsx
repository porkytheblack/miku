'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type {
  DocsDocument,
  DocsEntry,
  GitHubFileEntry,
  GitHubFolderEntry,
  DocsMetadata,
  DocsSyncStatus,
  DocsSyncResult,
} from '@/types';
import {
  parseDocsFile,
  serializeDocsDocument,
  createEmptyDocument,
  createPastedEntry,
  createGitHubFileEntry,
  createGitHubFolderEntry,
} from '@/lib/docsParser';
import {
  parseGitHubUrl,
  getCachedContent,
  fetchGitHubFile,
  fetchGitHubFolder,
  generateCacheKeyFromSource,
} from '@/lib/github';

// ============================================
// State Types
// ============================================

interface DocsEditorState {
  document: DocsDocument;
  activeEntryId: string | null;
  activeFileIndex: number | null;  // For folder entries, which file is selected
  expandedEntries: Set<string>;    // Which folder entries are expanded
  syncStatus: Map<string, DocsSyncStatus>;
  githubToken: string | null;
  isModified: boolean;
  hasLoaded: boolean;
  error: string | null;
}

// ============================================
// Action Types
// ============================================

type DocsEditorAction =
  // Document loading
  | { type: 'LOAD_CONTENT'; content: string }
  | { type: 'LOAD_DOCUMENT'; document: DocsDocument }

  // Entry operations
  | { type: 'ADD_ENTRY'; entry: DocsEntry }
  | { type: 'REMOVE_ENTRY'; id: string }
  | { type: 'UPDATE_ENTRY_TITLE'; id: string; title: string }
  | { type: 'REORDER_ENTRY'; id: string; newIndex: number }
  | { type: 'UPDATE_GITHUB_ENTRY'; id: string; updates: Partial<GitHubFileEntry | GitHubFolderEntry> }

  // UI state
  | { type: 'SET_ACTIVE_ENTRY'; entryId: string | null; fileIndex?: number | null }
  | { type: 'TOGGLE_ENTRY_EXPANDED'; id: string }
  | { type: 'SET_ENTRY_EXPANDED'; id: string; expanded: boolean }

  // Sync state
  | { type: 'SET_SYNC_STATUS'; entryId: string; status: DocsSyncStatus }
  | { type: 'CLEAR_SYNC_STATUS'; entryId: string }

  // Authentication
  | { type: 'SET_GITHUB_TOKEN'; token: string | null }

  // Error handling
  | { type: 'SET_ERROR'; error: string | null }

  // Persistence
  | { type: 'MARK_SAVED' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<DocsMetadata> };

// ============================================
// Reducer
// ============================================

function docsEditorReducer(state: DocsEditorState, action: DocsEditorAction): DocsEditorState {
  switch (action.type) {
    case 'LOAD_CONTENT': {
      const parsed = parseDocsFile(action.content);
      return {
        ...state,
        document: parsed,
        isModified: false,
        hasLoaded: true,
        activeEntryId: parsed.entries.length > 0 ? parsed.entries[0].id : null,
        activeFileIndex: null,
        expandedEntries: new Set(),
        syncStatus: new Map(),
        error: null,
      };
    }

    case 'LOAD_DOCUMENT': {
      return {
        ...state,
        document: action.document,
        isModified: false,
        hasLoaded: true,
        activeEntryId: action.document.entries.length > 0 ? action.document.entries[0].id : null,
        activeFileIndex: null,
        expandedEntries: new Set(),
        syncStatus: new Map(),
        error: null,
      };
    }

    case 'ADD_ENTRY': {
      if (state.document.entries.length >= 100) {
        console.warn('Maximum 100 entries allowed');
        return state;
      }
      return {
        ...state,
        document: {
          ...state.document,
          entries: [...state.document.entries, action.entry],
        },
        activeEntryId: action.entry.id,
        activeFileIndex: null,
        isModified: true,
      };
    }

    case 'REMOVE_ENTRY': {
      const newEntries = state.document.entries.filter(e => e.id !== action.id);
      const wasActive = state.activeEntryId === action.id;

      return {
        ...state,
        document: {
          ...state.document,
          entries: newEntries,
        },
        activeEntryId: wasActive
          ? (newEntries.length > 0 ? newEntries[0].id : null)
          : state.activeEntryId,
        activeFileIndex: wasActive ? null : state.activeFileIndex,
        isModified: true,
      };
    }

    case 'UPDATE_ENTRY_TITLE': {
      return {
        ...state,
        document: {
          ...state.document,
          entries: state.document.entries.map(entry =>
            entry.id === action.id
              ? { ...entry, title: action.title.slice(0, 200), updatedAt: new Date().toISOString() }
              : entry
          ),
        },
        isModified: true,
      };
    }

    case 'REORDER_ENTRY': {
      const entries = [...state.document.entries];
      const currentIndex = entries.findIndex(e => e.id === action.id);
      if (currentIndex === -1) return state;

      const [entry] = entries.splice(currentIndex, 1);
      entries.splice(Math.max(0, Math.min(action.newIndex, entries.length)), 0, entry);

      return {
        ...state,
        document: {
          ...state.document,
          entries,
        },
        isModified: true,
      };
    }

    case 'UPDATE_GITHUB_ENTRY': {
      return {
        ...state,
        document: {
          ...state.document,
          entries: state.document.entries.map((entry): DocsEntry => {
            if (entry.id !== action.id) return entry;
            if (entry.type === 'github-file') {
              return { ...entry, ...action.updates, updatedAt: new Date().toISOString() } as GitHubFileEntry;
            }
            if (entry.type === 'github-folder') {
              return { ...entry, ...action.updates, updatedAt: new Date().toISOString() } as GitHubFolderEntry;
            }
            return entry;
          }),
        },
        isModified: true,
      };
    }

    case 'SET_ACTIVE_ENTRY': {
      return {
        ...state,
        activeEntryId: action.entryId,
        activeFileIndex: action.fileIndex ?? null,
      };
    }

    case 'TOGGLE_ENTRY_EXPANDED': {
      const newExpanded = new Set(state.expandedEntries);
      if (newExpanded.has(action.id)) {
        newExpanded.delete(action.id);
      } else {
        newExpanded.add(action.id);
      }
      return {
        ...state,
        expandedEntries: newExpanded,
      };
    }

    case 'SET_ENTRY_EXPANDED': {
      const newExpanded = new Set(state.expandedEntries);
      if (action.expanded) {
        newExpanded.add(action.id);
      } else {
        newExpanded.delete(action.id);
      }
      return {
        ...state,
        expandedEntries: newExpanded,
      };
    }

    case 'SET_SYNC_STATUS': {
      const newStatus = new Map(state.syncStatus);
      newStatus.set(action.entryId, action.status);
      return {
        ...state,
        syncStatus: newStatus,
      };
    }

    case 'CLEAR_SYNC_STATUS': {
      const newStatus = new Map(state.syncStatus);
      newStatus.delete(action.entryId);
      return {
        ...state,
        syncStatus: newStatus,
      };
    }

    case 'SET_GITHUB_TOKEN': {
      return {
        ...state,
        githubToken: action.token,
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.error,
      };
    }

    case 'MARK_SAVED': {
      return {
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            updatedAt: new Date().toISOString(),
          },
        },
        isModified: false,
      };
    }

    case 'UPDATE_METADATA': {
      return {
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            ...action.metadata,
          },
        },
        isModified: true,
      };
    }

    default:
      return state;
  }
}

// ============================================
// Context Type
// ============================================

interface DocsEditorContextType {
  state: DocsEditorState;

  // Document operations
  loadContent: (content: string) => void;
  getContent: () => string;

  // Entry operations
  addPastedEntry: (title: string, content: string) => void;
  addGitHubFileEntry: (url: string) => Promise<{ success: boolean; error?: string }>;
  addGitHubFolderEntry: (url: string, onProgress?: (fetched: number, total: number) => void) => Promise<{ success: boolean; error?: string }>;
  removeEntry: (id: string) => void;
  updateEntryTitle: (id: string, title: string) => void;
  reorderEntry: (id: string, newIndex: number) => void;

  // Content access
  getEntryContent: (id: string, fileIndex?: number) => Promise<string | null>;

  // Sync operations
  syncEntry: (id: string) => Promise<DocsSyncResult>;
  syncAllEntries: () => Promise<DocsSyncResult[]>;

  // UI state
  setActiveEntry: (id: string | null, fileIndex?: number | null) => void;
  toggleEntryExpanded: (id: string) => void;
  setEntryExpanded: (id: string, expanded: boolean) => void;

  // Authentication
  setGitHubToken: (token: string | null) => void;

  // Error handling
  clearError: () => void;

  // Metadata
  updateMetadata: (metadata: Partial<DocsMetadata>) => void;

  // Serialization
  markSaved: () => void;

  // Helpers
  getEntryById: (id: string) => DocsEntry | null;
}

const DocsEditorContext = createContext<DocsEditorContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

const initialState: DocsEditorState = {
  document: createEmptyDocument(),
  activeEntryId: null,
  activeFileIndex: null,
  expandedEntries: new Set(),
  syncStatus: new Map(),
  githubToken: null,
  isModified: false,
  hasLoaded: false,
  error: null,
};

export function DocsEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(docsEditorReducer, initialState);

  // Document operations
  const loadContent = useCallback((content: string) => {
    dispatch({ type: 'LOAD_CONTENT', content });
  }, []);

  const getContent = useCallback(() => {
    return serializeDocsDocument(state.document);
  }, [state.document]);

  // Entry operations
  const addPastedEntry = useCallback((title: string, content: string) => {
    if (!content.trim()) {
      dispatch({ type: 'SET_ERROR', error: 'Content cannot be empty' });
      return;
    }
    const entry = createPastedEntry(title, content);
    dispatch({ type: 'ADD_ENTRY', entry });
  }, []);

  const addGitHubFileEntry = useCallback(async (url: string): Promise<{ success: boolean; error?: string }> => {
    const parseResult = parseGitHubUrl(url);

    if (!parseResult || parseResult.type !== 'file') {
      return { success: false, error: 'Invalid GitHub file URL. Expected a URL like: https://github.com/owner/repo/blob/branch/path/to/file.md' };
    }

    const source = parseResult.source;
    const cacheKey = generateCacheKeyFromSource(source);

    // Fetch the file
    const fetchResult = await fetchGitHubFile(source, {
      authToken: state.githubToken || undefined,
    });

    if (!fetchResult.success) {
      return { success: false, error: fetchResult.error };
    }

    // Extract title from content
    const { extractTitleFromMarkdown } = await import('@/lib/docsParser');
    const title = extractTitleFromMarkdown(fetchResult.content!, source.path.split('/').pop() || 'Untitled');

    const entry = createGitHubFileEntry(title, source, cacheKey);
    if (fetchResult.sha) {
      entry.lastCommitSha = fetchResult.sha;
    }

    dispatch({ type: 'ADD_ENTRY', entry });
    return { success: true };
  }, [state.githubToken]);

  const addGitHubFolderEntry = useCallback(async (
    url: string,
    onProgress?: (fetched: number, total: number) => void
  ): Promise<{ success: boolean; error?: string }> => {
    const parseResult = parseGitHubUrl(url);

    if (!parseResult || parseResult.type !== 'folder') {
      return { success: false, error: 'Invalid GitHub folder URL. Expected a URL like: https://github.com/owner/repo/tree/branch/path/to/folder' };
    }

    const source = parseResult.source;

    // Fetch the folder contents
    const fetchResult = await fetchGitHubFolder(source, {
      authToken: state.githubToken || undefined,
      onProgress,
    });

    if (!fetchResult.success || !fetchResult.files) {
      return { success: false, error: fetchResult.error };
    }

    // Create folder entry
    const title = source.path.split('/').pop() || 'Documentation';
    const entry = createGitHubFolderEntry(title, source, fetchResult.files);

    dispatch({ type: 'ADD_ENTRY', entry });
    dispatch({ type: 'SET_ENTRY_EXPANDED', id: entry.id, expanded: true });

    return { success: true };
  }, [state.githubToken]);

  const removeEntry = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ENTRY', id });
  }, []);

  const updateEntryTitle = useCallback((id: string, title: string) => {
    dispatch({ type: 'UPDATE_ENTRY_TITLE', id, title });
  }, []);

  const reorderEntry = useCallback((id: string, newIndex: number) => {
    dispatch({ type: 'REORDER_ENTRY', id, newIndex });
  }, []);

  // Content access
  const getEntryContent = useCallback(async (id: string, fileIndex?: number): Promise<string | null> => {
    const entry = state.document.entries.find(e => e.id === id);
    if (!entry) return null;

    switch (entry.type) {
      case 'pasted':
        return entry.content;

      case 'github-file':
        return getCachedContent(entry.cacheKey);

      case 'github-folder':
        if (fileIndex !== undefined && fileIndex >= 0 && fileIndex < entry.files.length) {
          return getCachedContent(entry.files[fileIndex].cacheKey);
        }
        // Return first file by default
        if (entry.files.length > 0) {
          return getCachedContent(entry.files[0].cacheKey);
        }
        return null;

      default:
        return null;
    }
  }, [state.document.entries]);

  // Sync operations
  const syncEntry = useCallback(async (id: string): Promise<DocsSyncResult> => {
    const entry = state.document.entries.find(e => e.id === id);

    if (!entry) {
      return { entryId: id, status: 'error', error: 'Entry not found' };
    }

    if (entry.type === 'pasted') {
      return { entryId: id, status: 'unchanged' };
    }

    dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'syncing' });

    try {
      if (entry.type === 'github-file') {
        const fetchResult = await fetchGitHubFile(entry.source, {
          authToken: state.githubToken || undefined,
        });

        if (!fetchResult.success) {
          dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'error' });
          return { entryId: id, status: 'error', error: fetchResult.error };
        }

        const wasUpdated = !fetchResult.fromCache;

        dispatch({
          type: 'UPDATE_GITHUB_ENTRY',
          id,
          updates: {
            lastFetched: new Date().toISOString(),
            lastCommitSha: fetchResult.sha,
          },
        });

        dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'success' });

        // Clear status after a delay
        setTimeout(() => {
          dispatch({ type: 'CLEAR_SYNC_STATUS', entryId: id });
        }, 3000);

        return { entryId: id, status: wasUpdated ? 'updated' : 'unchanged' };
      }

      if (entry.type === 'github-folder') {
        // Re-fetch the folder to check for updates
        const fetchResult = await fetchGitHubFolder(entry.source, {
          authToken: state.githubToken || undefined,
        });

        if (!fetchResult.success || !fetchResult.files) {
          dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'error' });
          return { entryId: id, status: 'error', error: fetchResult.error };
        }

        dispatch({
          type: 'UPDATE_GITHUB_ENTRY',
          id,
          updates: {
            files: fetchResult.files,
            lastFetched: new Date().toISOString(),
          },
        });

        dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'success' });

        setTimeout(() => {
          dispatch({ type: 'CLEAR_SYNC_STATUS', entryId: id });
        }, 3000);

        return { entryId: id, status: 'updated' };
      }

      return { entryId: id, status: 'unchanged' };
    } catch (error) {
      dispatch({ type: 'SET_SYNC_STATUS', entryId: id, status: 'error' });
      return {
        entryId: id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [state.document.entries, state.githubToken]);

  const syncAllEntries = useCallback(async (): Promise<DocsSyncResult[]> => {
    const results: DocsSyncResult[] = [];

    // Sync entries sequentially to avoid rate limiting
    for (const entry of state.document.entries) {
      if (entry.type !== 'pasted') {
        const result = await syncEntry(entry.id);
        results.push(result);
      }
    }

    return results;
  }, [state.document.entries, syncEntry]);

  // UI state
  const setActiveEntry = useCallback((id: string | null, fileIndex?: number | null) => {
    dispatch({ type: 'SET_ACTIVE_ENTRY', entryId: id, fileIndex });
  }, []);

  const toggleEntryExpanded = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_ENTRY_EXPANDED', id });
  }, []);

  const setEntryExpanded = useCallback((id: string, expanded: boolean) => {
    dispatch({ type: 'SET_ENTRY_EXPANDED', id, expanded });
  }, []);

  // Authentication
  const setGitHubToken = useCallback((token: string | null) => {
    dispatch({ type: 'SET_GITHUB_TOKEN', token });
  }, []);

  // Error handling
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, []);

  // Metadata
  const updateMetadata = useCallback((metadata: Partial<DocsMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', metadata });
  }, []);

  // Serialization
  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);

  // Helpers
  const getEntryById = useCallback((id: string): DocsEntry | null => {
    return state.document.entries.find(e => e.id === id) || null;
  }, [state.document.entries]);

  const value: DocsEditorContextType = {
    state,
    loadContent,
    getContent,
    addPastedEntry,
    addGitHubFileEntry,
    addGitHubFolderEntry,
    removeEntry,
    updateEntryTitle,
    reorderEntry,
    getEntryContent,
    syncEntry,
    syncAllEntries,
    setActiveEntry,
    toggleEntryExpanded,
    setEntryExpanded,
    setGitHubToken,
    clearError,
    updateMetadata,
    markSaved,
    getEntryById,
  };

  return (
    <DocsEditorContext.Provider value={value}>
      {children}
    </DocsEditorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useDocsEditor() {
  const context = useContext(DocsEditorContext);
  if (!context) {
    throw new Error('useDocsEditor must be used within a DocsEditorProvider');
  }
  return context;
}
