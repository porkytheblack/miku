/**
 * useHighlightManagerV2 Hook
 *
 * React hook that integrates all highlight-v2 modules for use in React components.
 * Provides state management, suggestion handling, and undo/redo functionality.
 *
 * Based on RFC-001 specifications.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { LineMap } from '@/lib/textPosition';

import {
  // Types
  SuggestionHighlight,
  PositionedSuggestion,
  toPositionedSuggestion,
  SuggestionNotFoundError,

  // State machines
  HighlightManagerState,
  HighlightManagerEvent,
  highlightManagerTransition,
  canInteractWithSuggestions,
  isBusy,

  // Store
  SuggestionStoreState,
  SuggestionStoreAction,
  createInitialState,
  suggestionStoreReducer,
  selectAllSuggestions,
  selectActiveSuggestion,
  selectSuggestionById,
  selectSuggestionCount,
  selectSuggestionAtPoint,

  // Commands
  UndoManager,
  createUndoManager,
  createAcceptSuggestionCommand,
  createDismissSuggestionCommand,
  createDismissAllSuggestionsCommand,

  // Feature flags
  isDebugEnabled,
  debugLog,
} from '@/lib/highlight-v2';

/**
 * Options for the useHighlightManagerV2 hook.
 */
export interface UseHighlightManagerV2Options {
  /** Function to get the current document content */
  getContent: () => string;
  /** Function to update the document content */
  setContent: (content: string) => void;
  /** Maximum undo stack size */
  maxUndoSize?: number;
  /** Callback when manager state changes */
  onStateChange?: (state: HighlightManagerState) => void;
  /** Callback when suggestions change */
  onSuggestionsChange?: (suggestions: readonly SuggestionHighlight[]) => void;
  /** Callback when active suggestion changes */
  onActiveSuggestionChange?: (suggestion: SuggestionHighlight | null) => void;
}

/**
 * State returned by the useHighlightManagerV2 hook.
 */
export interface HighlightManagerV2State {
  /** Current manager state (IDLE, REVIEWING, etc.) */
  managerState: HighlightManagerState;
  /** All suggestions as positioned suggestions (with line/column) */
  suggestions: readonly PositionedSuggestion[];
  /** Currently active (focused) suggestion */
  activeSuggestion: PositionedSuggestion | null;
  /** Number of suggestions */
  suggestionCount: number;
  /** Whether the manager is busy (reviewing or applying) */
  isBusy: boolean;
  /** Whether suggestions can be interacted with */
  canInteract: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Actions returned by the useHighlightManagerV2 hook.
 */
export interface HighlightManagerV2Actions {
  /** Request a new review of the document */
  requestReview: () => void;
  /** Set the review results (called by the AI integration) */
  setReviewResults: (suggestions: readonly SuggestionHighlight[]) => void;
  /** Report a review failure */
  setReviewError: (error: string) => void;
  /** Accept a suggestion (applies it to the document) */
  acceptSuggestion: (id: string) => void;
  /** Dismiss a suggestion without applying it */
  dismissSuggestion: (id: string) => void;
  /** Dismiss all suggestions */
  dismissAllSuggestions: () => void;
  /** Set the active (focused) suggestion */
  setActiveSuggestion: (id: string | null) => void;
  /** Get suggestion at a specific point in the document */
  getSuggestionAtPoint: (point: number) => SuggestionHighlight | null;
  /** Clear all suggestions and reset to idle */
  clearAll: () => void;
  /** Undo the last action */
  undo: () => boolean;
  /** Redo the last undone action */
  redo: () => boolean;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Get description of the action that would be undone */
  getUndoDescription: () => string | null;
  /** Get description of the action that would be redone */
  getRedoDescription: () => string | null;
  /** Handle text changes in the document */
  handleTextChange: (editStart: number, deleteCount: number, insertLength: number) => void;
  /** Recover from error state */
  recover: () => void;
}

/**
 * Return type of the useHighlightManagerV2 hook.
 */
export type UseHighlightManagerV2Return = HighlightManagerV2State & HighlightManagerV2Actions;

/**
 * React hook for managing highlights with the v2 system.
 *
 * @param options - Configuration options
 * @returns State and actions for highlight management
 *
 * @example
 * ```tsx
 * const {
 *   suggestions,
 *   activeSuggestion,
 *   managerState,
 *   acceptSuggestion,
 *   dismissSuggestion,
 *   undo,
 *   redo,
 * } = useHighlightManagerV2({
 *   getContent: () => editorContent,
 *   setContent: (content) => setEditorContent(content),
 * });
 * ```
 */
export function useHighlightManagerV2(
  options: UseHighlightManagerV2Options
): UseHighlightManagerV2Return {
  const {
    getContent,
    setContent,
    maxUndoSize = 100,
    onStateChange,
    onSuggestionsChange,
    onActiveSuggestionChange,
  } = options;

  // Manager state
  const [managerState, setManagerState] = useState<HighlightManagerState>('IDLE');
  const [error, setError] = useState<string | null>(null);

  // Store state
  const [storeState, setStoreState] = useState<SuggestionStoreState>(createInitialState);

  // Undo manager (created once)
  const undoManagerRef = useRef<UndoManager | null>(null);
  if (undoManagerRef.current === null) {
    undoManagerRef.current = createUndoManager({
      maxSize: maxUndoSize,
      onStateChange: () => {
        // Force re-render when undo/redo state changes
        forceUpdate();
      },
    });
  }
  const undoManager = undoManagerRef.current;

  // Force update helper
  const [, setUpdateCounter] = useState(0);
  const forceUpdate = useCallback(() => setUpdateCounter(c => c + 1), []);

  // Dispatch store action
  const dispatchStore = useCallback((action: SuggestionStoreAction) => {
    setStoreState(prevState => {
      const newState = suggestionStoreReducer(prevState, action);
      if (isDebugEnabled()) {
        debugLog('Store', `Action: ${action.type}`, { action, prevState, newState });
      }
      return newState;
    });
  }, []);

  // Dispatch manager event
  const dispatchManager = useCallback((event: HighlightManagerEvent) => {
    setManagerState(prevState => {
      const result = highlightManagerTransition(prevState, event);
      if (isDebugEnabled()) {
        debugLog('Manager', `Event: ${event.type}`, { event, prevState, result });
      }

      // Handle side effects
      for (const sideEffect of result.sideEffects) {
        if (isDebugEnabled()) {
          debugLog('Manager', `Side effect: ${sideEffect.type}`, sideEffect);
        }
        // Side effects would be processed here if needed
      }

      // Handle error state
      if (event.type === 'REVIEW_FAILED') {
        setError(event.error);
      } else if (result.state !== 'ERROR') {
        setError(null);
      }

      return result.state;
    });
  }, []);

  // Convert suggestions to positioned suggestions with line/column info
  const positionedSuggestions = useMemo((): readonly PositionedSuggestion[] => {
    const suggestions = selectAllSuggestions(storeState);
    if (suggestions.length === 0) {
      return [];
    }

    const content = getContent();
    const lineMap = new LineMap(content);

    return suggestions.map(suggestion => {
      const pos = lineMap.offsetToLineColumn(suggestion.range.start);
      return toPositionedSuggestion(suggestion, pos.line, pos.column);
    });
  }, [storeState, getContent]);

  // Get active suggestion as positioned
  const activeSuggestion = useMemo((): PositionedSuggestion | null => {
    const active = selectActiveSuggestion(storeState);
    if (!active) {
      return null;
    }

    const content = getContent();
    const lineMap = new LineMap(content);
    const pos = lineMap.offsetToLineColumn(active.range.start);
    return toPositionedSuggestion(active, pos.line, pos.column);
  }, [storeState, getContent]);

  // Callbacks for state change notifications
  useEffect(() => {
    onStateChange?.(managerState);
  }, [managerState, onStateChange]);

  useEffect(() => {
    onSuggestionsChange?.(selectAllSuggestions(storeState));
  }, [storeState, onSuggestionsChange]);

  useEffect(() => {
    onActiveSuggestionChange?.(selectActiveSuggestion(storeState));
  }, [storeState, onActiveSuggestionChange]);

  // ============================================================================
  // Actions
  // ============================================================================

  const requestReview = useCallback(() => {
    dispatchManager({ type: 'REQUEST_REVIEW' });
  }, [dispatchManager]);

  const setReviewResults = useCallback((suggestions: readonly SuggestionHighlight[]) => {
    dispatchStore({ type: 'SET_ALL', highlights: suggestions });
    dispatchManager({ type: 'REVIEW_COMPLETE', suggestions });
  }, [dispatchStore, dispatchManager]);

  const setReviewError = useCallback((errorMessage: string) => {
    dispatchManager({ type: 'REVIEW_FAILED', error: errorMessage });
  }, [dispatchManager]);

  const acceptSuggestion = useCallback((id: string) => {
    const suggestion = selectSuggestionById(storeState, id);
    if (!suggestion) {
      throw new SuggestionNotFoundError(id);
    }

    // Create and execute the command
    const command = createAcceptSuggestionCommand(
      suggestion,
      setContent,
      dispatchStore,
      getContent,
      storeState
    );

    dispatchManager({ type: 'ACCEPT_SUGGESTION', id });

    try {
      undoManager.execute(command);

      // After apply completes
      const remaining = selectSuggestionCount(suggestionStoreReducer(storeState, { type: 'REMOVE', id }));
      dispatchManager({ type: 'APPLY_COMPLETE', remainingSuggestions: remaining });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      dispatchManager({ type: 'REVIEW_FAILED', error: errorMessage });
    }
  }, [storeState, setContent, dispatchStore, getContent, dispatchManager, undoManager]);

  const dismissSuggestion = useCallback((id: string) => {
    const suggestion = selectSuggestionById(storeState, id);
    if (!suggestion) {
      throw new SuggestionNotFoundError(id);
    }

    // Create and execute the command
    const command = createDismissSuggestionCommand(
      suggestion,
      dispatchStore,
      storeState
    );

    undoManager.execute(command);

    // Update manager state based on remaining suggestions
    const newState = suggestionStoreReducer(storeState, { type: 'REMOVE', id });
    dispatchManager({
      type: 'SUGGESTIONS_UPDATED',
      remainingSuggestions: selectSuggestionCount(newState),
    });
  }, [storeState, dispatchStore, dispatchManager, undoManager]);

  const dismissAllSuggestions = useCallback(() => {
    if (selectSuggestionCount(storeState) === 0) {
      return;
    }

    const command = createDismissAllSuggestionsCommand(dispatchStore, storeState);
    undoManager.execute(command);

    dispatchManager({ type: 'CLEAR_ALL' });
  }, [storeState, dispatchStore, dispatchManager, undoManager]);

  const setActiveSuggestionAction = useCallback((id: string | null) => {
    dispatchStore({ type: 'SET_ACTIVE', id });
  }, [dispatchStore]);

  const getSuggestionAtPointAction = useCallback((point: number): SuggestionHighlight | null => {
    return selectSuggestionAtPoint(storeState, point);
  }, [storeState]);

  const clearAll = useCallback(() => {
    dispatchStore({ type: 'REMOVE_ALL' });
    dispatchManager({ type: 'CLEAR_ALL' });
    undoManager.clear();
  }, [dispatchStore, dispatchManager, undoManager]);

  const undo = useCallback((): boolean => {
    return undoManager.undo();
  }, [undoManager]);

  const redo = useCallback((): boolean => {
    return undoManager.redo();
  }, [undoManager]);

  const canUndo = useCallback((): boolean => {
    return undoManager.canUndo();
  }, [undoManager]);

  const canRedo = useCallback((): boolean => {
    return undoManager.canRedo();
  }, [undoManager]);

  const getUndoDescription = useCallback((): string | null => {
    return undoManager.getUndoDescription();
  }, [undoManager]);

  const getRedoDescription = useCallback((): string | null => {
    return undoManager.getRedoDescription();
  }, [undoManager]);

  const handleTextChange = useCallback((
    editStart: number,
    deleteCount: number,
    insertLength: number
  ) => {
    dispatchStore({
      type: 'APPLY_EDIT',
      editStart,
      deleteCount,
      insertLength,
    });

    dispatchManager({
      type: 'TEXT_CHANGED',
      editStart,
      deleteCount,
      insertLength,
    });

    // Check if any suggestions remain after the edit
    const newState = suggestionStoreReducer(storeState, {
      type: 'APPLY_EDIT',
      editStart,
      deleteCount,
      insertLength,
    });

    dispatchManager({
      type: 'SUGGESTIONS_UPDATED',
      remainingSuggestions: selectSuggestionCount(newState),
    });
  }, [storeState, dispatchStore, dispatchManager]);

  const recover = useCallback(() => {
    dispatchManager({ type: 'RECOVER' });
    setError(null);
  }, [dispatchManager]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    managerState,
    suggestions: positionedSuggestions,
    activeSuggestion,
    suggestionCount: selectSuggestionCount(storeState),
    isBusy: isBusy(managerState),
    canInteract: canInteractWithSuggestions(managerState),
    error,

    // Actions
    requestReview,
    setReviewResults,
    setReviewError,
    acceptSuggestion,
    dismissSuggestion,
    dismissAllSuggestions,
    setActiveSuggestion: setActiveSuggestionAction,
    getSuggestionAtPoint: getSuggestionAtPointAction,
    clearAll,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoDescription,
    getRedoDescription,
    handleTextChange,
    recover,
  };
}

/**
 * Hook for just the undo/redo state (for UI indicators).
 */
export function useUndoRedoState(
  manager: UseHighlightManagerV2Return
): {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
} {
  return {
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    undoDescription: manager.getUndoDescription(),
    redoDescription: manager.getRedoDescription(),
  };
}

export default useHighlightManagerV2;
