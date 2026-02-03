/**
 * Suggestion State Machine Module
 *
 * Defines the formal state machine for individual suggestion lifecycle management.
 * Based on RFC-001 Section 4.3.1 specifications.
 *
 * State Diagram:
 *
 *                              +----------------+
 *                              |    PENDING     |
 *                              | (AI reviewing) |
 *                              +-------+--------+
 *                                      |
 *                      review_complete |
 *                                      v
 * +----------+  user_activates  +------+-------+  user_deactivates  +----------+
 * |          | <----------------+               +-------------------> |          |
 * |  ACTIVE  |                  |     READY     |                    | INACTIVE |
 * |          | ---------------> |               | <------------------ |          |
 * +----+-----+  user_deactivates+------+-------+  user_activates     +----+-----+
 *      |                               |                                  |
 *      | user_accepts                  | text_edit                        |
 *      v                               v                                  |
 * +----+-----+                  +------+-------+                          |
 * |          |                  |              |                          |
 * | ACCEPTED |                  |   ADJUSTED   |                          |
 * |          |                  |(positions moved)|                       |
 * +----+-----+                  +------+-------+                          |
 *      |                               |                                  |
 *      | text_applied                  | validation                       |
 *      v                               v                                  |
 * +----+------+                 +------+-------+                          |
 * |           |                 |   VALIDATED  |      text_changed_too_much
 * | COMPLETED |                 |(text still ok)| --------------------------+
 * |           |                 +--------------+                          |
 * +-----------+                        |                                  |
 *                                      | text_mismatch                    |
 *                                      v                                  |
 *                              +-------+------+                           |
 *                              |              | <-------------------------+
 *                              | INVALIDATED  |
 *                              |              |
 *                              +--------------+
 *
 *      user_dismisses (from any active state)
 *             |
 *             v
 *      +-----------+
 *      | DISMISSED |
 *      +-----------+
 */

import { StateTransitionError } from './types';

/**
 * All possible states a suggestion can be in.
 */
export type SuggestionState =
  | 'PENDING'      // AI is generating this suggestion
  | 'READY'        // Suggestion available, none selected
  | 'ACTIVE'       // User is viewing this specific suggestion
  | 'INACTIVE'     // Suggestion exists but not focused
  | 'ADJUSTED'     // Positions shifted due to text edit
  | 'VALIDATED'    // After adjustment, text still matches original
  | 'INVALIDATED'  // Text no longer matches suggestion
  | 'ACCEPTED'     // User accepted the suggestion
  | 'COMPLETED'    // Terminal state, suggestion fully applied
  | 'DISMISSED';   // User rejected the suggestion

/**
 * All possible events that can trigger state transitions.
 */
export type SuggestionEvent =
  | { type: 'REVIEW_COMPLETE' }
  | { type: 'USER_ACTIVATES' }
  | { type: 'USER_DEACTIVATES' }
  | { type: 'USER_ACCEPTS' }
  | { type: 'USER_DISMISSES' }
  | { type: 'TEXT_EDIT' }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'VALIDATION_FAILURE' }
  | { type: 'TEXT_APPLIED' }
  | { type: 'TEXT_CHANGED_TOO_MUCH' };

/**
 * Array of all valid suggestion states for runtime validation.
 */
export const SUGGESTION_STATES: readonly SuggestionState[] = [
  'PENDING',
  'READY',
  'ACTIVE',
  'INACTIVE',
  'ADJUSTED',
  'VALIDATED',
  'INVALIDATED',
  'ACCEPTED',
  'COMPLETED',
  'DISMISSED',
] as const;

/**
 * Array of all valid suggestion event types for runtime validation.
 */
export const SUGGESTION_EVENT_TYPES: readonly SuggestionEvent['type'][] = [
  'REVIEW_COMPLETE',
  'USER_ACTIVATES',
  'USER_DEACTIVATES',
  'USER_ACCEPTS',
  'USER_DISMISSES',
  'TEXT_EDIT',
  'VALIDATION_SUCCESS',
  'VALIDATION_FAILURE',
  'TEXT_APPLIED',
  'TEXT_CHANGED_TOO_MUCH',
] as const;

/**
 * Terminal states where no further transitions are allowed.
 */
export const TERMINAL_STATES: readonly SuggestionState[] = [
  'COMPLETED',
  'DISMISSED',
  'INVALIDATED',
] as const;

/**
 * States that represent an active, usable suggestion.
 */
export const ACTIVE_STATES: readonly SuggestionState[] = [
  'READY',
  'ACTIVE',
  'INACTIVE',
  'ADJUSTED',
  'VALIDATED',
] as const;

/**
 * Type guard to check if a state is terminal.
 */
export function isTerminalState(state: SuggestionState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Type guard to check if a state is active (suggestion is usable).
 */
export function isActiveState(state: SuggestionState): boolean {
  return ACTIVE_STATES.includes(state);
}

/**
 * Defines the valid transitions from each state.
 */
const STATE_TRANSITIONS: Record<SuggestionState, Partial<Record<SuggestionEvent['type'], SuggestionState>>> = {
  PENDING: {
    REVIEW_COMPLETE: 'READY',
    USER_DISMISSES: 'DISMISSED',
  },
  READY: {
    USER_ACTIVATES: 'ACTIVE',
    TEXT_EDIT: 'ADJUSTED',
    USER_DISMISSES: 'DISMISSED',
  },
  ACTIVE: {
    USER_DEACTIVATES: 'INACTIVE',
    USER_ACCEPTS: 'ACCEPTED',
    USER_DISMISSES: 'DISMISSED',
    TEXT_EDIT: 'ADJUSTED',
  },
  INACTIVE: {
    USER_ACTIVATES: 'ACTIVE',
    TEXT_EDIT: 'ADJUSTED',
    USER_DISMISSES: 'DISMISSED',
  },
  ADJUSTED: {
    VALIDATION_SUCCESS: 'VALIDATED',
    VALIDATION_FAILURE: 'INVALIDATED',
    TEXT_CHANGED_TOO_MUCH: 'INVALIDATED',
    USER_DISMISSES: 'DISMISSED',
  },
  VALIDATED: {
    USER_ACTIVATES: 'ACTIVE',
    USER_DEACTIVATES: 'INACTIVE',
    TEXT_EDIT: 'ADJUSTED',
    USER_DISMISSES: 'DISMISSED',
    USER_ACCEPTS: 'ACCEPTED',
  },
  INVALIDATED: {
    // Terminal state - no outgoing transitions
  },
  ACCEPTED: {
    TEXT_APPLIED: 'COMPLETED',
  },
  COMPLETED: {
    // Terminal state - no outgoing transitions
  },
  DISMISSED: {
    // Terminal state - no outgoing transitions
  },
};

/**
 * Pure function that computes the next state given current state and event.
 * Returns the same state if the transition is not valid (no-op).
 *
 * @param currentState - The current state of the suggestion
 * @param event - The event to process
 * @returns The next state
 *
 * @example
 * const nextState = suggestionTransition('READY', { type: 'USER_ACTIVATES' });
 * // nextState === 'ACTIVE'
 */
export function suggestionTransition(
  currentState: SuggestionState,
  event: SuggestionEvent
): SuggestionState {
  const transitions = STATE_TRANSITIONS[currentState];
  const nextState = transitions[event.type];

  if (nextState === undefined) {
    // No valid transition for this event from this state
    return currentState;
  }

  return nextState;
}

/**
 * Checks if a transition is valid from the current state.
 *
 * @param currentState - The current state
 * @param event - The event to check
 * @returns true if the transition is valid
 */
export function canTransition(
  currentState: SuggestionState,
  event: SuggestionEvent
): boolean {
  const transitions = STATE_TRANSITIONS[currentState];
  return event.type in transitions;
}

/**
 * Gets all valid events from a given state.
 *
 * @param state - The state to check
 * @returns Array of valid event types
 */
export function getValidEvents(state: SuggestionState): SuggestionEvent['type'][] {
  const transitions = STATE_TRANSITIONS[state];
  return Object.keys(transitions) as SuggestionEvent['type'][];
}

/**
 * Gets all possible next states from a given state.
 *
 * @param state - The state to check
 * @returns Array of possible next states
 */
export function getPossibleNextStates(state: SuggestionState): SuggestionState[] {
  const transitions = STATE_TRANSITIONS[state];
  return Object.values(transitions) as SuggestionState[];
}

/**
 * Interface for a suggestion with its current state.
 */
export interface SuggestionWithState {
  readonly id: string;
  readonly state: SuggestionState;
  readonly stateEnteredAt: number;
  readonly previousState: SuggestionState | null;
}

/**
 * Creates a new SuggestionWithState in the PENDING state.
 *
 * @param id - The suggestion ID
 * @returns A new SuggestionWithState
 */
export function createSuggestionState(id: string): SuggestionWithState {
  return {
    id,
    state: 'PENDING',
    stateEnteredAt: Date.now(),
    previousState: null,
  };
}

/**
 * Applies a state transition to a SuggestionWithState.
 * Returns a new object (immutable).
 *
 * @param suggestion - The current suggestion state
 * @param event - The event to apply
 * @returns A new SuggestionWithState with updated state
 */
export function applySuggestionTransition(
  suggestion: SuggestionWithState,
  event: SuggestionEvent
): SuggestionWithState {
  const nextState = suggestionTransition(suggestion.state, event);

  if (nextState === suggestion.state) {
    // No change
    return suggestion;
  }

  return {
    id: suggestion.id,
    state: nextState,
    stateEnteredAt: Date.now(),
    previousState: suggestion.state,
  };
}

/**
 * Validates that a state transition is allowed, throwing if not.
 *
 * @param currentState - The current state
 * @param event - The event to validate
 * @throws StateTransitionError if the transition is invalid
 */
export function validateTransition(
  currentState: SuggestionState,
  event: SuggestionEvent
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
 * Gets a human-readable description of a state.
 */
export function getStateDescription(state: SuggestionState): string {
  const descriptions: Record<SuggestionState, string> = {
    PENDING: 'AI is analyzing and generating this suggestion',
    READY: 'Suggestion is ready for review',
    ACTIVE: 'User is viewing this suggestion',
    INACTIVE: 'Suggestion exists but is not currently focused',
    ADJUSTED: 'Suggestion positions have been updated after a text edit',
    VALIDATED: 'Suggestion is still valid after adjustment',
    INVALIDATED: 'Suggestion is no longer valid due to text changes',
    ACCEPTED: 'User has accepted this suggestion',
    COMPLETED: 'Suggestion has been fully applied to the document',
    DISMISSED: 'User has dismissed this suggestion',
  };
  return descriptions[state];
}

/**
 * Gets a human-readable description of an event.
 */
export function getEventDescription(eventType: SuggestionEvent['type']): string {
  const descriptions: Record<SuggestionEvent['type'], string> = {
    REVIEW_COMPLETE: 'AI has finished generating the suggestion',
    USER_ACTIVATES: 'User clicked or focused on the suggestion',
    USER_DEACTIVATES: 'User clicked away or unfocused the suggestion',
    USER_ACCEPTS: 'User accepted the suggested change',
    USER_DISMISSES: 'User rejected the suggestion',
    TEXT_EDIT: 'Document text was edited',
    VALIDATION_SUCCESS: 'Suggestion text still matches after edit',
    VALIDATION_FAILURE: 'Suggestion text no longer matches after edit',
    TEXT_APPLIED: 'The suggested text change was applied to the document',
    TEXT_CHANGED_TOO_MUCH: 'The text changed too much to keep the suggestion',
  };
  return descriptions[eventType];
}

/**
 * Batch transition multiple suggestions with the same event.
 *
 * @param suggestions - Array of suggestions with state
 * @param event - The event to apply to all
 * @returns New array with updated states
 */
export function batchTransition(
  suggestions: readonly SuggestionWithState[],
  event: SuggestionEvent
): SuggestionWithState[] {
  return suggestions.map(s => applySuggestionTransition(s, event));
}

/**
 * Filters suggestions by their current state.
 *
 * @param suggestions - Array of suggestions
 * @param states - States to include
 * @returns Filtered array
 */
export function filterByState(
  suggestions: readonly SuggestionWithState[],
  states: readonly SuggestionState[]
): SuggestionWithState[] {
  return suggestions.filter(s => states.includes(s.state));
}

/**
 * Counts suggestions in each state.
 *
 * @param suggestions - Array of suggestions
 * @returns Record of state -> count
 */
export function countByState(
  suggestions: readonly SuggestionWithState[]
): Partial<Record<SuggestionState, number>> {
  const counts: Partial<Record<SuggestionState, number>> = {};
  for (const s of suggestions) {
    counts[s.state] = (counts[s.state] || 0) + 1;
  }
  return counts;
}
