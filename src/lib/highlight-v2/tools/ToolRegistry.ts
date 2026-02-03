/**
 * Tool Registry Module
 *
 * Registry for managing all available tools.
 * Based on RFC-001 Section 4.5.3 specifications.
 */

import {
  ToolDefinition,
  ToolParameters,
  ProviderToolFormat,
  toProviderFormat,
} from './types';

/**
 * Type for any tool definition (used for storage).
 */
export type AnyToolDefinition = ToolDefinition<string, ToolParameters, unknown>;

/**
 * Registry for all available tools.
 * Provides registration, lookup, and format conversion.
 */
export class ToolRegistry {
  /** Internal map of tool name to tool definition */
  private tools: Map<string, AnyToolDefinition> = new Map();

  /**
   * Creates a new empty registry.
   */
  constructor() {}

  /**
   * Registers a tool in the registry.
   *
   * @param tool - The tool definition to register
   * @throws Error if a tool with the same name is already registered
   */
  register<TName extends string, TParams extends ToolParameters, TResult>(
    tool: ToolDefinition<TName, TParams, TResult>
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as unknown as AnyToolDefinition);
  }

  /**
   * Registers multiple tools at once.
   *
   * @param tools - Array of tool definitions to register
   * @throws Error if any tool name is already registered
   */
  registerAll(tools: readonly AnyToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregisters a tool by name.
   *
   * @param name - The name of the tool to unregister
   * @returns true if the tool was unregistered, false if not found
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Gets a tool by name.
   *
   * @param name - The name of the tool to get
   * @returns The tool definition if found, undefined otherwise
   */
  get(name: string): AnyToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Checks if a tool is registered.
   *
   * @param name - The name of the tool to check
   * @returns true if the tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Gets all registered tools.
   *
   * @returns Array of all tool definitions
   */
  getAll(): AnyToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Gets all registered tool names.
   *
   * @returns Array of tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Gets the number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Returns tool definitions in the format expected by AI providers.
   * Compatible with OpenAI, Anthropic, and other major providers.
   *
   * @returns Array of provider-formatted tool definitions
   */
  toProviderFormat(): ProviderToolFormat[] {
    return this.getAll().map(tool => toProviderFormat(tool));
  }

  /**
   * Creates a subset registry with only the specified tools.
   *
   * @param names - Names of tools to include
   * @returns A new registry with only the specified tools
   */
  subset(names: readonly string[]): ToolRegistry {
    const subset = new ToolRegistry();
    for (const name of names) {
      const tool = this.get(name);
      if (tool) {
        subset.register(tool);
      }
    }
    return subset;
  }

  /**
   * Creates a copy of this registry.
   *
   * @returns A new registry with all the same tools
   */
  clone(): ToolRegistry {
    const cloned = new ToolRegistry();
    for (const tool of this.tools.values()) {
      cloned.register(tool);
    }
    return cloned;
  }

  /**
   * Clears all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Iterator for registered tools.
   */
  *[Symbol.iterator](): Iterator<AnyToolDefinition> {
    for (const tool of this.tools.values()) {
      yield tool;
    }
  }

  /**
   * Validates that all required tools are present.
   *
   * @param requiredNames - Names of tools that must be registered
   * @returns Object with valid status and any missing tool names
   */
  validateRequired(requiredNames: readonly string[]): {
    valid: boolean;
    missing: string[];
  } {
    const missing = requiredNames.filter(name => !this.has(name));
    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

// ============================================================================
// Default Registry Factory
// ============================================================================

import { highlightTextTool } from './highlightTextTool';
import { getLineContentTool } from './getLineContentTool';
import { getDocumentStatsTool } from './getDocumentStatsTool';
import { finishReviewTool } from './finishReviewTool';

/**
 * Creates a registry with all the default highlight management tools.
 *
 * @returns A new registry with default tools registered
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(highlightTextTool);
  registry.register(getLineContentTool);
  registry.register(getDocumentStatsTool);
  registry.register(finishReviewTool);

  return registry;
}

/**
 * List of default tool names.
 */
export const DEFAULT_TOOL_NAMES = [
  'highlight_text',
  'get_line_content',
  'get_document_stats',
  'finish_review',
] as const;

/**
 * Type for default tool names.
 */
export type DefaultToolName = (typeof DEFAULT_TOOL_NAMES)[number];

/**
 * Singleton default registry instance.
 * Use createDefaultToolRegistry() if you need a fresh instance.
 */
let defaultRegistryInstance: ToolRegistry | null = null;

/**
 * Gets the singleton default tool registry.
 * Creates it on first access.
 *
 * @returns The default tool registry
 */
export function getDefaultToolRegistry(): ToolRegistry {
  if (defaultRegistryInstance === null) {
    defaultRegistryInstance = createDefaultToolRegistry();
  }
  return defaultRegistryInstance;
}

/**
 * Resets the singleton default registry (useful for testing).
 */
export function resetDefaultToolRegistry(): void {
  defaultRegistryInstance = null;
}
