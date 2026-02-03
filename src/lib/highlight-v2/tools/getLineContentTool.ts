/**
 * Get Line Content Tool
 *
 * Tool for the AI to retrieve the content of specific lines from the document.
 * Useful when the AI needs to verify text before creating a highlight.
 */

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
 * Result of getting line content.
 */
export interface LineContentResult {
  /** The requested line number */
  readonly lineNumber: number;
  /** The content of the line (without newline character) */
  readonly content: string;
  /** The length of the line in characters */
  readonly length: number;
  /** The starting offset of the line in the document */
  readonly startOffset: number;
  /** The ending offset of the line in the document */
  readonly endOffset: number;
}

/**
 * Parameters for the get_line_content tool.
 */
export interface GetLineContentParams extends ToolParameters {
  /** The 1-indexed line number to retrieve */
  readonly line_number: number;
  /** Optional: also get surrounding lines (e.g., 2 means get 2 lines before and after) */
  readonly context_lines?: number;
}

/**
 * Result when context lines are requested.
 */
export interface GetLineContentWithContextResult {
  /** The main line that was requested */
  readonly mainLine: LineContentResult;
  /** Lines before the main line (in order) */
  readonly before: readonly LineContentResult[];
  /** Lines after the main line (in order) */
  readonly after: readonly LineContentResult[];
}

/**
 * Union type for the possible results.
 */
export type GetLineContentResultType = LineContentResult | GetLineContentWithContextResult;

/**
 * Type guard for context result.
 */
export function isContextResult(
  result: GetLineContentResultType
): result is GetLineContentWithContextResult {
  return 'mainLine' in result;
}

/**
 * Validates the get_line_content parameters.
 */
function validateParams(params: unknown): params is GetLineContentParams {
  if (!validators.isObject(params)) {
    return false;
  }

  const p = params as Record<string, unknown>;

  if (!validators.isPositiveInteger(p.line_number)) {
    return false;
  }

  if (p.context_lines !== undefined && !validators.isNonNegativeInteger(p.context_lines)) {
    return false;
  }

  return true;
}

/**
 * Creates a LineContentResult for a specific line.
 */
function createLineResult(
  lineNumber: number,
  content: string,
  lineMap: { lineColumnToOffset: (pos: { line: number; column: number }) => number }
): LineContentResult {
  const startOffset = lineMap.lineColumnToOffset({ line: lineNumber, column: 1 });
  const endOffset = startOffset + content.length;

  return {
    lineNumber,
    content,
    length: content.length,
    startOffset,
    endOffset,
  };
}

/**
 * Executes the get_line_content tool.
 */
function execute(
  params: GetLineContentParams,
  context: ToolContext
): ToolResult<GetLineContentResultType> {
  const { document } = context;
  const { line_number, context_lines } = params;

  // Validate line number is within document bounds
  const lineIndex = line_number - 1;
  if (lineIndex < 0 || lineIndex >= document.lines.length) {
    return toolFailure(
      `Line ${line_number} does not exist. Document has ${document.lines.length} lines.`,
      true,
      'LINE_OUT_OF_BOUNDS'
    );
  }

  const lineContent = document.lines[lineIndex];
  const mainLineResult = createLineResult(line_number, lineContent, document.lineMap);

  // If no context requested, return just the line
  if (context_lines === undefined || context_lines === 0) {
    return toolSuccess(
      mainLineResult,
      `Line ${line_number}: "${truncate(lineContent, 50)}" (${lineContent.length} chars)`
    );
  }

  // Get context lines
  const before: LineContentResult[] = [];
  const after: LineContentResult[] = [];

  // Get lines before
  for (let i = Math.max(1, line_number - context_lines); i < line_number; i++) {
    const content = document.lines[i - 1];
    before.push(createLineResult(i, content, document.lineMap));
  }

  // Get lines after
  for (let i = line_number + 1; i <= Math.min(document.lines.length, line_number + context_lines); i++) {
    const content = document.lines[i - 1];
    after.push(createLineResult(i, content, document.lineMap));
  }

  const result: GetLineContentWithContextResult = {
    mainLine: mainLineResult,
    before,
    after,
  };

  return toolSuccess(
    result,
    `Line ${line_number} with ${before.length} lines before and ${after.length} lines after`
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
 * The get_line_content tool definition.
 */
export const getLineContentTool: ToolDefinition<
  'get_line_content',
  GetLineContentParams,
  GetLineContentResultType
> = {
  name: 'get_line_content',

  description: `Retrieve the content of a specific line from the document.

Use this tool to:
- Verify the exact text before creating a highlight
- Get context around a line you're analyzing
- Check the length and position of text

Parameters:
- line_number: 1-indexed line number (first line is 1)
- context_lines: (optional) number of surrounding lines to include

Returns line content, length, and character offsets.`,

  parameters: {
    type: 'object',
    properties: {
      line_number: {
        type: 'number',
        description: 'The 1-indexed line number to retrieve',
        minimum: 1,
      },
      context_lines: {
        type: 'number',
        description: 'Optional: number of surrounding lines to include (e.g., 2 means 2 lines before and 2 after)',
        minimum: 0,
        maximum: 10,
      },
    },
    required: ['line_number'],
  },

  validate: validateParams,
  execute,
};
