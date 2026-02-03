/**
 * Finish Review Tool
 *
 * Tool for the AI to signal that it has completed its review.
 * Allows the AI to provide a summary and final status.
 */

import {
  ToolDefinition,
  ToolParameters,
  ToolContext,
  ToolResult,
  toolSuccess,
  validators,
} from './types';

/**
 * Result of finishing the review.
 */
export interface FinishReviewResult {
  /** Number of suggestions that were created */
  readonly suggestionCount: number;
  /** Optional summary provided by the AI */
  readonly summary: string | null;
  /** Whether the review completed successfully */
  readonly status: 'completed' | 'partial' | 'no_issues_found';
  /** Timestamp when the review was finished */
  readonly finishedAt: number;
}

/**
 * Parameters for the finish_review tool.
 */
export interface FinishReviewParams extends ToolParameters {
  /** Optional summary of the review findings */
  readonly summary?: string;
  /** Whether all issues were addressed or review was partial */
  readonly status?: 'completed' | 'partial' | 'no_issues_found';
}

/**
 * Validates the finish_review parameters.
 */
function validateParams(params: unknown): params is FinishReviewParams {
  if (params === undefined || params === null) {
    return true; // Empty params are valid
  }

  if (!validators.isObject(params)) {
    return false;
  }

  const p = params as Record<string, unknown>;

  // All parameters are optional
  if (p.summary !== undefined && typeof p.summary !== 'string') {
    return false;
  }

  if (p.status !== undefined) {
    const validStatuses = ['completed', 'partial', 'no_issues_found'] as const;
    if (!validators.isOneOf(p.status, validStatuses)) {
      return false;
    }
  }

  return true;
}

/**
 * Executes the finish_review tool.
 */
function execute(
  params: FinishReviewParams,
  context: ToolContext
): ToolResult<FinishReviewResult> {
  const { store } = context;
  const { summary, status } = params;

  const suggestionCount = store.highlights.size;

  // Determine status if not provided
  let finalStatus: FinishReviewResult['status'];
  if (status !== undefined) {
    finalStatus = status;
  } else if (suggestionCount === 0) {
    finalStatus = 'no_issues_found';
  } else {
    finalStatus = 'completed';
  }

  const result: FinishReviewResult = {
    suggestionCount,
    summary: summary ?? null,
    status: finalStatus,
    finishedAt: Date.now(),
  };

  // Create appropriate message based on status
  let message: string;
  switch (finalStatus) {
    case 'completed':
      message = `Review completed with ${suggestionCount} suggestion${suggestionCount === 1 ? '' : 's'}.`;
      break;
    case 'partial':
      message = `Partial review completed with ${suggestionCount} suggestion${suggestionCount === 1 ? '' : 's'}. Some areas may not have been fully analyzed.`;
      break;
    case 'no_issues_found':
      message = 'Review completed. No issues found in the document.';
      break;
  }

  if (summary) {
    message += ` Summary: ${summary}`;
  }

  return toolSuccess(result, message);
}

/**
 * The finish_review tool definition.
 */
export const finishReviewTool: ToolDefinition<
  'finish_review',
  FinishReviewParams,
  FinishReviewResult
> = {
  name: 'finish_review',

  description: `Signal that the document review is complete.

Call this tool when you have finished analyzing the document and creating all suggestions.

Parameters:
- summary: (optional) A brief summary of your findings
- status: (optional) 'completed', 'partial', or 'no_issues_found'

If status is not provided, it will be inferred:
- 'no_issues_found' if no suggestions were created
- 'completed' otherwise

Use status 'partial' if you weren't able to fully analyze the document (e.g., document was very long).`,

  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Optional summary of the review findings',
      },
      status: {
        type: 'string',
        description: 'Review completion status',
        enum: ['completed', 'partial', 'no_issues_found'],
      },
    },
    required: [],
  },

  validate: validateParams,
  execute,
};
