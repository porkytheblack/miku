/**
 * Highlight Text Tool
 *
 * Tool for the AI to highlight a specific portion of text with a suggestion.
 * Based on RFC-001 Section 4.5.2 specifications.
 */

import { createRange } from '../Range';
import {
  SuggestionHighlight,
  SuggestionCategory,
  SUGGESTION_CATEGORIES,
  createSuggestionId,
} from '../types';
import {
  ToolDefinition,
  ToolParameters,
  ToolContext,
  ToolResult,
  toolSuccess,
  toolFailure,
  validators,
} from './types';

/**
 * Parameters for the highlight_text tool.
 */
export interface HighlightTextParams extends ToolParameters {
  /** The 1-indexed line number where the text begins */
  readonly line_number: number;
  /** The 0-indexed column where the highlight starts within the line */
  readonly start_column: number;
  /** The 0-indexed column where the highlight ends within the line */
  readonly end_column: number;
  /** The exact text being highlighted (must match document content) */
  readonly original_text: string;
  /** The category/type of the suggestion */
  readonly suggestion_type: SuggestionCategory;
  /** Explanation of why this text needs attention */
  readonly observation: string;
  /** The improved version of the text */
  readonly suggested_revision: string;
  /** Optional confidence level 0-1 */
  readonly confidence?: number;
}

/**
 * Validates the highlight_text parameters.
 */
function validateParams(params: unknown): params is HighlightTextParams {
  if (!validators.isObject(params)) {
    return false;
  }

  const p = params as Record<string, unknown>;

  // Required parameters
  if (!validators.isPositiveInteger(p.line_number)) {
    return false;
  }
  if (!validators.isNonNegativeInteger(p.start_column)) {
    return false;
  }
  if (!validators.isNonNegativeInteger(p.end_column)) {
    return false;
  }
  if (p.end_column <= p.start_column) {
    return false;
  }
  if (!validators.isNonEmptyString(p.original_text)) {
    return false;
  }
  if (!validators.isOneOf(p.suggestion_type, SUGGESTION_CATEGORIES)) {
    return false;
  }
  if (typeof p.observation !== 'string') {
    return false;
  }
  if (typeof p.suggested_revision !== 'string') {
    return false;
  }

  // Optional parameters
  if (p.confidence !== undefined && !validators.isNormalizedNumber(p.confidence)) {
    return false;
  }

  return true;
}

/**
 * Executes the highlight_text tool.
 */
function execute(
  params: HighlightTextParams,
  context: ToolContext
): ToolResult<SuggestionHighlight> {
  const { document } = context;
  const {
    line_number,
    start_column,
    end_column,
    original_text,
    suggestion_type,
    observation,
    suggested_revision,
    confidence,
  } = params;

  // Validate line number is within document bounds
  const lineIndex = line_number - 1;
  if (lineIndex < 0 || lineIndex >= document.lines.length) {
    return toolFailure(
      `Line ${line_number} does not exist. Document has ${document.lines.length} lines.`,
      true,
      'LINE_OUT_OF_BOUNDS'
    );
  }

  // Get the line content
  const lineContent = document.lines[lineIndex];

  // Validate column bounds
  if (start_column < 0 || start_column >= lineContent.length) {
    return toolFailure(
      `Start column ${start_column} is out of bounds. Line ${line_number} has ${lineContent.length} characters (0-${lineContent.length - 1}).`,
      true,
      'COLUMN_OUT_OF_BOUNDS'
    );
  }

  if (end_column > lineContent.length) {
    return toolFailure(
      `End column ${end_column} is out of bounds. Line ${line_number} has ${lineContent.length} characters.`,
      true,
      'COLUMN_OUT_OF_BOUNDS'
    );
  }

  // Calculate absolute offset from line start
  const lineStart = document.lineMap.lineColumnToOffset({
    line: line_number,
    column: 1,
  });
  const startOffset = lineStart + start_column;
  const endOffset = lineStart + end_column;

  // Validate the text matches at the specified position
  const actualText = document.content.slice(startOffset, endOffset);

  if (actualText !== original_text) {
    // Try to find the text on the same line
    const foundIndex = lineContent.indexOf(original_text);

    if (foundIndex === -1) {
      // Text not found on this line at all
      return toolFailure(
        `Text "${original_text}" not found at line ${line_number}, columns ${start_column}-${end_column}. ` +
        `Found "${actualText}" instead. ` +
        `The text also doesn't appear elsewhere on line ${line_number}.`,
        true,
        'TEXT_MISMATCH'
      );
    }

    // Text found at a different position on the same line
    // Create the highlight at the correct position
    const adjustedStart = lineStart + foundIndex;
    const adjustedEnd = adjustedStart + original_text.length;

    const highlight: SuggestionHighlight = {
      id: createSuggestionId(),
      range: createRange(adjustedStart, adjustedEnd),
      category: suggestion_type,
      priority: 'medium',
      originalText: original_text,
      observation,
      suggestedRevision: suggested_revision,
      confidence,
    };

    return toolSuccess(
      highlight,
      `Highlighted "${truncate(original_text, 30)}" at adjusted position ` +
      `(line ${line_number}, columns ${foundIndex}-${foundIndex + original_text.length}). ` +
      `Note: Original position was ${start_column}-${end_column}.`
    );
  }

  // Text matches at the specified position
  const highlight: SuggestionHighlight = {
    id: createSuggestionId(),
    range: createRange(startOffset, endOffset),
    category: suggestion_type,
    priority: 'medium',
    originalText: original_text,
    observation,
    suggestedRevision: suggested_revision,
    confidence,
  };

  return toolSuccess(
    highlight,
    `Highlighted "${truncate(original_text, 30)}" at line ${line_number}, columns ${start_column}-${end_column}.`
  );
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * The highlight_text tool definition.
 */
export const highlightTextTool: ToolDefinition<
  'highlight_text',
  HighlightTextParams,
  SuggestionHighlight
> = {
  name: 'highlight_text',

  description: `Highlight a specific portion of text with a suggestion for improvement.

Guidelines:
- line_number is 1-indexed (first line is 1)
- start_column and end_column are 0-indexed within the line
- original_text MUST exactly match the text at the specified position
- suggestion_type must be one of: clarity, grammar, style, structure, economy
- observation explains WHY the text needs attention
- suggested_revision is the improved version of the text
- confidence (optional) is 0-1 indicating how confident you are

The tool will attempt to find the text if the columns are slightly off, but the
original_text must appear somewhere on the specified line.`,

  parameters: {
    type: 'object',
    properties: {
      line_number: {
        type: 'number',
        description: 'The 1-indexed line number where the text begins',
        minimum: 1,
      },
      start_column: {
        type: 'number',
        description: 'The 0-indexed column where the highlight starts within the line',
        minimum: 0,
      },
      end_column: {
        type: 'number',
        description: 'The 0-indexed column where the highlight ends within the line',
        minimum: 1,
      },
      original_text: {
        type: 'string',
        description: 'The exact text being highlighted (must match document content)',
        minLength: 1,
      },
      suggestion_type: {
        type: 'string',
        description: 'The category of suggestion',
        enum: SUGGESTION_CATEGORIES,
      },
      observation: {
        type: 'string',
        description: 'Explanation of why this text needs attention',
      },
      suggested_revision: {
        type: 'string',
        description: 'The improved version of the text',
      },
      confidence: {
        type: 'number',
        description: 'Confidence level 0-1 indicating how confident you are (optional)',
        minimum: 0,
        maximum: 1,
      },
    },
    required: [
      'line_number',
      'start_column',
      'end_column',
      'original_text',
      'suggestion_type',
      'observation',
      'suggested_revision',
    ],
  },

  validate: validateParams,
  execute,
};

/**
 * Helper function to create highlight params from common inputs.
 * Useful for testing and programmatic highlight creation.
 */
export function createHighlightParams(
  lineNumber: number,
  startColumn: number,
  endColumn: number,
  originalText: string,
  suggestionType: SuggestionCategory,
  observation: string,
  suggestedRevision: string,
  confidence?: number
): HighlightTextParams {
  return {
    line_number: lineNumber,
    start_column: startColumn,
    end_column: endColumn,
    original_text: originalText,
    suggestion_type: suggestionType,
    observation,
    suggested_revision: suggestedRevision,
    confidence,
  };
}
