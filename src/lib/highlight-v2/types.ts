/**
 * Types Module
 *
 * Central type definitions for the highlight management system v2.
 * Based on RFC-001 Section 4.2.2 specifications.
 */

import { Range } from './Range';

/**
 * Categories of highlights with associated visual treatments.
 * Each category represents a different type of writing issue or annotation.
 */
export type HighlightCategory =
  | 'clarity'      // Yellow - confusing or unclear text
  | 'grammar'      // Red - grammatical errors
  | 'style'        // Blue - stylistic suggestions
  | 'structure'    // Purple - structural improvements
  | 'economy'      // Green - verbose text that can be shortened
  | 'search'       // Orange - search result matches (future)
  | 'selection';   // Gray - user selection (future)

/**
 * All valid highlight categories as an array for runtime validation.
 */
export const HIGHLIGHT_CATEGORIES: readonly HighlightCategory[] = [
  'clarity',
  'grammar',
  'style',
  'structure',
  'economy',
  'search',
  'selection',
] as const;

/**
 * Suggestion-specific categories (excludes search and selection).
 */
export type SuggestionCategory = Exclude<HighlightCategory, 'search' | 'selection'>;

/**
 * All valid suggestion categories as an array for runtime validation.
 */
export const SUGGESTION_CATEGORIES: readonly SuggestionCategory[] = [
  'clarity',
  'grammar',
  'style',
  'structure',
  'economy',
] as const;

/**
 * Type guard to check if a string is a valid HighlightCategory.
 */
export function isHighlightCategory(value: string): value is HighlightCategory {
  return HIGHLIGHT_CATEGORIES.includes(value as HighlightCategory);
}

/**
 * Type guard to check if a string is a valid SuggestionCategory.
 */
export function isSuggestionCategory(value: string): value is SuggestionCategory {
  return SUGGESTION_CATEGORIES.includes(value as SuggestionCategory);
}

/**
 * Priority determines which highlight "wins" when overlaps occur.
 * Higher priority highlights are displayed; lower priority are hidden.
 */
export type HighlightPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

/**
 * Numeric values for priority comparison.
 * Higher values indicate higher priority.
 */
export const PRIORITY_VALUES: Readonly<Record<HighlightPriority, number>> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  background: 0,
} as const;

/**
 * All valid priorities as an array for runtime validation.
 */
export const HIGHLIGHT_PRIORITIES: readonly HighlightPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'background',
] as const;

/**
 * Type guard to check if a string is a valid HighlightPriority.
 */
export function isHighlightPriority(value: string): value is HighlightPriority {
  return HIGHLIGHT_PRIORITIES.includes(value as HighlightPriority);
}

/**
 * Compares two priorities, returning which one takes precedence.
 *
 * @param a - First priority
 * @param b - Second priority
 * @returns Positive if a > b, negative if a < b, 0 if equal
 */
export function comparePriority(a: HighlightPriority, b: HighlightPriority): number {
  return PRIORITY_VALUES[a] - PRIORITY_VALUES[b];
}

/**
 * Base highlight without suggestion data.
 * Used for search results, selections, and other non-suggestion highlights.
 */
export interface Highlight {
  /** Unique identifier for the highlight */
  readonly id: string;
  /** The text range this highlight covers */
  readonly range: Range;
  /** The category/type of this highlight */
  readonly category: HighlightCategory;
  /** Priority for overlap resolution */
  readonly priority: HighlightPriority;
  /** Optional metadata for extensibility */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Extended highlight with suggestion data for AI-generated improvements.
 * Contains the original text, an explanation, and the suggested replacement.
 */
export interface SuggestionHighlight extends Highlight {
  /** The category is restricted to suggestion types */
  readonly category: SuggestionCategory;
  /** The exact text that this suggestion targets */
  readonly originalText: string;
  /** Explanation of why this text needs attention */
  readonly observation: string;
  /** The improved version of the text */
  readonly suggestedRevision: string;
  /** Confidence level 0-1, how confident the AI is in this suggestion */
  readonly confidence?: number;
}

/**
 * Type guard for suggestion highlights.
 * Checks if a highlight has the additional suggestion-specific fields.
 *
 * @param h - The highlight to check
 * @returns true if the highlight is a SuggestionHighlight
 */
export function isSuggestionHighlight(h: Highlight): h is SuggestionHighlight {
  return (
    'suggestedRevision' in h &&
    'originalText' in h &&
    'observation' in h &&
    typeof (h as SuggestionHighlight).suggestedRevision === 'string' &&
    typeof (h as SuggestionHighlight).originalText === 'string' &&
    typeof (h as SuggestionHighlight).observation === 'string'
  );
}

/**
 * Creates a unique ID for a suggestion.
 * Uses timestamp and random string for uniqueness.
 */
export function createSuggestionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `suggestion-${timestamp}-${random}`;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for highlight management errors.
 * All custom errors extend this class.
 */
export abstract class HighlightError extends Error {
  /** Unique error code for programmatic handling */
  abstract readonly code: string;
  /** Whether this error can be recovered from */
  abstract readonly recoverable: boolean;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a range fails validation.
 * This can happen when text at a position doesn't match expectations.
 */
export class RangeValidationError extends HighlightError {
  readonly code = 'RANGE_VALIDATION';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly range: Range,
    public readonly expectedText: string,
    public readonly actualText: string
  ) {
    super(message);
    this.name = 'RangeValidationError';
  }
}

/**
 * Error thrown when attempting to create overlapping highlights.
 * Contains information about which existing ranges conflict.
 */
export class OverlapError extends HighlightError {
  readonly code = 'OVERLAP';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly newRange: Range,
    public readonly existingRanges: readonly Range[]
  ) {
    super(message);
    this.name = 'OverlapError';
  }
}

/**
 * Error thrown when a tool execution fails.
 * Contains the tool name and parameters for debugging.
 */
export class ToolExecutionError extends HighlightError {
  readonly code = 'TOOL_EXECUTION';
  readonly recoverable: boolean;

  constructor(
    message: string,
    public readonly toolName: string,
    public readonly params: unknown,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    this.recoverable = recoverable;
  }
}

/**
 * Error thrown when an invalid state transition is attempted.
 * Indicates a programming error or unexpected state.
 */
export class StateTransitionError extends HighlightError {
  readonly code = 'STATE_TRANSITION';
  readonly recoverable = false;

  constructor(
    message: string,
    public readonly currentState: string,
    public readonly event: string
  ) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

/**
 * Error thrown when a suggestion is not found.
 */
export class SuggestionNotFoundError extends HighlightError {
  readonly code = 'SUGGESTION_NOT_FOUND';
  readonly recoverable = true;

  constructor(
    public readonly suggestionId: string
  ) {
    super(`Suggestion not found: ${suggestionId}`);
    this.name = 'SuggestionNotFoundError';
  }
}

/**
 * Error thrown when document content is invalid.
 */
export class DocumentError extends HighlightError {
  readonly code = 'DOCUMENT_ERROR';
  readonly recoverable = true;

  constructor(message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Represents a position in the document as line and column.
 * Both line and column are 1-indexed.
 */
export interface LineColumn {
  readonly line: number;
  readonly column: number;
}

/**
 * Represents a suggestion with position information for display.
 * Combines the SuggestionHighlight with computed line/column data.
 */
export interface PositionedSuggestion extends SuggestionHighlight {
  /** 1-indexed line number where the suggestion starts */
  readonly lineNumber: number;
  /** 1-indexed column number where the suggestion starts */
  readonly columnNumber: number;
}

/**
 * Converts a SuggestionHighlight to a PositionedSuggestion.
 *
 * @param suggestion - The suggestion to convert
 * @param lineNumber - The 1-indexed line number
 * @param columnNumber - The 1-indexed column number
 * @returns A PositionedSuggestion with line/column information
 */
export function toPositionedSuggestion(
  suggestion: SuggestionHighlight,
  lineNumber: number,
  columnNumber: number
): PositionedSuggestion {
  return {
    ...suggestion,
    lineNumber,
    columnNumber,
  };
}

/**
 * Statistics about a document for the AI context.
 */
export interface DocumentStats {
  readonly characterCount: number;
  readonly wordCount: number;
  readonly lineCount: number;
  readonly paragraphCount: number;
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly errors: readonly string[];
}
