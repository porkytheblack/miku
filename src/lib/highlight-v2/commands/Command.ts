/**
 * Command Interface Module
 *
 * Defines the Command pattern interface for undo/redo operations.
 * Based on RFC-001 Section 4.6 specifications.
 */

/**
 * Command interface for undo/redo operations.
 * All commands must be able to execute and undo their operations.
 */
export interface Command {
  /**
   * Unique type identifier for the command.
   * Used for logging and debugging.
   */
  readonly type: string;

  /**
   * Human-readable description of what this command does.
   * Shown in UI for undo/redo actions.
   */
  readonly description: string;

  /**
   * Timestamp when the command was created.
   */
  readonly createdAt: number;

  /**
   * Executes the command.
   * This should apply the changes to the document and store.
   */
  execute(): void;

  /**
   * Undoes the command.
   * This should restore the state to before the command was executed.
   */
  undo(): void;
}

/**
 * Command with additional metadata for grouping and filtering.
 */
export interface EnhancedCommand extends Command {
  /**
   * Optional unique identifier for this specific command instance.
   */
  readonly id?: string;

  /**
   * Optional group identifier for grouping related commands.
   * Commands in the same group can be undone/redone together.
   */
  readonly groupId?: string;

  /**
   * Optional tags for filtering commands.
   */
  readonly tags?: readonly string[];
}

/**
 * Factory function type for creating commands.
 */
export type CommandFactory<TParams, TCommand extends Command> = (params: TParams) => TCommand;

/**
 * Base class for commands that provides common functionality.
 */
export abstract class BaseCommand implements EnhancedCommand {
  abstract readonly type: string;
  abstract readonly description: string;
  readonly createdAt: number;
  readonly id?: string;
  readonly groupId?: string;
  readonly tags?: readonly string[];

  constructor(options: {
    id?: string;
    groupId?: string;
    tags?: readonly string[];
  } = {}) {
    this.createdAt = Date.now();
    this.id = options.id;
    this.groupId = options.groupId;
    this.tags = options.tags;
  }

  abstract execute(): void;
  abstract undo(): void;
}

/**
 * Generates a unique command ID.
 */
export function generateCommandId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `cmd-${timestamp}-${random}`;
}

/**
 * Composite command that groups multiple commands together.
 * Executes all commands in order, undoes them in reverse order.
 */
export class CompositeCommand implements Command {
  readonly type = 'COMPOSITE';
  readonly description: string;
  readonly createdAt: number;
  private commands: readonly Command[];

  constructor(commands: readonly Command[], description?: string) {
    this.commands = commands;
    this.createdAt = Date.now();
    this.description = description ?? `${commands.length} grouped commands`;
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  /**
   * Gets the commands in this composite.
   */
  getCommands(): readonly Command[] {
    return this.commands;
  }
}

/**
 * Type guard for EnhancedCommand.
 */
export function isEnhancedCommand(cmd: Command): cmd is EnhancedCommand {
  return 'id' in cmd || 'groupId' in cmd || 'tags' in cmd;
}

/**
 * Type guard for CompositeCommand.
 */
export function isCompositeCommand(cmd: Command): cmd is CompositeCommand {
  return cmd.type === 'COMPOSITE' && 'getCommands' in cmd;
}
