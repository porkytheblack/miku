/**
 * Dismiss Suggestion Command Module
 *
 * Command for dismissing (rejecting) a suggestion.
 * Based on RFC-001 Section 4.6 specifications.
 */

import { BaseCommand, generateCommandId } from './Command';
import {
  SuggestionStoreState,
  SuggestionStoreAction,
} from '../SuggestionStore';
import { SuggestionHighlight } from '../types';

/**
 * Parameters for creating a DismissSuggestionCommand.
 */
export interface DismissSuggestionParams {
  /** The suggestion being dismissed */
  readonly suggestion: SuggestionHighlight;
  /** Function to dispatch store actions */
  readonly storeUpdater: (action: SuggestionStoreAction) => void;
  /** The previous store state for undo */
  readonly previousStoreState: SuggestionStoreState;
}

/**
 * Command for dismissing a suggestion.
 * Removes the suggestion from the store without applying it.
 */
export class DismissSuggestionCommand extends BaseCommand {
  readonly type = 'DISMISS_SUGGESTION';
  readonly description: string;

  private suggestion: SuggestionHighlight;
  private previousStoreState: SuggestionStoreState;
  private storeUpdater: (action: SuggestionStoreAction) => void;

  constructor(params: DismissSuggestionParams) {
    super({ id: generateCommandId() });

    const { suggestion, storeUpdater, previousStoreState } = params;

    this.suggestion = suggestion;
    this.storeUpdater = storeUpdater;
    this.previousStoreState = previousStoreState;

    // Create description with truncated text
    const maxTextLen = 40;
    const textTruncated = truncateText(suggestion.originalText, maxTextLen);
    this.description = `Dismiss suggestion: "${textTruncated}"`;
  }

  execute(): void {
    // Remove the suggestion from the store
    this.storeUpdater({ type: 'REMOVE', id: this.suggestion.id });
  }

  undo(): void {
    // Restore the previous store state (which includes the suggestion)
    this.storeUpdater({ type: 'RESTORE', state: this.previousStoreState });
  }

  /**
   * Gets the suggestion that was dismissed.
   */
  getSuggestion(): SuggestionHighlight {
    return this.suggestion;
  }

  /**
   * Gets the ID of the suggestion that was dismissed.
   */
  getSuggestionId(): string {
    return this.suggestion.id;
  }
}

/**
 * Truncates text to a maximum length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Creates a DismissSuggestionCommand from the necessary context.
 * Helper factory function.
 */
export function createDismissSuggestionCommand(
  suggestion: SuggestionHighlight,
  storeUpdater: (action: SuggestionStoreAction) => void,
  currentStoreState: SuggestionStoreState
): DismissSuggestionCommand {
  return new DismissSuggestionCommand({
    suggestion,
    storeUpdater,
    previousStoreState: currentStoreState,
  });
}

/**
 * Command for dismissing all suggestions at once.
 */
export class DismissAllSuggestionsCommand extends BaseCommand {
  readonly type = 'DISMISS_ALL_SUGGESTIONS';
  readonly description: string;

  private previousStoreState: SuggestionStoreState;
  private storeUpdater: (action: SuggestionStoreAction) => void;
  private suggestionCount: number;

  constructor(params: {
    storeUpdater: (action: SuggestionStoreAction) => void;
    previousStoreState: SuggestionStoreState;
  }) {
    super({ id: generateCommandId() });

    const { storeUpdater, previousStoreState } = params;

    this.storeUpdater = storeUpdater;
    this.previousStoreState = previousStoreState;
    this.suggestionCount = previousStoreState.highlights.size;

    this.description = `Dismiss all ${this.suggestionCount} suggestion${this.suggestionCount === 1 ? '' : 's'}`;
  }

  execute(): void {
    // Remove all suggestions from the store
    this.storeUpdater({ type: 'REMOVE_ALL' });
  }

  undo(): void {
    // Restore the previous store state (which includes all suggestions)
    this.storeUpdater({ type: 'RESTORE', state: this.previousStoreState });
  }

  /**
   * Gets the number of suggestions that were dismissed.
   */
  getSuggestionCount(): number {
    return this.suggestionCount;
  }
}

/**
 * Creates a DismissAllSuggestionsCommand.
 * Helper factory function.
 */
export function createDismissAllSuggestionsCommand(
  storeUpdater: (action: SuggestionStoreAction) => void,
  currentStoreState: SuggestionStoreState
): DismissAllSuggestionsCommand {
  return new DismissAllSuggestionsCommand({
    storeUpdater,
    previousStoreState: currentStoreState,
  });
}
