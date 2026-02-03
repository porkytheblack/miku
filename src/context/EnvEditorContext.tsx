'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type { EnvVariable, MikuEnvDocument, MikuEnvMetadata } from '@/types';
import {
  parseAutoDetect,
  parseMikuEnvFile,
  serializeToMikuEnv,
  createVariable,
  createEmptyMikuEnvDocument,
} from '@/lib/envParser';

// ============================================
// State Types
// ============================================

interface EnvEditorState {
  document: MikuEnvDocument;
  selectedIds: Set<string>;
  editingId: string | null;
  isModified: boolean;
  hasLoaded: boolean; // Tracks whether initial content has been loaded
  searchQuery: string;
  showSecrets: boolean;
}

// ============================================
// Action Types
// ============================================

type EnvEditorAction =
  | { type: 'LOAD_CONTENT'; content: string }
  | { type: 'LOAD_DOCUMENT'; document: MikuEnvDocument }
  | { type: 'ADD_VARIABLE'; variable?: EnvVariable }
  | { type: 'UPDATE_VARIABLE'; id: string; updates: Partial<Omit<EnvVariable, 'id'>> }
  | { type: 'DELETE_VARIABLES'; ids: string[] }
  | { type: 'MOVE_VARIABLE'; id: string; direction: 'up' | 'down' }
  | { type: 'DUPLICATE_VARIABLE'; id: string }
  | { type: 'SET_SELECTED'; ids: string[] }
  | { type: 'TOGGLE_SELECTED'; id: string }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_EDITING'; id: string | null }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'TOGGLE_SHOW_SECRETS' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<MikuEnvMetadata> }
  | { type: 'MARK_SAVED' }
  | { type: 'IMPORT_VARIABLES'; variables: EnvVariable[]; append: boolean };

// ============================================
// Reducer
// ============================================

function envEditorReducer(state: EnvEditorState, action: EnvEditorAction): EnvEditorState {
  switch (action.type) {
    case 'LOAD_CONTENT': {
      // Use parseMikuEnvFile to preserve the file's original metadata
      // This ensures getContent() serializes back to the same content
      const parsed = parseMikuEnvFile(action.content);
      return {
        ...state,
        document: parsed,
        isModified: false,
        hasLoaded: true,
        selectedIds: new Set(),
        editingId: null,
      };
    }

    case 'LOAD_DOCUMENT': {
      return {
        ...state,
        document: action.document,
        isModified: false,
        hasLoaded: true,
        selectedIds: new Set(),
        editingId: null,
      };
    }

    case 'ADD_VARIABLE': {
      // Always ensure a valid ID exists - use passed variable's key/value but generate fresh ID
      const newVar = action.variable?.id
        ? action.variable
        : createVariable(action.variable?.key, action.variable?.value);
      return {
        ...state,
        document: {
          ...state.document,
          variables: [...state.document.variables, newVar],
        },
        isModified: true,
        editingId: newVar.id,
      };
    }

    case 'UPDATE_VARIABLE': {
      return {
        ...state,
        document: {
          ...state.document,
          variables: state.document.variables.map(v =>
            v.id === action.id ? { ...v, ...action.updates } : v
          ),
        },
        isModified: true,
      };
    }

    case 'DELETE_VARIABLES': {
      const idsToDelete = new Set(action.ids);
      return {
        ...state,
        document: {
          ...state.document,
          variables: state.document.variables.filter(v => !idsToDelete.has(v.id)),
        },
        isModified: true,
        selectedIds: new Set(),
        editingId: idsToDelete.has(state.editingId || '') ? null : state.editingId,
      };
    }

    case 'MOVE_VARIABLE': {
      const variables = [...state.document.variables];
      const index = variables.findIndex(v => v.id === action.id);
      if (index === -1) return state;

      const newIndex = action.direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= variables.length) return state;

      [variables[index], variables[newIndex]] = [variables[newIndex], variables[index]];

      return {
        ...state,
        document: { ...state.document, variables },
        isModified: true,
      };
    }

    case 'DUPLICATE_VARIABLE': {
      const original = state.document.variables.find(v => v.id === action.id);
      if (!original) return state;

      const duplicated = createVariable(`${original.key}_COPY`, original.value);
      duplicated.comment = original.comment;
      duplicated.isSecret = original.isSecret;
      duplicated.group = original.group;

      const index = state.document.variables.findIndex(v => v.id === action.id);
      const variables = [...state.document.variables];
      variables.splice(index + 1, 0, duplicated);

      return {
        ...state,
        document: { ...state.document, variables },
        isModified: true,
        editingId: duplicated.id,
      };
    }

    case 'SET_SELECTED': {
      return {
        ...state,
        selectedIds: new Set(action.ids),
      };
    }

    case 'TOGGLE_SELECTED': {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(action.id)) {
        newSelected.delete(action.id);
      } else {
        newSelected.add(action.id);
      }
      return {
        ...state,
        selectedIds: newSelected,
      };
    }

    case 'SELECT_ALL': {
      return {
        ...state,
        selectedIds: new Set(state.document.variables.map(v => v.id)),
      };
    }

    case 'CLEAR_SELECTION': {
      return {
        ...state,
        selectedIds: new Set(),
      };
    }

    case 'SET_EDITING': {
      return {
        ...state,
        editingId: action.id,
      };
    }

    case 'SET_SEARCH': {
      return {
        ...state,
        searchQuery: action.query,
      };
    }

    case 'TOGGLE_SHOW_SECRETS': {
      return {
        ...state,
        showSecrets: !state.showSecrets,
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

    case 'IMPORT_VARIABLES': {
      const variables = action.append
        ? [...state.document.variables, ...action.variables]
        : action.variables;
      return {
        ...state,
        document: { ...state.document, variables },
        isModified: true,
      };
    }

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface EnvEditorContextType {
  state: EnvEditorState;
  // Loading
  loadContent: (content: string) => void;
  loadDocument: (document: MikuEnvDocument) => void;
  // Variables
  addVariable: (variable?: EnvVariable) => void;
  updateVariable: (id: string, updates: Partial<Omit<EnvVariable, 'id'>>) => void;
  deleteVariables: (ids: string[]) => void;
  deleteSelected: () => void;
  moveVariable: (id: string, direction: 'up' | 'down') => void;
  duplicateVariable: (id: string) => void;
  // Selection
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  // Editing
  setEditing: (id: string | null) => void;
  // Search
  setSearch: (query: string) => void;
  // Visibility
  toggleShowSecrets: () => void;
  // Metadata
  updateMetadata: (metadata: Partial<MikuEnvMetadata>) => void;
  // Serialization
  getContent: () => string;
  markSaved: () => void;
  // Import
  importVariables: (variables: EnvVariable[], append?: boolean) => void;
  importFromClipboard: () => Promise<void>;
  // Computed
  filteredVariables: EnvVariable[];
}

const EnvEditorContext = createContext<EnvEditorContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

const initialState: EnvEditorState = {
  document: createEmptyMikuEnvDocument(),
  selectedIds: new Set(),
  editingId: null,
  isModified: false,
  hasLoaded: false,
  searchQuery: '',
  showSecrets: false,
};

export function EnvEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(envEditorReducer, initialState);

  // Loading
  const loadContent = useCallback((content: string) => {
    dispatch({ type: 'LOAD_CONTENT', content });
  }, []);

  const loadDocument = useCallback((document: MikuEnvDocument) => {
    dispatch({ type: 'LOAD_DOCUMENT', document });
  }, []);

  // Variables
  const addVariable = useCallback((variable?: EnvVariable) => {
    dispatch({ type: 'ADD_VARIABLE', variable });
  }, []);

  const updateVariable = useCallback((id: string, updates: Partial<Omit<EnvVariable, 'id'>>) => {
    dispatch({ type: 'UPDATE_VARIABLE', id, updates });
  }, []);

  const deleteVariables = useCallback((ids: string[]) => {
    dispatch({ type: 'DELETE_VARIABLES', ids });
  }, []);

  const deleteSelected = useCallback(() => {
    dispatch({ type: 'DELETE_VARIABLES', ids: Array.from(state.selectedIds) });
  }, [state.selectedIds]);

  const moveVariable = useCallback((id: string, direction: 'up' | 'down') => {
    dispatch({ type: 'MOVE_VARIABLE', id, direction });
  }, []);

  const duplicateVariable = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_VARIABLE', id });
  }, []);

  // Selection
  const setSelected = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED', ids });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTED', id });
  }, []);

  const selectAll = useCallback(() => {
    dispatch({ type: 'SELECT_ALL' });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  // Editing
  const setEditing = useCallback((id: string | null) => {
    dispatch({ type: 'SET_EDITING', id });
  }, []);

  // Search
  const setSearch = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  // Visibility
  const toggleShowSecrets = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHOW_SECRETS' });
  }, []);

  // Metadata
  const updateMetadata = useCallback((metadata: Partial<MikuEnvMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', metadata });
  }, []);

  // Serialization
  const getContent = useCallback(() => {
    return serializeToMikuEnv(state.document);
  }, [state.document]);

  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);

  // Import
  const importVariables = useCallback((variables: EnvVariable[], append: boolean = false) => {
    dispatch({ type: 'IMPORT_VARIABLES', variables, append });
  }, []);

  const importFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const variables = parseAutoDetect(text);
      if (variables.length > 0) {
        dispatch({ type: 'IMPORT_VARIABLES', variables, append: true });
      }
    } catch {
      console.error('Failed to read clipboard');
    }
  }, []);

  // Computed: filtered variables
  const filteredVariables = state.searchQuery
    ? state.document.variables.filter(v =>
        v.key.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        v.value.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        v.comment?.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.document.variables;

  const value: EnvEditorContextType = {
    state,
    loadContent,
    loadDocument,
    addVariable,
    updateVariable,
    deleteVariables,
    deleteSelected,
    moveVariable,
    duplicateVariable,
    setSelected,
    toggleSelected,
    selectAll,
    clearSelection,
    setEditing,
    setSearch,
    toggleShowSecrets,
    updateMetadata,
    getContent,
    markSaved,
    importVariables,
    importFromClipboard,
    filteredVariables,
  };

  return (
    <EnvEditorContext.Provider value={value}>
      {children}
    </EnvEditorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useEnvEditor() {
  const context = useContext(EnvEditorContext);
  if (!context) {
    throw new Error('useEnvEditor must be used within an EnvEditorProvider');
  }
  return context;
}
