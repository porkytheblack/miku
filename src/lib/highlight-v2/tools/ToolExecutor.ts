/**
 * Tool Executor Module
 *
 * Executes tool calls with validation and error handling.
 * Based on RFC-001 Section 4.5.3 specifications.
 */

import {
  ToolContext,
  ToolResult,
  ToolCall,
  ToolCallResult,
  toolFailure,
} from './types';
import { ToolRegistry, AnyToolDefinition } from './ToolRegistry';

/**
 * Options for the tool executor.
 */
export interface ToolExecutorOptions {
  /** Maximum time to wait for a tool execution (ms) */
  readonly timeoutMs?: number;
  /** Whether to continue batch execution on error */
  readonly continueOnError?: boolean;
  /** Callback for logging/monitoring tool executions */
  readonly onToolExecuted?: (result: ToolCallResult) => void;
}

/**
 * Default executor options.
 */
const DEFAULT_OPTIONS: Required<ToolExecutorOptions> = {
  timeoutMs: 30000, // 30 seconds
  continueOnError: true,
  onToolExecuted: () => {},
};

/**
 * Context provider function type.
 * Called before each tool execution to get the current context.
 */
export type ContextProvider = () => ToolContext;

/**
 * Executes tool calls with validation and error handling.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private contextProvider: ContextProvider;
  private options: Required<ToolExecutorOptions>;

  /**
   * Creates a new tool executor.
   *
   * @param registry - Registry of available tools
   * @param contextProvider - Function to get current tool context
   * @param options - Executor options
   */
  constructor(
    registry: ToolRegistry,
    contextProvider: ContextProvider,
    options: ToolExecutorOptions = {}
  ) {
    this.registry = registry;
    this.contextProvider = contextProvider;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Executes a single tool call.
   *
   * @param toolCall - The tool call to execute
   * @returns The execution result
   */
  async execute(toolCall: ToolCall): Promise<ToolCallResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeInternal(toolCall);
      const durationMs = Date.now() - startTime;

      const callResult: ToolCallResult = {
        callId: toolCall.id,
        toolName: toolCall.name,
        result,
        durationMs,
      };

      this.options.onToolExecuted(callResult);
      return callResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      const errorResult = toolFailure(
        error instanceof Error ? error.message : String(error),
        false,
        'EXECUTION_ERROR'
      );

      const callResult: ToolCallResult = {
        callId: toolCall.id,
        toolName: toolCall.name,
        result: errorResult,
        durationMs,
      };

      this.options.onToolExecuted(callResult);
      return callResult;
    }
  }

  /**
   * Internal execution logic with validation.
   */
  private async executeInternal(toolCall: ToolCall): Promise<ToolResult<unknown>> {
    const tool = this.registry.get(toolCall.name);

    if (!tool) {
      return toolFailure(
        `Unknown tool: ${toolCall.name}. Available tools: ${this.registry.getNames().join(', ')}`,
        false,
        'UNKNOWN_TOOL'
      );
    }

    // Validate parameters
    if (!tool.validate(toolCall.arguments)) {
      return toolFailure(
        `Invalid parameters for tool "${toolCall.name}": ${JSON.stringify(toolCall.arguments)}`,
        true,
        'INVALID_PARAMS'
      );
    }

    // Get current context
    const context = this.contextProvider();

    // Check for abort signal
    if (context.abortSignal?.aborted) {
      return toolFailure(
        'Tool execution was aborted',
        false,
        'ABORTED'
      );
    }

    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(
        tool,
        toolCall.arguments,
        context,
        this.options.timeoutMs
      );
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return toolFailure(
          'Tool execution was aborted',
          false,
          'ABORTED'
        );
      }
      if (error instanceof Error && error.message.includes('timeout')) {
        return toolFailure(
          `Tool execution timed out after ${this.options.timeoutMs}ms`,
          true,
          'TIMEOUT'
        );
      }
      throw error;
    }
  }

  /**
   * Executes a tool with a timeout.
   */
  private async executeWithTimeout(
    tool: AnyToolDefinition,
    params: Record<string, unknown>,
    context: ToolContext,
    timeoutMs: number
  ): Promise<ToolResult<unknown>> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const timeoutPromise = new Promise<never>((_, rej) => {
        timeoutId = setTimeout(() => {
          rej(new Error(`Tool execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const executionPromise = Promise.resolve(tool.execute(params, context));

      Promise.race([executionPromise, timeoutPromise])
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Executes multiple tool calls, collecting results.
   * By default, continues execution even if individual tools fail.
   *
   * @param toolCalls - Array of tool calls to execute
   * @returns Map of call ID to result
   */
  async executeBatch(
    toolCalls: readonly ToolCall[]
  ): Promise<Map<string, ToolCallResult>> {
    const results = new Map<string, ToolCallResult>();

    for (const call of toolCalls) {
      const result = await this.execute(call);
      results.set(call.id, result);

      // Check if we should stop on error
      if (!this.options.continueOnError && !result.result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Executes multiple tool calls in parallel.
   * Use with caution - tools may have side effects.
   *
   * @param toolCalls - Array of tool calls to execute
   * @returns Map of call ID to result
   */
  async executeParallel(
    toolCalls: readonly ToolCall[]
  ): Promise<Map<string, ToolCallResult>> {
    const promises = toolCalls.map(call => this.execute(call));
    const results = await Promise.all(promises);

    const resultMap = new Map<string, ToolCallResult>();
    for (const result of results) {
      resultMap.set(result.callId, result);
    }

    return resultMap;
  }

  /**
   * Validates a tool call without executing it.
   *
   * @param toolCall - The tool call to validate
   * @returns Validation result
   */
  validate(toolCall: ToolCall): { valid: boolean; error?: string } {
    const tool = this.registry.get(toolCall.name);

    if (!tool) {
      return {
        valid: false,
        error: `Unknown tool: ${toolCall.name}`,
      };
    }

    if (!tool.validate(toolCall.arguments)) {
      return {
        valid: false,
        error: `Invalid parameters for tool "${toolCall.name}"`,
      };
    }

    return { valid: true };
  }

  /**
   * Gets the registry being used by this executor.
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Updates the context provider.
   *
   * @param provider - New context provider function
   */
  setContextProvider(provider: ContextProvider): void {
    this.contextProvider = provider;
  }

  /**
   * Updates executor options.
   *
   * @param options - New options to merge with existing
   */
  setOptions(options: Partial<ToolExecutorOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Creates a tool executor with default registry and context provider.
 *
 * @param getContent - Function to get current document content
 * @param getStore - Function to get current store state
 * @param options - Executor options
 * @returns A new tool executor
 */
export function createToolExecutor(
  getContent: () => string,
  getStore: () => import('../SuggestionStore').SuggestionStoreState,
  options: ToolExecutorOptions = {}
): ToolExecutor {
  const { createDefaultToolRegistry } = require('./ToolRegistry');
  const { createToolContext } = require('./types');

  const registry = createDefaultToolRegistry();
  const contextProvider: ContextProvider = () => {
    return createToolContext(getContent(), getStore());
  };

  return new ToolExecutor(registry, contextProvider, options);
}

/**
 * Batch result statistics.
 */
export interface BatchResultStats {
  readonly total: number;
  readonly successful: number;
  readonly failed: number;
  readonly totalDurationMs: number;
  readonly averageDurationMs: number;
}

/**
 * Calculates statistics from batch execution results.
 *
 * @param results - Map of results from executeBatch
 * @returns Statistics about the batch execution
 */
export function calculateBatchStats(
  results: Map<string, ToolCallResult>
): BatchResultStats {
  const values = Array.from(results.values());
  const total = values.length;
  const successful = values.filter(r => r.result.success).length;
  const failed = total - successful;
  const totalDurationMs = values.reduce((sum, r) => sum + r.durationMs, 0);
  const averageDurationMs = total > 0 ? Math.round(totalDurationMs / total) : 0;

  return {
    total,
    successful,
    failed,
    totalDurationMs,
    averageDurationMs,
  };
}

/**
 * Extracts successful results from a batch execution.
 *
 * @param results - Map of results from executeBatch
 * @returns Array of successful results with their values
 */
export function extractSuccessfulResults(
  results: Map<string, ToolCallResult>
): Array<{ callId: string; toolName: string; value: unknown }> {
  const successful: Array<{ callId: string; toolName: string; value: unknown }> = [];

  for (const [callId, result] of results) {
    if (result.result.success) {
      successful.push({
        callId,
        toolName: result.toolName,
        value: result.result.value,
      });
    }
  }

  return successful;
}

/**
 * Extracts failed results from a batch execution.
 *
 * @param results - Map of results from executeBatch
 * @returns Array of failed results with their errors
 */
export function extractFailedResults(
  results: Map<string, ToolCallResult>
): Array<{ callId: string; toolName: string; error: string; recoverable: boolean }> {
  const failed: Array<{ callId: string; toolName: string; error: string; recoverable: boolean }> = [];

  for (const [callId, result] of results) {
    if (!result.result.success) {
      failed.push({
        callId,
        toolName: result.toolName,
        error: result.result.error,
        recoverable: result.result.recoverable,
      });
    }
  }

  return failed;
}
