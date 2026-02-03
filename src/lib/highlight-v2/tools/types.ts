/**
 * Tool Types Module
 *
 * Type-safe tool definitions for the AI agent tool call architecture.
 * Based on RFC-001 Section 4.5.1 specifications.
 */

import { LineMap } from '@/lib/textPosition';
import { SuggestionStoreState } from '../SuggestionStore';

/**
 * Base interface for all tool parameters.
 * Tools must define their parameters as an extension of this interface.
 */
export interface ToolParameters {
  readonly [key: string]: unknown;
}

/**
 * Schema type for a single parameter in a tool definition.
 */
export interface ParameterSchema {
  /** JSON Schema type */
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Human-readable description */
  readonly description: string;
  /** For string types, allowed values */
  readonly enum?: readonly string[];
  /** Whether this parameter is required */
  readonly required?: boolean;
  /** For number types, minimum value */
  readonly minimum?: number;
  /** For number types, maximum value */
  readonly maximum?: number;
  /** For string types, minimum length */
  readonly minLength?: number;
  /** For string types, maximum length */
  readonly maxLength?: number;
  /** For array types, item schema */
  readonly items?: ParameterSchema;
  /** Default value if not provided */
  readonly default?: unknown;
}

/**
 * Complete parameter schema for a tool.
 */
export interface ToolParameterSchema<TParams extends ToolParameters> {
  readonly type: 'object';
  readonly properties: {
    readonly [K in keyof TParams]: ParameterSchema;
  };
  readonly required: readonly (keyof TParams & string)[];
  /** Additional properties not defined in properties */
  readonly additionalProperties?: boolean;
}

/**
 * Context provided to tool execution.
 * Contains all information the tool needs to operate.
 */
export interface ToolContext {
  /** The document being analyzed */
  readonly document: DocumentContext;
  /** Current state of the suggestion store */
  readonly store: SuggestionStoreState;
  /** Optional abort signal for cancellation */
  readonly abortSignal?: AbortSignal;
}

/**
 * Document context with content and utilities.
 */
export interface DocumentContext {
  /** The full document content */
  readonly content: string;
  /** Document split into lines (without newlines) */
  readonly lines: readonly string[];
  /** LineMap for offset <-> line/column conversion */
  readonly lineMap: LineMap;
}

/**
 * Result wrapper for tool execution.
 * Discriminated union of success and failure cases.
 */
export type ToolResult<T> =
  | ToolResultSuccess<T>
  | ToolResultFailure;

/**
 * Successful tool execution result.
 */
export interface ToolResultSuccess<T> {
  readonly success: true;
  /** The result value */
  readonly value: T;
  /** Human-readable message describing what happened */
  readonly message: string;
}

/**
 * Failed tool execution result.
 */
export interface ToolResultFailure {
  readonly success: false;
  /** Error message */
  readonly error: string;
  /** Whether this error can be recovered from (e.g., retry with different params) */
  readonly recoverable: boolean;
  /** Optional error code for programmatic handling */
  readonly code?: string;
}

/**
 * Creates a successful tool result.
 */
export function toolSuccess<T>(value: T, message: string): ToolResultSuccess<T> {
  return { success: true, value, message };
}

/**
 * Creates a failed tool result.
 */
export function toolFailure(
  error: string,
  recoverable: boolean = true,
  code?: string
): ToolResultFailure {
  return { success: false, error, recoverable, code };
}

/**
 * Type guard for successful results.
 */
export function isToolSuccess<T>(result: ToolResult<T>): result is ToolResultSuccess<T> {
  return result.success === true;
}

/**
 * Type guard for failed results.
 */
export function isToolFailure<T>(result: ToolResult<T>): result is ToolResultFailure {
  return result.success === false;
}

/**
 * Generic tool definition with type-safe parameters.
 *
 * @typeParam TName - The unique tool name
 * @typeParam TParams - The parameter type
 * @typeParam TResult - The result value type
 */
export interface ToolDefinition<
  TName extends string,
  TParams extends ToolParameters,
  TResult
> {
  /** Unique identifier for the tool */
  readonly name: TName;
  /** Human-readable description of what the tool does */
  readonly description: string;
  /** JSON Schema for the parameters */
  readonly parameters: ToolParameterSchema<TParams>;
  /**
   * Validates that unknown input matches the expected parameter type.
   * Should perform runtime type checking.
   */
  readonly validate: (params: unknown) => params is TParams;
  /**
   * Executes the tool with the given parameters and context.
   * May be synchronous or asynchronous.
   */
  readonly execute: (
    params: TParams,
    context: ToolContext
  ) => ToolResult<TResult> | Promise<ToolResult<TResult>>;
}

/**
 * Type helper to extract the parameter type from a tool definition.
 */
export type ToolParams<T> = T extends ToolDefinition<string, infer P, unknown> ? P : never;

/**
 * Type helper to extract the result type from a tool definition.
 */
export type ToolReturnType<T> = T extends ToolDefinition<string, ToolParameters, infer R> ? R : never;

/**
 * Type helper to extract the name from a tool definition.
 */
export type ToolName<T> = T extends ToolDefinition<infer N, ToolParameters, unknown> ? N : never;

/**
 * A tool call from the AI provider.
 */
export interface ToolCall {
  /** Unique ID for this tool call (from the AI provider) */
  readonly id: string;
  /** Name of the tool to execute */
  readonly name: string;
  /** Arguments/parameters for the tool */
  readonly arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool call.
 */
export interface ToolCallResult {
  /** The original tool call ID */
  readonly callId: string;
  /** The tool name */
  readonly toolName: string;
  /** The execution result */
  readonly result: ToolResult<unknown>;
  /** Execution duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Format for sending tool definitions to AI providers.
 * Compatible with OpenAI, Anthropic, and other major providers.
 */
export interface ProviderToolFormat {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: 'object';
    readonly properties: Record<string, unknown>;
    readonly required: readonly string[];
  };
}

/**
 * Converts a ToolDefinition to provider format.
 */
export function toProviderFormat<
  TName extends string,
  TParams extends ToolParameters,
  TResult
>(tool: ToolDefinition<TName, TParams, TResult>): ProviderToolFormat {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.parameters.properties as Record<string, unknown>,
      required: tool.parameters.required,
    },
  };
}

/**
 * Validation helpers for common parameter types.
 */
export const validators = {
  /**
   * Validates that a value is a positive integer.
   */
  isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  },

  /**
   * Validates that a value is a non-negative integer.
   */
  isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  },

  /**
   * Validates that a value is a non-empty string.
   */
  isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  },

  /**
   * Validates that a value is a number between 0 and 1.
   */
  isNormalizedNumber(value: unknown): value is number {
    return typeof value === 'number' && value >= 0 && value <= 1;
  },

  /**
   * Validates that a value is one of the allowed strings.
   */
  isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && allowed.includes(value as T);
  },

  /**
   * Validates that a value is a plain object (not null, not array).
   */
  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  },

  /**
   * Validates that a value is an array.
   */
  isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  },

  /**
   * Validates optional parameters - returns true if undefined, otherwise runs validator.
   */
  isOptional<T>(value: unknown, validator: (v: unknown) => v is T): value is T | undefined {
    return value === undefined || validator(value);
  },
};

/**
 * Creates a document context from content.
 */
export function createDocumentContext(content: string): DocumentContext {
  const lineMap = new LineMap(content);
  const lines: string[] = [];

  const lineCount = lineMap.getLineCount();
  for (let i = 1; i <= lineCount; i++) {
    lines.push(lineMap.getLine(i));
  }

  return {
    content,
    lines,
    lineMap,
  };
}

/**
 * Creates a full tool context.
 */
export function createToolContext(
  content: string,
  store: SuggestionStoreState,
  abortSignal?: AbortSignal
): ToolContext {
  return {
    document: createDocumentContext(content),
    store,
    abortSignal,
  };
}
