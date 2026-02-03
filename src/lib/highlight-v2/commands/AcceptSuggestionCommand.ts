/**
 * Accept Suggestion Command Module
 *
 * Command for accepting a suggestion and applying it to the document.
 * Based on RFC-001 Section 4.6 specifications.
 */

import { BaseCommand, generateCommandId } from './Command';
import {
  SuggestionStoreState,
  SuggestionStoreAction,
} from '../SuggestionStore';
import { SuggestionHighlight } from '../types';

/**
 * Parameters for creating an AcceptSuggestionCommand.
 */
export interface AcceptSuggestionParams {
  /** The suggestion being accepted */
  readonly suggestion: SuggestionHighlight;
  /** Function to update the document content */
  readonly documentUpdater: (content: string) => void;
  /** Function to dispatch store actions */
  readonly storeUpdater: (action: SuggestionStoreAction) => void;
  /** Function to get the current document content */
  readonly getDocument: () => string;
  /** The previous store state for undo */
  readonly previousStoreState: SuggestionStoreState;
}

/**
 * Command for accepting a suggestion.
 * Replaces the original text with the suggested revision and updates the store.
 */
export class AcceptSuggestionCommand extends BaseCommand {
  readonly type = 'ACCEPT_SUGGESTION';
  readonly description: string;

  private suggestionId: string;
  private originalText: string;
  private revisedText: string;
  private position: number;
  private previousStoreState: SuggestionStoreState;
  private documentUpdater: (content: string) => void;
  private storeUpdater: (action: SuggestionStoreAction) => void;
  private getDocument: () => string;

  constructor(params: AcceptSuggestionParams) {
    super({ id: generateCommandId() });

    const { suggestion, documentUpdater, storeUpdater, getDocument, previousStoreState } = params;

    this.suggestionId = suggestion.id;
    this.originalText = suggestion.originalText;
    this.revisedText = suggestion.suggestedRevision;
    this.position = suggestion.range.start;
    this.previousStoreState = previousStoreState;
    this.documentUpdater = documentUpdater;
    this.storeUpdater = storeUpdater;
    this.getDocument = getDocument;

    // Create description with truncated text
    const maxTextLen = 30;
    const originalTruncated = truncateText(this.originalText, maxTextLen);
    const revisedTruncated = truncateText(this.revisedText, maxTextLen);
    this.description = `Accept suggestion: "${originalTruncated}" -> "${revisedTruncated}"`;
  }

  execute(): void {
    const doc = this.getDocument();

    // Verify the original text is still at the expected position
    const actualText = doc.slice(this.position, this.position + this.originalText.length);
    if (actualText !== this.originalText) {
      // Text has changed, try to find the new position
      const newPosition = findTextPosition(doc, this.originalText, this.position);
      if (newPosition === -1) {
        throw new Error(
          `Cannot accept suggestion: original text "${truncateText(this.originalText, 20)}" not found at expected position`
        );
      }
      this.position = newPosition;
    }

    // Apply the text change
    const newDoc = doc.slice(0, this.position) +
                   this.revisedText +
                   doc.slice(this.position + this.originalText.length);
    this.documentUpdater(newDoc);

    // Remove the accepted suggestion from the store
    this.storeUpdater({ type: 'REMOVE', id: this.suggestionId });

    // Adjust remaining suggestion positions
    const delta = this.revisedText.length - this.originalText.length;
    if (delta !== 0) {
      this.storeUpdater({
        type: 'APPLY_EDIT',
        editStart: this.position,
        deleteCount: this.originalText.length,
        insertLength: this.revisedText.length,
      });
    }
  }

  undo(): void {
    const doc = this.getDocument();

    // Find where the revised text is now (accounting for our previous edit)
    const revisedPosition = this.position; // Position shouldn't have changed since we made the edit
    const actualText = doc.slice(revisedPosition, revisedPosition + this.revisedText.length);

    if (actualText !== this.revisedText) {
      // Text has changed since we made the edit
      const newPosition = findTextPosition(doc, this.revisedText, this.position);
      if (newPosition === -1) {
        throw new Error(
          `Cannot undo: revised text "${truncateText(this.revisedText, 20)}" not found`
        );
      }
      // Even if text moved, restore at the found position
      const newDoc = doc.slice(0, newPosition) +
                     this.originalText +
                     doc.slice(newPosition + this.revisedText.length);
      this.documentUpdater(newDoc);
    } else {
      // Text is where expected, restore original
      const newDoc = doc.slice(0, this.position) +
                     this.originalText +
                     doc.slice(this.position + this.revisedText.length);
      this.documentUpdater(newDoc);
    }

    // Restore the previous store state
    this.storeUpdater({ type: 'RESTORE', state: this.previousStoreState });
  }

  /**
   * Gets the ID of the suggestion that was accepted.
   */
  getSuggestionId(): string {
    return this.suggestionId;
  }

  /**
   * Gets the original text that was replaced.
   */
  getOriginalText(): string {
    return this.originalText;
  }

  /**
   * Gets the revised text that was inserted.
   */
  getRevisedText(): string {
    return this.revisedText;
  }

  /**
   * Gets the position where the change was made.
   */
  getPosition(): number {
    return this.position;
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
 * Finds the position of text in a document, preferring positions close to the hint.
 *
 * @param doc - The document content
 * @param text - The text to find
 * @param positionHint - The expected position
 * @returns The position of the text, or -1 if not found
 */
function findTextPosition(doc: string, text: string, positionHint: number): number {
  // First, check at the hint position
  if (positionHint >= 0 && positionHint + text.length <= doc.length) {
    if (doc.slice(positionHint, positionHint + text.length) === text) {
      return positionHint;
    }
  }

  // Search expanding outward from the hint position
  const maxSearchDistance = 1000; // Characters to search in each direction

  // Search forward
  const forwardStart = Math.max(0, positionHint);
  const forwardEnd = Math.min(doc.length, positionHint + maxSearchDistance);
  const forwardIndex = doc.indexOf(text, forwardStart);
  if (forwardIndex !== -1 && forwardIndex < forwardEnd) {
    return forwardIndex;
  }

  // Search backward
  const backwardStart = Math.max(0, positionHint - maxSearchDistance);
  const backwardSearchArea = doc.slice(backwardStart, positionHint + text.length);
  const backwardIndex = backwardSearchArea.lastIndexOf(text);
  if (backwardIndex !== -1) {
    return backwardStart + backwardIndex;
  }

  // Global search as last resort
  const globalIndex = doc.indexOf(text);
  return globalIndex;
}

/**
 * Creates an AcceptSuggestionCommand from the necessary context.
 * Helper factory function.
 */
export function createAcceptSuggestionCommand(
  suggestion: SuggestionHighlight,
  documentUpdater: (content: string) => void,
  storeUpdater: (action: SuggestionStoreAction) => void,
  getDocument: () => string,
  currentStoreState: SuggestionStoreState
): AcceptSuggestionCommand {
  return new AcceptSuggestionCommand({
    suggestion,
    documentUpdater,
    storeUpdater,
    getDocument,
    previousStoreState: currentStoreState,
  });
}
