/**
 * Suggestion Store Module
 *
 * Immutable store for suggestions with efficient operations.
 * Supports transactional updates for undo/redo integration.
 *
 * Based on RFC-001 Section 4.2.4 specifications.
 *
 * Uses a Redux-like reducer pattern for predictable state updates.
 */

import { SuggestionHighlight } from './types';
import { RangeIndex } from './RangeIndex';

/**
 * The state shape for the suggestion store.
 * All properties are readonly to enforce immutability.
 */
export interface SuggestionStoreState {
  /** Index of all suggestions, sorted by position */
  readonly highlights: RangeIndex<SuggestionHighlight>;
  /** ID of the currently active (focused) suggestion, or null */
  readonly activeId: string | null;
  /** Version number, incremented on each change for cache invalidation */
  readonly version: number;
  /** IDs of suggestions that were rejected due to overlap during last SET_ALL */
  readonly lastRejectedIds: readonly string[];
}

/**
 * Actions that can be dispatched to the store.
 */
export type SuggestionStoreAction =
  | { type: 'SET_ALL'; highlights: readonly SuggestionHighlight[] }
  | { type: 'ADD'; highlight: SuggestionHighlight }
  | { type: 'REMOVE'; id: string }
  | { type: 'REMOVE_ALL' }
  | { type: 'SET_ACTIVE'; id: string | null }
  | { type: 'APPLY_EDIT'; editStart: number; deleteCount: number; insertLength: number }
  | { type: 'UPDATE_HIGHLIGHT'; id: string; updates: Partial<SuggestionHighlight> }
  | { type: 'RESTORE'; state: SuggestionStoreState };

/**
 * Creates the initial state for the suggestion store.
 *
 * @returns A new SuggestionStoreState with empty highlights
 */
export function createInitialState(): SuggestionStoreState {
  const result = RangeIndex.fromArray<SuggestionHighlight>([]);
  return {
    highlights: result.index,
    activeId: null,
    version: 0,
    lastRejectedIds: [],
  };
}

/**
 * Pure reducer for suggestion store state transitions.
 * Returns a new state object for any change (immutable updates).
 *
 * @param state - The current state
 * @param action - The action to apply
 * @returns The new state
 *
 * @example
 * const newState = suggestionStoreReducer(state, {
 *   type: 'SET_ALL',
 *   highlights: suggestions
 * });
 */
export function suggestionStoreReducer(
  state: SuggestionStoreState,
  action: SuggestionStoreAction
): SuggestionStoreState {
  switch (action.type) {
    case 'SET_ALL': {
      const result = RangeIndex.fromArray(action.highlights, 'keep-first');
      const rejectedIds = result.rejected.map(h => h.id);
      return {
        highlights: result.index,
        activeId: null,
        version: state.version + 1,
        lastRejectedIds: rejectedIds,
      };
    }

    case 'ADD': {
      try {
        const newHighlights = state.highlights.add(action.highlight);
        return {
          highlights: newHighlights,
          activeId: state.activeId,
          version: state.version + 1,
          lastRejectedIds: [],
        };
      } catch {
        // Overlap error - don't add the highlight
        return {
          ...state,
          lastRejectedIds: [action.highlight.id],
        };
      }
    }

    case 'REMOVE': {
      const newHighlights = state.highlights.clone();
      const wasRemoved = newHighlights.delete(action.id);

      if (!wasRemoved) {
        // ID not found, return unchanged
        return state;
      }

      return {
        highlights: newHighlights,
        activeId: state.activeId === action.id ? null : state.activeId,
        version: state.version + 1,
        lastRejectedIds: [],
      };
    }

    case 'REMOVE_ALL': {
      const emptyResult = RangeIndex.fromArray<SuggestionHighlight>([]);
      return {
        highlights: emptyResult.index,
        activeId: null,
        version: state.version + 1,
        lastRejectedIds: [],
      };
    }

    case 'SET_ACTIVE': {
      // Validate the ID exists if not null
      if (action.id !== null && !state.highlights.has(action.id)) {
        // Invalid ID, no change
        return state;
      }

      // If already active, no change needed
      if (state.activeId === action.id) {
        return state;
      }

      return {
        ...state,
        activeId: action.id,
        version: state.version + 1,
      };
    }

    case 'APPLY_EDIT': {
      const newHighlights = state.highlights.applyEdit(
        action.editStart,
        action.deleteCount,
        action.insertLength
      );

      // Clear active if it was removed during the edit
      const newActiveId = state.activeId && newHighlights.has(state.activeId)
        ? state.activeId
        : null;

      return {
        highlights: newHighlights,
        activeId: newActiveId,
        version: state.version + 1,
        lastRejectedIds: [],
      };
    }

    case 'UPDATE_HIGHLIGHT': {
      const existing = state.highlights.get(action.id);
      if (!existing) {
        // ID not found, no change
        return state;
      }

      // Create updated highlight
      const updated: SuggestionHighlight = {
        ...existing,
        ...action.updates,
        // Ensure id and range are not accidentally overwritten by invalid updates
        id: existing.id,
      };

      // If range is being updated, we need to rebuild the index
      if (action.updates.range && action.updates.range !== existing.range) {
        // Remove old and add new
        const newHighlights = state.highlights.clone();
        newHighlights.delete(action.id);

        try {
          const finalHighlights = newHighlights.add(updated);
          return {
            highlights: finalHighlights,
            activeId: state.activeId,
            version: state.version + 1,
            lastRejectedIds: [],
          };
        } catch {
          // New range overlaps - reject the update
          return state;
        }
      }

      // For non-range updates, we can update in place by rebuilding
      const allHighlights = state.highlights.getAll().map(h =>
        h.id === action.id ? updated : h
      );
      const result = RangeIndex.fromArray(allHighlights, 'keep-first');

      return {
        highlights: result.index,
        activeId: state.activeId,
        version: state.version + 1,
        lastRejectedIds: [],
      };
    }

    case 'RESTORE': {
      return action.state;
    }

    default: {
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = action;
      return state;
    }
  }
}

// ============================================================================
// Selector Functions
// ============================================================================

/**
 * Gets all suggestions as an array.
 */
export function selectAllSuggestions(state: SuggestionStoreState): readonly SuggestionHighlight[] {
  return state.highlights.getAll();
}

/**
 * Gets the active suggestion if one is selected.
 */
export function selectActiveSuggestion(state: SuggestionStoreState): SuggestionHighlight | null {
  if (state.activeId === null) {
    return null;
  }
  return state.highlights.get(state.activeId) ?? null;
}

/**
 * Gets a suggestion by ID.
 */
export function selectSuggestionById(
  state: SuggestionStoreState,
  id: string
): SuggestionHighlight | undefined {
  return state.highlights.get(id);
}

/**
 * Gets the number of suggestions.
 */
export function selectSuggestionCount(state: SuggestionStoreState): number {
  return state.highlights.size;
}

/**
 * Checks if a suggestion exists.
 */
export function selectHasSuggestion(state: SuggestionStoreState, id: string): boolean {
  return state.highlights.has(id);
}

/**
 * Gets the suggestion at a specific point in the document.
 */
export function selectSuggestionAtPoint(
  state: SuggestionStoreState,
  point: number
): SuggestionHighlight | null {
  const results = state.highlights.queryPoint(point);
  return results.length > 0 ? results[0] : null;
}

/**
 * Gets all suggestions that overlap with a range.
 */
export function selectSuggestionsInRange(
  state: SuggestionStoreState,
  start: number,
  end: number
): readonly SuggestionHighlight[] {
  return state.highlights.queryRange({ start, end });
}

/**
 * Gets the IDs of suggestions that were rejected in the last SET_ALL operation.
 */
export function selectRejectedIds(state: SuggestionStoreState): readonly string[] {
  return state.lastRejectedIds;
}

/**
 * Checks if there are any suggestions.
 */
export function selectHasAnySuggestions(state: SuggestionStoreState): boolean {
  return state.highlights.size > 0;
}

/**
 * Checks if a suggestion is currently active.
 */
export function selectIsActive(state: SuggestionStoreState, id: string): boolean {
  return state.activeId === id;
}

// ============================================================================
// Action Creators
// ============================================================================

/**
 * Creates a SET_ALL action.
 */
export function setAllSuggestions(
  highlights: readonly SuggestionHighlight[]
): SuggestionStoreAction {
  return { type: 'SET_ALL', highlights };
}

/**
 * Creates an ADD action.
 */
export function addSuggestion(highlight: SuggestionHighlight): SuggestionStoreAction {
  return { type: 'ADD', highlight };
}

/**
 * Creates a REMOVE action.
 */
export function removeSuggestion(id: string): SuggestionStoreAction {
  return { type: 'REMOVE', id };
}

/**
 * Creates a REMOVE_ALL action.
 */
export function removeAllSuggestions(): SuggestionStoreAction {
  return { type: 'REMOVE_ALL' };
}

/**
 * Creates a SET_ACTIVE action.
 */
export function setActiveSuggestion(id: string | null): SuggestionStoreAction {
  return { type: 'SET_ACTIVE', id };
}

/**
 * Creates an APPLY_EDIT action.
 */
export function applyEdit(
  editStart: number,
  deleteCount: number,
  insertLength: number
): SuggestionStoreAction {
  return { type: 'APPLY_EDIT', editStart, deleteCount, insertLength };
}

/**
 * Creates an UPDATE_HIGHLIGHT action.
 */
export function updateSuggestion(
  id: string,
  updates: Partial<SuggestionHighlight>
): SuggestionStoreAction {
  return { type: 'UPDATE_HIGHLIGHT', id, updates };
}

/**
 * Creates a RESTORE action.
 */
export function restoreState(state: SuggestionStoreState): SuggestionStoreAction {
  return { type: 'RESTORE', state };
}

// ============================================================================
// Store Class (for use outside React)
// ============================================================================

/**
 * Listener function type for state changes.
 */
export type StoreListener = (state: SuggestionStoreState) => void;

/**
 * A simple store wrapper for the reducer, useful for non-React contexts.
 */
export class SuggestionStore {
  private state: SuggestionStoreState;
  private listeners: Set<StoreListener> = new Set();

  constructor(initialState?: SuggestionStoreState) {
    this.state = initialState ?? createInitialState();
  }

  /**
   * Gets the current state.
   */
  getState(): SuggestionStoreState {
    return this.state;
  }

  /**
   * Dispatches an action and notifies listeners.
   */
  dispatch(action: SuggestionStoreAction): void {
    const newState = suggestionStoreReducer(this.state, action);
    if (newState !== this.state) {
      this.state = newState;
      this.notifyListeners();
    }
  }

  /**
   * Subscribes to state changes.
   *
   * @param listener - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies all listeners of a state change.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Creates a snapshot of the current state for undo operations.
   */
  snapshot(): SuggestionStoreState {
    return this.state;
  }

  /**
   * Restores a previous state snapshot.
   */
  restore(snapshot: SuggestionStoreState): void {
    this.dispatch(restoreState(snapshot));
  }
}

/**
 * Creates a new SuggestionStore instance.
 */
export function createSuggestionStore(
  initialState?: SuggestionStoreState
): SuggestionStore {
  return new SuggestionStore(initialState);
}
