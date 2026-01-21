import { useState, useCallback } from 'react';

interface HistoryEntry<T> {
  state: T;
  timestamp: number;
}

interface UndoRedoState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => T | null;
  redo: () => T | null;
  push: (state: T) => void;
  clear: () => void;
}

/**
 * A generic undo/redo hook for managing state history
 * @param initialState - The initial state
 * @param maxHistory - Maximum number of history entries to keep (default: 100)
 */
export function useUndoRedo<T>(initialState: T, maxHistory = 100): UndoRedoState<T> {
  const [past, setPast] = useState<HistoryEntry<T>[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<HistoryEntry<T>[]>([]);

  const push = useCallback((newState: T) => {
    setPast(prev => {
      const entry = { state: present, timestamp: Date.now() };
      const newPast = [...prev, entry];
      // Keep only the last maxHistory entries
      if (newPast.length > maxHistory) {
        return newPast.slice(-maxHistory);
      }
      return newPast;
    });
    setPresent(newState);
    setFuture([]); // Clear future when new state is pushed
  }, [present, maxHistory]);

  const undo = useCallback((): T | null => {
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    setPast(newPast);
    setFuture([{ state: present, timestamp: Date.now() }, ...future]);
    setPresent(previous.state);

    return previous.state;
  }, [past, present, future]);

  const redo = useCallback((): T | null => {
    if (future.length === 0) return null;

    const next = future[0];
    const newFuture = future.slice(1);

    setPast([...past, { state: present, timestamp: Date.now() }]);
    setFuture(newFuture);
    setPresent(next.state);

    return next.state;
  }, [past, present, future]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    current: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    push,
    clear,
  };
}

/**
 * Specialized undo/redo for text content with revision tracking
 */
export interface TextRevision {
  id: string;
  originalText: string;
  revisedText: string;
  position: number;
}

interface TextUndoRedoState {
  content: string;
  canUndo: boolean;
  canRedo: boolean;
  acceptRevision: (content: string, revision: TextRevision) => string;
  undo: () => string | null;
  redo: () => string | null;
  setContent: (content: string, clearHistory?: boolean) => void;
}

export function useTextUndoRedo(initialContent: string): TextUndoRedoState {
  const [content, setContentState] = useState(initialContent);
  const [undoStack, setUndoStack] = useState<{ content: string; revision: TextRevision }[]>([]);
  const [redoStack, setRedoStack] = useState<{ content: string; revision: TextRevision }[]>([]);

  const acceptRevision = useCallback((newContent: string, revision: TextRevision): string => {
    setUndoStack(prev => [...prev, { content, revision }]);
    setRedoStack([]);
    setContentState(newContent);
    return newContent;
  }, [content]);

  const undo = useCallback((): string | null => {
    if (undoStack.length === 0) return null;

    const lastEntry = undoStack[undoStack.length - 1];
    const newContent = content.replace(
      lastEntry.revision.revisedText,
      lastEntry.revision.originalText
    );

    setRedoStack(prev => [...prev, { content, revision: lastEntry.revision }]);
    setUndoStack(prev => prev.slice(0, -1));
    setContentState(newContent);

    return newContent;
  }, [content, undoStack]);

  const redo = useCallback((): string | null => {
    if (redoStack.length === 0) return null;

    const lastEntry = redoStack[redoStack.length - 1];
    const newContent = content.replace(
      lastEntry.revision.originalText,
      lastEntry.revision.revisedText
    );

    setUndoStack(prev => [...prev, { content, revision: lastEntry.revision }]);
    setRedoStack(prev => prev.slice(0, -1));
    setContentState(newContent);

    return newContent;
  }, [content, redoStack]);

  const setContent = useCallback((newContent: string, clearHistory = false) => {
    if (clearHistory) {
      setUndoStack([]);
      setRedoStack([]);
    }
    setContentState(newContent);
  }, []);

  return {
    content,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    acceptRevision,
    undo,
    redo,
    setContent,
  };
}
