/**
 * Undo Manager Module
 *
 * Manages undo/redo stack with configurable limits.
 * Based on RFC-001 Section 4.6 specifications.
 */

import { Command, isEnhancedCommand } from './Command';

/**
 * Options for the UndoManager.
 */
export interface UndoManagerOptions {
  /** Maximum number of commands to keep in the undo stack */
  readonly maxSize?: number;
  /** Callback fired when a command is executed */
  readonly onExecute?: (command: Command) => void;
  /** Callback fired when a command is undone */
  readonly onUndo?: (command: Command) => void;
  /** Callback fired when a command is redone */
  readonly onRedo?: (command: Command) => void;
  /** Callback fired when the undo/redo state changes */
  readonly onStateChange?: () => void;
}

/**
 * Default options for the UndoManager.
 */
const DEFAULT_OPTIONS: Required<UndoManagerOptions> = {
  maxSize: 100,
  onExecute: () => {},
  onUndo: () => {},
  onRedo: () => {},
  onStateChange: () => {},
};

/**
 * State of the UndoManager.
 */
export interface UndoManagerState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDescription: string | null;
  readonly redoDescription: string | null;
  readonly undoStackSize: number;
  readonly redoStackSize: number;
}

/**
 * Manages undo/redo stack with configurable limits.
 */
export class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private options: Required<UndoManagerOptions>;
  private isExecuting: boolean = false;

  /**
   * Creates a new UndoManager.
   *
   * @param options - Configuration options
   */
  constructor(options: UndoManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Executes a command and adds it to the undo stack.
   *
   * @param command - The command to execute
   */
  execute(command: Command): void {
    if (this.isExecuting) {
      throw new Error('Cannot execute command while another command is executing');
    }

    this.isExecuting = true;
    try {
      command.execute();
      this.undoStack.push(command);
      this.redoStack = []; // Clear redo stack on new action

      // Trim if over limit
      while (this.undoStack.length > this.options.maxSize) {
        this.undoStack.shift();
      }

      this.options.onExecute(command);
      this.options.onStateChange();
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undoes the most recent command.
   *
   * @returns true if a command was undone, false if stack was empty
   */
  undo(): boolean {
    if (this.isExecuting) {
      throw new Error('Cannot undo while a command is executing');
    }

    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }

    this.isExecuting = true;
    try {
      command.undo();
      this.redoStack.push(command);

      this.options.onUndo(command);
      this.options.onStateChange();
      return true;
    } catch (error) {
      // If undo fails, put the command back on the undo stack
      this.undoStack.push(command);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redoes the most recently undone command.
   *
   * @returns true if a command was redone, false if redo stack was empty
   */
  redo(): boolean {
    if (this.isExecuting) {
      throw new Error('Cannot redo while a command is executing');
    }

    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }

    this.isExecuting = true;
    try {
      command.execute();
      this.undoStack.push(command);

      this.options.onRedo(command);
      this.options.onStateChange();
      return true;
    } catch (error) {
      // If redo fails, put the command back on the redo stack
      this.redoStack.push(command);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Checks if there are commands to undo.
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Checks if there are commands to redo.
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Gets the description of the command that would be undone.
   *
   * @returns The description, or null if no commands to undo
   */
  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Gets the description of the command that would be redone.
   *
   * @returns The description, or null if no commands to redo
   */
  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Clears both undo and redo stacks.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.options.onStateChange();
  }

  /**
   * Gets the current state of the undo manager.
   */
  getState(): UndoManagerState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.getUndoDescription(),
      redoDescription: this.getRedoDescription(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
    };
  }

  /**
   * Gets the size of the undo stack.
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Gets the size of the redo stack.
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Gets all commands in the undo stack (for inspection/debugging).
   * Returns a shallow copy to prevent external modification.
   */
  getUndoStack(): readonly Command[] {
    return [...this.undoStack];
  }

  /**
   * Gets all commands in the redo stack (for inspection/debugging).
   * Returns a shallow copy to prevent external modification.
   */
  getRedoStack(): readonly Command[] {
    return [...this.redoStack];
  }

  /**
   * Undoes multiple commands at once.
   *
   * @param count - Number of commands to undo
   * @returns Number of commands actually undone
   */
  undoMultiple(count: number): number {
    let undone = 0;
    for (let i = 0; i < count; i++) {
      if (!this.undo()) {
        break;
      }
      undone++;
    }
    return undone;
  }

  /**
   * Redoes multiple commands at once.
   *
   * @param count - Number of commands to redo
   * @returns Number of commands actually redone
   */
  redoMultiple(count: number): number {
    let redone = 0;
    for (let i = 0; i < count; i++) {
      if (!this.redo()) {
        break;
      }
      redone++;
    }
    return redone;
  }

  /**
   * Undoes commands until reaching one with a specific type.
   *
   * @param type - The command type to stop at (exclusive)
   * @returns Number of commands undone
   */
  undoUntilType(type: string): number {
    let undone = 0;
    while (this.canUndo()) {
      const nextCommand = this.undoStack[this.undoStack.length - 1];
      if (nextCommand.type === type) {
        break;
      }
      this.undo();
      undone++;
    }
    return undone;
  }

  /**
   * Undoes all commands in a specific group.
   * Only works with EnhancedCommands that have groupId.
   *
   * @param groupId - The group ID to undo
   * @returns Number of commands undone
   */
  undoGroup(groupId: string): number {
    let undone = 0;

    // Collect commands to undo
    const toUndo: number[] = [];
    for (let i = this.undoStack.length - 1; i >= 0; i--) {
      const cmd = this.undoStack[i];
      if (isEnhancedCommand(cmd) && cmd.groupId === groupId) {
        toUndo.push(i);
      }
    }

    // Undo from the most recent to the oldest
    // This requires undoing all commands up to each one in the group
    for (const targetIndex of toUndo) {
      // Undo commands until we reach the target
      while (this.undoStack.length > targetIndex + 1) {
        this.undo();
        undone++;
      }
      // Undo the target command
      this.undo();
      undone++;
    }

    return undone;
  }

  /**
   * Checks if currently executing a command.
   */
  isInProgress(): boolean {
    return this.isExecuting;
  }

  /**
   * Sets new options (merges with existing).
   */
  setOptions(options: Partial<UndoManagerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Creates a new UndoManager with default options.
 */
export function createUndoManager(options?: UndoManagerOptions): UndoManager {
  return new UndoManager(options);
}
