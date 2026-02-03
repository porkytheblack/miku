/**
 * Get Document Stats Tool
 *
 * Tool for the AI to get statistics about the document.
 * Provides useful context for understanding document size and structure.
 */

import { DocumentStats } from '../types';
import {
  ToolDefinition,
  ToolParameters,
  ToolContext,
  ToolResult,
  toolSuccess,
  validators,
} from './types';

/**
 * Extended document statistics.
 */
export interface ExtendedDocumentStats extends DocumentStats {
  /** Average characters per line */
  readonly averageLineLength: number;
  /** Longest line length */
  readonly maxLineLength: number;
  /** Shortest line length (excluding empty lines) */
  readonly minLineLength: number;
  /** Number of empty lines */
  readonly emptyLineCount: number;
  /** Approximate reading time in minutes */
  readonly estimatedReadingTimeMinutes: number;
}

/**
 * Parameters for the get_document_stats tool.
 * Currently takes no parameters but defined for future extensibility.
 */
export interface GetDocumentStatsParams extends ToolParameters {
  /** Optional: include detailed line statistics */
  readonly include_line_details?: boolean;
}

/**
 * Validates the get_document_stats parameters.
 */
function validateParams(params: unknown): params is GetDocumentStatsParams {
  if (!validators.isObject(params)) {
    // Empty params object is valid
    return params === undefined || params === null || Object.keys(params as object).length === 0;
  }

  const p = params as Record<string, unknown>;

  // All parameters are optional
  if (p.include_line_details !== undefined && typeof p.include_line_details !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Counts words in text using a simple word boundary approach.
 */
function countWords(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  // Split on whitespace and filter out empty strings
  const words = text.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Counts paragraphs in text.
 * A paragraph is defined as a block of text separated by one or more blank lines.
 */
function countParagraphs(text: string): number {
  if (text.trim().length === 0) {
    return 0;
  }
  // Split on double newlines (or more) and filter out empty strings
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  return paragraphs.length;
}

/**
 * Executes the get_document_stats tool.
 */
function execute(
  params: GetDocumentStatsParams,
  context: ToolContext
): ToolResult<ExtendedDocumentStats> {
  const { document } = context;
  const { content, lines } = document;

  const characterCount = content.length;
  const wordCount = countWords(content);
  const lineCount = lines.length;
  const paragraphCount = countParagraphs(content);

  // Calculate line statistics
  let totalLineLength = 0;
  let maxLineLength = 0;
  let minLineLength = Infinity;
  let emptyLineCount = 0;

  for (const line of lines) {
    const length = line.length;
    totalLineLength += length;

    if (length === 0) {
      emptyLineCount++;
    } else {
      maxLineLength = Math.max(maxLineLength, length);
      minLineLength = Math.min(minLineLength, length);
    }
  }

  // Handle edge case where all lines are empty
  if (minLineLength === Infinity) {
    minLineLength = 0;
  }

  const averageLineLength = lineCount > 0 ? Math.round(totalLineLength / lineCount) : 0;

  // Estimate reading time (average 200-250 words per minute for prose)
  const wordsPerMinute = 225;
  const estimatedReadingTimeMinutes = Math.ceil(wordCount / wordsPerMinute);

  const stats: ExtendedDocumentStats = {
    characterCount,
    wordCount,
    lineCount,
    paragraphCount,
    averageLineLength,
    maxLineLength,
    minLineLength,
    emptyLineCount,
    estimatedReadingTimeMinutes,
  };

  return toolSuccess(
    stats,
    `Document: ${wordCount} words, ${lineCount} lines, ${paragraphCount} paragraphs (~${estimatedReadingTimeMinutes} min read)`
  );
}

/**
 * The get_document_stats tool definition.
 */
export const getDocumentStatsTool: ToolDefinition<
  'get_document_stats',
  GetDocumentStatsParams,
  ExtendedDocumentStats
> = {
  name: 'get_document_stats',

  description: `Get statistics about the document being analyzed.

Returns:
- characterCount: Total number of characters
- wordCount: Total number of words
- lineCount: Total number of lines
- paragraphCount: Number of paragraphs
- averageLineLength: Average characters per line
- maxLineLength: Longest line in characters
- minLineLength: Shortest non-empty line
- emptyLineCount: Number of empty lines
- estimatedReadingTimeMinutes: Approximate reading time

Use this tool at the start of a review to understand document size and structure.`,

  parameters: {
    type: 'object',
    properties: {
      include_line_details: {
        type: 'boolean',
        description: 'Include detailed line-by-line statistics (reserved for future use)',
        default: false,
      },
    },
    required: [],
  },

  validate: validateParams,
  execute,
};
