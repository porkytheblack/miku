'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type {
  KanbanDocument,
  KanbanColumn,
  KanbanCard,
  KanbanTask,
  KanbanMetadata,
  TaskState,
} from '@/types';
import {
  parseKanbanFile,
  serializeKanbanDocument,
  createEmptyDocument,
  createColumn,
  createCard,
  createTask,
} from '@/lib/kanbanParser';

// ============================================
// State Types
// ============================================

interface KanbanEditorState {
  document: KanbanDocument;
  editingCardId: string | null;  // Card being edited in modal
  isModified: boolean;
  hasLoaded: boolean;
}

// ============================================
// Action Types
// ============================================

type KanbanEditorAction =
  // Document loading
  | { type: 'LOAD_CONTENT'; content: string }
  | { type: 'LOAD_DOCUMENT'; document: KanbanDocument }

  // Column operations
  | { type: 'ADD_COLUMN'; title: string }
  | { type: 'UPDATE_COLUMN'; id: string; title: string }
  | { type: 'DELETE_COLUMN'; id: string }
  | { type: 'MOVE_COLUMN'; id: string; direction: 'left' | 'right' }

  // Card operations
  | { type: 'ADD_CARD'; columnId: string; card?: Partial<KanbanCard> }
  | { type: 'UPDATE_CARD'; id: string; updates: Partial<Omit<KanbanCard, 'id' | 'createdAt'>> }
  | { type: 'DELETE_CARD'; id: string }
  | { type: 'MOVE_CARD'; cardId: string; fromColumnId: string; toColumnId: string; toIndex: number }

  // Task operations
  | { type: 'ADD_TASK'; cardId: string; text: string }
  | { type: 'UPDATE_TASK'; cardId: string; taskId: string; updates: Partial<Omit<KanbanTask, 'id'>> }
  | { type: 'DELETE_TASK'; cardId: string; taskId: string }
  | { type: 'CYCLE_TASK_STATE'; cardId: string; taskId: string }

  // UI state
  | { type: 'SET_EDITING_CARD'; cardId: string | null }

  // Persistence
  | { type: 'MARK_SAVED' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<KanbanMetadata> };

// ============================================
// Helper Functions
// ============================================

/**
 * Find a card and its column in the document
 */
function findCardAndColumn(
  document: KanbanDocument,
  cardId: string
): { card: KanbanCard; column: KanbanColumn; cardIndex: number; columnIndex: number } | null {
  for (let colIdx = 0; colIdx < document.columns.length; colIdx++) {
    const column = document.columns[colIdx];
    const cardIdx = column.cards.findIndex(c => c.id === cardId);
    if (cardIdx !== -1) {
      return {
        card: column.cards[cardIdx],
        column,
        cardIndex: cardIdx,
        columnIndex: colIdx,
      };
    }
  }
  return null;
}

/**
 * Cycle through task states: todo -> in-progress -> done -> todo
 */
function cycleTaskState(current: TaskState): TaskState {
  switch (current) {
    case 'todo':
      return 'in-progress';
    case 'in-progress':
      return 'done';
    case 'done':
      return 'todo';
    default:
      return 'todo';
  }
}

// ============================================
// Reducer
// ============================================

function kanbanEditorReducer(state: KanbanEditorState, action: KanbanEditorAction): KanbanEditorState {
  switch (action.type) {
    case 'LOAD_CONTENT': {
      const parsed = parseKanbanFile(action.content);
      return {
        ...state,
        document: parsed,
        isModified: false,
        hasLoaded: true,
        editingCardId: null,
      };
    }

    case 'LOAD_DOCUMENT': {
      return {
        ...state,
        document: action.document,
        isModified: false,
        hasLoaded: true,
        editingCardId: null,
      };
    }

    // Column operations
    case 'ADD_COLUMN': {
      if (state.document.columns.length >= 10) {
        console.warn('Maximum 10 columns allowed');
        return state;
      }
      const newColumn = createColumn(action.title);
      return {
        ...state,
        document: {
          ...state.document,
          columns: [...state.document.columns, newColumn],
        },
        isModified: true,
      };
    }

    case 'UPDATE_COLUMN': {
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col =>
            col.id === action.id ? { ...col, title: action.title.slice(0, 50) } : col
          ),
        },
        isModified: true,
      };
    }

    case 'DELETE_COLUMN': {
      // Don't delete if it's the last column
      if (state.document.columns.length <= 1) {
        console.warn('Cannot delete the last column');
        return state;
      }
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.filter(col => col.id !== action.id),
        },
        isModified: true,
      };
    }

    case 'MOVE_COLUMN': {
      const columns = [...state.document.columns];
      const index = columns.findIndex(col => col.id === action.id);
      if (index === -1) return state;

      const newIndex = action.direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= columns.length) return state;

      // Swap columns
      [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];

      return {
        ...state,
        document: { ...state.document, columns },
        isModified: true,
      };
    }

    // Card operations
    case 'ADD_CARD': {
      const column = state.document.columns.find(col => col.id === action.columnId);
      if (!column) return state;
      if (column.cards.length >= 100) {
        console.warn('Maximum 100 cards per column');
        return state;
      }

      const newCard = createCard(action.card?.title || 'New Card');
      if (action.card?.description) newCard.description = action.card.description;
      if (action.card?.color) newCard.color = action.card.color;

      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col =>
            col.id === action.columnId
              ? { ...col, cards: [...col.cards, newCard] }
              : col
          ),
        },
        isModified: true,
        editingCardId: newCard.id, // Open the new card for editing
      };
    }

    case 'UPDATE_CARD': {
      const now = new Date().toISOString();
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.map(card =>
              card.id === action.id
                ? { ...card, ...action.updates, updatedAt: now }
                : card
            ),
          })),
        },
        isModified: true,
      };
    }

    case 'DELETE_CARD': {
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.filter(card => card.id !== action.id),
          })),
        },
        isModified: true,
        editingCardId: state.editingCardId === action.id ? null : state.editingCardId,
      };
    }

    case 'MOVE_CARD': {
      const { cardId, fromColumnId, toColumnId, toIndex } = action;
      const columns = [...state.document.columns];

      // Find source column
      const fromColIndex = columns.findIndex(col => col.id === fromColumnId);
      if (fromColIndex === -1) return state;

      // Find card in source column
      const cardIndex = columns[fromColIndex].cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return state;

      // Get the card and remove it from source
      const card = { ...columns[fromColIndex].cards[cardIndex], updatedAt: new Date().toISOString() };
      columns[fromColIndex] = {
        ...columns[fromColIndex],
        cards: columns[fromColIndex].cards.filter(c => c.id !== cardId),
      };

      // Find target column
      const toColIndex = columns.findIndex(col => col.id === toColumnId);
      if (toColIndex === -1) return state;

      // Insert into target column at the specified index
      const targetCards = [...columns[toColIndex].cards];
      targetCards.splice(Math.max(0, Math.min(toIndex, targetCards.length)), 0, card);
      columns[toColIndex] = {
        ...columns[toColIndex],
        cards: targetCards,
      };

      return {
        ...state,
        document: { ...state.document, columns },
        isModified: true,
      };
    }

    // Task operations
    case 'ADD_TASK': {
      const result = findCardAndColumn(state.document, action.cardId);
      if (!result) return state;
      if (result.card.tasks.length >= 20) {
        console.warn('Maximum 20 tasks per card');
        return state;
      }

      const newTask = createTask(action.text);
      const updatedCard = {
        ...result.card,
        tasks: [...result.card.tasks, newTask],
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.map(card =>
              card.id === action.cardId ? updatedCard : card
            ),
          })),
        },
        isModified: true,
      };
    }

    case 'UPDATE_TASK': {
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.map(card =>
              card.id === action.cardId
                ? {
                    ...card,
                    tasks: card.tasks.map(task =>
                      task.id === action.taskId
                        ? { ...task, ...action.updates }
                        : task
                    ),
                    updatedAt: new Date().toISOString(),
                  }
                : card
            ),
          })),
        },
        isModified: true,
      };
    }

    case 'DELETE_TASK': {
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.map(card =>
              card.id === action.cardId
                ? {
                    ...card,
                    tasks: card.tasks.filter(task => task.id !== action.taskId),
                    updatedAt: new Date().toISOString(),
                  }
                : card
            ),
          })),
        },
        isModified: true,
      };
    }

    case 'CYCLE_TASK_STATE': {
      return {
        ...state,
        document: {
          ...state.document,
          columns: state.document.columns.map(col => ({
            ...col,
            cards: col.cards.map(card =>
              card.id === action.cardId
                ? {
                    ...card,
                    tasks: card.tasks.map(task =>
                      task.id === action.taskId
                        ? { ...task, state: cycleTaskState(task.state) }
                        : task
                    ),
                    updatedAt: new Date().toISOString(),
                  }
                : card
            ),
          })),
        },
        isModified: true,
      };
    }

    // UI state
    case 'SET_EDITING_CARD': {
      return {
        ...state,
        editingCardId: action.cardId,
      };
    }

    // Persistence
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
// Context
// ============================================

interface KanbanEditorContextType {
  state: KanbanEditorState;
  // Loading
  loadContent: (content: string) => void;
  loadDocument: (document: KanbanDocument) => void;
  // Columns
  addColumn: (title: string) => void;
  updateColumn: (id: string, title: string) => void;
  deleteColumn: (id: string) => void;
  moveColumn: (id: string, direction: 'left' | 'right') => void;
  // Cards
  addCard: (columnId: string, card?: Partial<KanbanCard>) => void;
  updateCard: (id: string, updates: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>) => void;
  deleteCard: (id: string) => void;
  moveCard: (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => void;
  // Tasks
  addTask: (cardId: string, text: string) => void;
  updateTask: (cardId: string, taskId: string, updates: Partial<Omit<KanbanTask, 'id'>>) => void;
  deleteTask: (cardId: string, taskId: string) => void;
  cycleTaskState: (cardId: string, taskId: string) => void;
  // UI state
  setEditingCard: (cardId: string | null) => void;
  // Metadata
  updateMetadata: (metadata: Partial<KanbanMetadata>) => void;
  // Serialization
  getContent: () => string;
  markSaved: () => void;
  // Computed helpers
  getCardById: (cardId: string) => KanbanCard | null;
  getColumnForCard: (cardId: string) => KanbanColumn | null;
  getTotalCardCount: () => number;
}

const KanbanEditorContext = createContext<KanbanEditorContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

const initialState: KanbanEditorState = {
  document: createEmptyDocument(),
  editingCardId: null,
  isModified: false,
  hasLoaded: false,
};

export function KanbanEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(kanbanEditorReducer, initialState);

  // Loading
  const loadContent = useCallback((content: string) => {
    dispatch({ type: 'LOAD_CONTENT', content });
  }, []);

  const loadDocument = useCallback((document: KanbanDocument) => {
    dispatch({ type: 'LOAD_DOCUMENT', document });
  }, []);

  // Columns
  const addColumn = useCallback((title: string) => {
    dispatch({ type: 'ADD_COLUMN', title });
  }, []);

  const updateColumn = useCallback((id: string, title: string) => {
    dispatch({ type: 'UPDATE_COLUMN', id, title });
  }, []);

  const deleteColumn = useCallback((id: string) => {
    dispatch({ type: 'DELETE_COLUMN', id });
  }, []);

  const moveColumn = useCallback((id: string, direction: 'left' | 'right') => {
    dispatch({ type: 'MOVE_COLUMN', id, direction });
  }, []);

  // Cards
  const addCard = useCallback((columnId: string, card?: Partial<KanbanCard>) => {
    dispatch({ type: 'ADD_CARD', columnId, card });
  }, []);

  const updateCard = useCallback((id: string, updates: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>) => {
    dispatch({ type: 'UPDATE_CARD', id, updates });
  }, []);

  const deleteCard = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CARD', id });
  }, []);

  const moveCard = useCallback((cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => {
    dispatch({ type: 'MOVE_CARD', cardId, fromColumnId, toColumnId, toIndex });
  }, []);

  // Tasks
  const addTask = useCallback((cardId: string, text: string) => {
    dispatch({ type: 'ADD_TASK', cardId, text });
  }, []);

  const updateTask = useCallback((cardId: string, taskId: string, updates: Partial<Omit<KanbanTask, 'id'>>) => {
    dispatch({ type: 'UPDATE_TASK', cardId, taskId, updates });
  }, []);

  const deleteTask = useCallback((cardId: string, taskId: string) => {
    dispatch({ type: 'DELETE_TASK', cardId, taskId });
  }, []);

  const cycleTaskStateAction = useCallback((cardId: string, taskId: string) => {
    dispatch({ type: 'CYCLE_TASK_STATE', cardId, taskId });
  }, []);

  // UI state
  const setEditingCard = useCallback((cardId: string | null) => {
    dispatch({ type: 'SET_EDITING_CARD', cardId });
  }, []);

  // Metadata
  const updateMetadata = useCallback((metadata: Partial<KanbanMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', metadata });
  }, []);

  // Serialization
  const getContent = useCallback(() => {
    return serializeKanbanDocument(state.document);
  }, [state.document]);

  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);

  // Computed helpers
  const getCardById = useCallback((cardId: string): KanbanCard | null => {
    for (const column of state.document.columns) {
      const card = column.cards.find((c: KanbanCard) => c.id === cardId);
      if (card) return card;
    }
    return null;
  }, [state.document.columns]);

  const getColumnForCard = useCallback((cardId: string): KanbanColumn | null => {
    for (const column of state.document.columns) {
      if (column.cards.some((c: KanbanCard) => c.id === cardId)) {
        return column;
      }
    }
    return null;
  }, [state.document.columns]);

  const getTotalCardCount = useCallback((): number => {
    return state.document.columns.reduce((total: number, col: KanbanColumn) => total + col.cards.length, 0);
  }, [state.document.columns]);

  const value: KanbanEditorContextType = {
    state,
    loadContent,
    loadDocument,
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addTask,
    updateTask,
    deleteTask,
    cycleTaskState: cycleTaskStateAction,
    setEditingCard,
    updateMetadata,
    getContent,
    markSaved,
    getCardById,
    getColumnForCard,
    getTotalCardCount,
  };

  return (
    <KanbanEditorContext.Provider value={value}>
      {children}
    </KanbanEditorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useKanbanEditor() {
  const context = useContext(KanbanEditorContext);
  if (!context) {
    throw new Error('useKanbanEditor must be used within a KanbanEditorProvider');
  }
  return context;
}
