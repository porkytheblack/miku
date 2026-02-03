/**
 * Highlight Manager State Machine Module
 *
 * Defines the formal state machine for the overall highlight management system.
 * Based on RFC-001 Section 4.3.2 specifications.
 *
 * State Diagram:
 *
 *                    +-------+
 *                    | IDLE  | <--------------------+
 *                    +---+---+                      |
 *                        |                         |
 *           REQUEST_REVIEW|                        |
 *                        v                         |
 *                  +-----+-----+                   |
 *                  | REVIEWING |                   |
 *                  +-----+-----+                   |
 *                        |                         |
 *          +-------------+-------------+           |
 *          |             |             |           |
 *   REVIEW_COMPLETE  REVIEW_FAILED    |           |
 *   (no suggestions) (error)          |           |
 *          |             |             |           |
 *          v             v             |           |
 *        IDLE          ERROR           |           |
 *                        |             |           |
 *                    RECOVER           |           |
 *                        |             |           |
 *                        v             |           |
 *                      IDLE            |           |
 *                                      |           |
 *              REVIEW_COMPLETE         |           |
 *              (has suggestions)       |           |
 *                        |             |           |
 *                        v             |           |
 *              +---------+----------+  |           |
 *              | HAS_SUGGESTIONS    | <+           |
 *              +---------+----------+              |
 *                        |                         |
 *           +------------+------------+            |
 *           |            |            |            |
 *    ACCEPT_SUGGESTION   |    DISMISS_SUGGESTION   |
 *           |     CLEAR_ALL   (if more remain)     |
 *           |            |            |            |
 *           v            v            v            |
 *      +----+----+     IDLE    HAS_SUGGESTIONS     |
 *      | APPLYING |                               |
 *      +----+----+                                |
 *           |                                     |
 *    (complete)                                   |
 *           |                                     |
 *           +------> HAS_SUGGESTIONS or IDLE -----+
 */

import { SuggestionHighlight, StateTransitionError } from './types';

/**
 * States for the overall highlight management system.
 */
export type HighlightManagerState =
  | 'IDLE'            // No suggestions, ready for review
  | 'REVIEWING'       // AI is processing document
  | 'HAS_SUGGESTIONS' // Suggestions available
  | 'APPLYING'        // Currently applying a suggestion
  | 'ERROR';          // Error state, requires recovery

/**
 * Array of all valid manager states for runtime validation.
 */
export const MANAGER_STATES: readonly HighlightManagerState[] = [
  'IDLE',
  'REVIEWING',
  'HAS_SUGGESTIONS',
  'APPLYING',
  'ERROR',
] as const;

/**
 * Events that trigger state transitions.
 */
export type HighlightManagerEvent =
  | { type: 'REQUEST_REVIEW' }
  | { type: 'REVIEW_COMPLETE'; suggestions: readonly SuggestionHighlight[] }
  | { type: 'REVIEW_FAILED'; error: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string }
  | { type: 'DISMISS_SUGGESTION'; id: string }
  | { type: 'APPLY_COMPLETE'; remainingSuggestions: number }
  | { type: 'CLEAR_ALL' }
  | { type: 'TEXT_CHANGED'; editStart: number; deleteCount: number; insertLength: number }
  | { type: 'SUGGESTIONS_UPDATED'; remainingSuggestions: number }
  | { type: 'RECOVER' };

/**
 * Array of all valid manager event types for runtime validation.
 */
export const MANAGER_EVENT_TYPES: readonly HighlightManagerEvent['type'][] = [
  'REQUEST_REVIEW',
  'REVIEW_COMPLETE',
  'REVIEW_FAILED',
  'ACCEPT_SUGGESTION',
  'DISMISS_SUGGESTION',
  'APPLY_COMPLETE',
  'CLEAR_ALL',
  'TEXT_CHANGED',
  'SUGGESTIONS_UPDATED',
  'RECOVER',
] as const;

/**
 * Type guard to check if a value is a valid HighlightManagerState.
 */
export function isHighlightManagerState(value: string): value is HighlightManagerState {
  return MANAGER_STATES.includes(value as HighlightManagerState);
}

/**
 * Result of a state transition, including the new state and any side effect information.
 */
export interface TransitionResult {
  readonly state: HighlightManagerState;
  readonly sideEffects: readonly SideEffect[];
}

/**
 * Side effects that may need to be executed after a state transition.
 */
export type SideEffect =
  | { type: 'START_REVIEW' }
  | { type: 'CANCEL_REVIEW' }
  | { type: 'APPLY_SUGGESTION'; id: string }
  | { type: 'REMOVE_SUGGESTION'; id: string }
  | { type: 'CLEAR_ALL_SUGGESTIONS' }
  | { type: 'UPDATE_POSITIONS'; editStart: number; deleteCount: number; insertLength: number }
  | { type: 'LOG_ERROR'; error: string };

/**
 * Defines the valid transitions from each state.
 */
type TransitionTable = {
  [K in HighlightManagerState]: {
    [E in HighlightManagerEvent['type']]?: (event: Extract<HighlightManagerEvent, { type: E }>) => TransitionResult;
  };
};

/**
 * State machine transition table with computed side effects.
 */
const TRANSITIONS: TransitionTable = {
  IDLE: {
    REQUEST_REVIEW: () => ({
      state: 'REVIEWING',
      sideEffects: [{ type: 'START_REVIEW' }],
    }),
  },

  REVIEWING: {
    REVIEW_COMPLETE: (event) => {
      if (event.suggestions.length > 0) {
        return {
          state: 'HAS_SUGGESTIONS',
          sideEffects: [],
        };
      }
      return {
        state: 'IDLE',
        sideEffects: [],
      };
    },
    REVIEW_FAILED: (event) => ({
      state: 'ERROR',
      sideEffects: [{ type: 'LOG_ERROR', error: event.error }],
    }),
    // Allow canceling a review
    CLEAR_ALL: () => ({
      state: 'IDLE',
      sideEffects: [{ type: 'CANCEL_REVIEW' }],
    }),
  },

  HAS_SUGGESTIONS: {
    ACCEPT_SUGGESTION: (event) => ({
      state: 'APPLYING',
      sideEffects: [{ type: 'APPLY_SUGGESTION', id: event.id }],
    }),
    DISMISS_SUGGESTION: (event) => ({
      state: 'HAS_SUGGESTIONS', // Will be updated by SUGGESTIONS_UPDATED if empty
      sideEffects: [{ type: 'REMOVE_SUGGESTION', id: event.id }],
    }),
    SUGGESTIONS_UPDATED: (event) => ({
      state: event.remainingSuggestions > 0 ? 'HAS_SUGGESTIONS' : 'IDLE',
      sideEffects: [],
    }),
    CLEAR_ALL: () => ({
      state: 'IDLE',
      sideEffects: [{ type: 'CLEAR_ALL_SUGGESTIONS' }],
    }),
    TEXT_CHANGED: (event) => ({
      state: 'HAS_SUGGESTIONS', // Positions will be adjusted
      sideEffects: [{
        type: 'UPDATE_POSITIONS',
        editStart: event.editStart,
        deleteCount: event.deleteCount,
        insertLength: event.insertLength,
      }],
    }),
    REQUEST_REVIEW: () => ({
      state: 'REVIEWING',
      sideEffects: [{ type: 'CLEAR_ALL_SUGGESTIONS' }, { type: 'START_REVIEW' }],
    }),
  },

  APPLYING: {
    APPLY_COMPLETE: (event) => ({
      state: event.remainingSuggestions > 0 ? 'HAS_SUGGESTIONS' : 'IDLE',
      sideEffects: [],
    }),
    // Allow error recovery from applying state
    REVIEW_FAILED: (event) => ({
      state: 'ERROR',
      sideEffects: [{ type: 'LOG_ERROR', error: event.error }],
    }),
  },

  ERROR: {
    RECOVER: () => ({
      state: 'IDLE',
      sideEffects: [{ type: 'CLEAR_ALL_SUGGESTIONS' }],
    }),
    CLEAR_ALL: () => ({
      state: 'IDLE',
      sideEffects: [{ type: 'CLEAR_ALL_SUGGESTIONS' }],
    }),
  },
};

/**
 * Pure function that computes the next state and side effects given current state and event.
 * Returns the same state with no side effects if the transition is not valid.
 *
 * @param currentState - The current state of the manager
 * @param event - The event to process
 * @returns TransitionResult with new state and any side effects
 *
 * @example
 * const result = highlightManagerTransition('IDLE', { type: 'REQUEST_REVIEW' });
 * // result.state === 'REVIEWING'
 * // result.sideEffects === [{ type: 'START_REVIEW' }]
 */
export function highlightManagerTransition(
  currentState: HighlightManagerState,
  event: HighlightManagerEvent
): TransitionResult {
  const stateTransitions = TRANSITIONS[currentState];
  const transitionFn = stateTransitions[event.type as keyof typeof stateTransitions];

  if (!transitionFn) {
    // No valid transition for this event from this state
    return {
      state: currentState,
      sideEffects: [],
    };
  }

  // TypeScript needs help here with the event type narrowing
  return (transitionFn as (event: HighlightManagerEvent) => TransitionResult)(event);
}

/**
 * Simplified transition function that only returns the next state.
 * Useful when side effects are handled separately.
 *
 * @param currentState - The current state
 * @param event - The event to process
 * @returns The next state
 */
export function getNextState(
  currentState: HighlightManagerState,
  event: HighlightManagerEvent
): HighlightManagerState {
  return highlightManagerTransition(currentState, event).state;
}

/**
 * Checks if a transition is valid from the current state.
 *
 * @param currentState - The current state
 * @param event - The event to check
 * @returns true if the transition is valid
 */
export function canTransition(
  currentState: HighlightManagerState,
  event: HighlightManagerEvent
): boolean {
  const stateTransitions = TRANSITIONS[currentState];
  return event.type in stateTransitions;
}

/**
 * Validates that a state transition is allowed, throwing if not.
 *
 * @param currentState - The current state
 * @param event - The event to validate
 * @throws StateTransitionError if the transition is invalid
 */
export function validateTransition(
  currentState: HighlightManagerState,
  event: HighlightManagerEvent
): void {
  if (!canTransition(currentState, event)) {
    throw new StateTransitionError(
      `Invalid state transition: cannot apply ${event.type} from ${currentState}`,
      currentState,
      event.type
    );
  }
}

/**
 * Gets all valid event types from a given state.
 *
 * @param state - The state to check
 * @returns Array of valid event types
 */
export function getValidEvents(state: HighlightManagerState): HighlightManagerEvent['type'][] {
  const stateTransitions = TRANSITIONS[state];
  return Object.keys(stateTransitions) as HighlightManagerEvent['type'][];
}

/**
 * Gets a human-readable description of a state.
 */
export function getStateDescription(state: HighlightManagerState): string {
  const descriptions: Record<HighlightManagerState, string> = {
    IDLE: 'No active suggestions. Ready to start a review.',
    REVIEWING: 'AI is analyzing the document and generating suggestions.',
    HAS_SUGGESTIONS: 'Suggestions are available for review.',
    APPLYING: 'Applying a suggestion to the document.',
    ERROR: 'An error occurred. Recovery required.',
  };
  return descriptions[state];
}

/**
 * Checks if the manager is in a state where the user can interact with suggestions.
 */
export function canInteractWithSuggestions(state: HighlightManagerState): boolean {
  return state === 'HAS_SUGGESTIONS';
}

/**
 * Checks if the manager is in a state where a new review can be started.
 */
export function canStartReview(state: HighlightManagerState): boolean {
  return state === 'IDLE' || state === 'HAS_SUGGESTIONS';
}

/**
 * Checks if the manager is busy (reviewing or applying).
 */
export function isBusy(state: HighlightManagerState): boolean {
  return state === 'REVIEWING' || state === 'APPLYING';
}

/**
 * Checks if the manager is in an error state.
 */
export function isError(state: HighlightManagerState): boolean {
  return state === 'ERROR';
}

/**
 * Context object that holds the full state of the highlight manager.
 */
export interface HighlightManagerContext {
  readonly state: HighlightManagerState;
  readonly errorMessage: string | null;
  readonly isProcessing: boolean;
  readonly lastTransitionAt: number;
}

/**
 * Creates the initial context for the highlight manager.
 */
export function createInitialContext(): HighlightManagerContext {
  return {
    state: 'IDLE',
    errorMessage: null,
    isProcessing: false,
    lastTransitionAt: Date.now(),
  };
}

/**
 * Applies a transition to the context, returning a new context.
 *
 * @param context - The current context
 * @param event - The event to apply
 * @returns A new context with the updated state
 */
export function applyTransitionToContext(
  context: HighlightManagerContext,
  event: HighlightManagerEvent
): HighlightManagerContext {
  const result = highlightManagerTransition(context.state, event);

  // Extract error message if this is a failure event
  let errorMessage = context.errorMessage;
  if (event.type === 'REVIEW_FAILED') {
    errorMessage = event.error;
  } else if (result.state !== 'ERROR') {
    errorMessage = null;
  }

  return {
    state: result.state,
    errorMessage,
    isProcessing: result.state === 'REVIEWING' || result.state === 'APPLYING',
    lastTransitionAt: Date.now(),
  };
}
