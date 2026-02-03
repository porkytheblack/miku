/**
 * Parser and serializer for .kanban files
 * JSON-based format for SimpleKanban boards
 */

import type {
  KanbanDocument,
  KanbanColumn,
  KanbanCard,
  KanbanTask,
  KanbanMetadata,
  KanbanCardColor,
  TaskState,
} from '@/types';

const KANBAN_VERSION = '1.0';

/**
 * Generate a unique ID for kanban entities
 * Uses counter + timestamp + random string to ensure uniqueness
 */
let idCounter = 0;
export function generateId(prefix: 'col' | 'card' | 'task'): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${++idCounter}-${Date.now()}-${random}`;
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Create a new empty kanban document with default columns
 * Timestamps are omitted for idempotent serialization - they are added on save
 */
export function createEmptyDocument(): KanbanDocument {
  return {
    version: KANBAN_VERSION,
    metadata: {},
    columns: [
      { id: generateId('col'), title: 'To Do', cards: [] },
      { id: generateId('col'), title: 'In Progress', cards: [] },
      { id: generateId('col'), title: 'Done', cards: [] },
    ],
  };
}

/**
 * Create a new column with default values
 */
export function createColumn(title: string): KanbanColumn {
  return {
    id: generateId('col'),
    title: title.slice(0, 50), // Enforce max length
    cards: [],
  };
}

/**
 * Create a new card with default values
 */
export function createCard(title: string): KanbanCard {
  const now = new Date().toISOString();
  return {
    id: generateId('card'),
    title: title.slice(0, 200), // Enforce max length
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new task with default values
 */
export function createTask(text: string): KanbanTask {
  return {
    id: generateId('task'),
    text: text.slice(0, 500), // Enforce max length
    state: 'todo',
  };
}

/**
 * Validate and sanitize a task state
 */
function validateTaskState(state: unknown): TaskState {
  if (state === 'todo' || state === 'in-progress' || state === 'done') {
    return state;
  }
  return 'todo'; // Default to 'todo' for invalid states
}

/**
 * Valid card colors
 */
const VALID_COLORS: KanbanCardColor[] = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];

/**
 * Validate and parse a task object
 */
function parseTask(task: unknown, seenIds: Set<string>): KanbanTask | null {
  if (!task || typeof task !== 'object') return null;

  const t = task as Record<string, unknown>;

  // Require text field
  if (typeof t.text !== 'string' || !t.text.trim()) return null;

  // Generate or validate ID
  let id = typeof t.id === 'string' ? t.id : generateId('task');
  if (seenIds.has(id)) {
    id = generateId('task'); // Regenerate if duplicate
  }
  seenIds.add(id);

  return {
    id,
    text: String(t.text).slice(0, 500),
    state: validateTaskState(t.state),
  };
}

/**
 * Validate and parse a card object
 */
function parseCard(card: unknown, seenIds: Set<string>): KanbanCard | null {
  if (!card || typeof card !== 'object') return null;

  const c = card as Record<string, unknown>;

  // Require title field
  if (typeof c.title !== 'string' || !c.title.trim()) return null;

  // Generate or validate ID
  let id = typeof c.id === 'string' ? c.id : generateId('card');
  if (seenIds.has(id)) {
    id = generateId('card');
  }
  seenIds.add(id);

  // Parse tasks
  const tasks: KanbanTask[] = [];
  if (Array.isArray(c.tasks)) {
    for (const task of c.tasks.slice(0, 20)) { // Max 20 tasks per card
      const parsed = parseTask(task, seenIds);
      if (parsed) tasks.push(parsed);
    }
  }

  // Validate color
  const color = VALID_COLORS.includes(c.color as KanbanCardColor)
    ? (c.color as KanbanCardColor)
    : undefined;

  // Preserve existing timestamps without generating new ones (for idempotent parsing)
  return {
    id,
    title: String(c.title).slice(0, 200),
    description: typeof c.description === 'string' ? c.description.slice(0, 2000) : undefined,
    tasks,
    color,
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : undefined,
    updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : undefined,
  };
}

/**
 * Validate and parse a column object
 */
function parseColumn(column: unknown, seenIds: Set<string>): KanbanColumn | null {
  if (!column || typeof column !== 'object') return null;

  const col = column as Record<string, unknown>;

  // Require title field
  if (typeof col.title !== 'string' || !col.title.trim()) return null;

  // Generate or validate ID
  let id = typeof col.id === 'string' ? col.id : generateId('col');
  if (seenIds.has(id)) {
    id = generateId('col');
  }
  seenIds.add(id);

  // Parse cards
  const cards: KanbanCard[] = [];
  if (Array.isArray(col.cards)) {
    for (const card of col.cards.slice(0, 100)) { // Max 100 cards per column
      const parsed = parseCard(card, seenIds);
      if (parsed) cards.push(parsed);
    }
  }

  return {
    id,
    title: String(col.title).slice(0, 50),
    cards,
  };
}

/**
 * Validate and parse metadata
 * Preserves existing timestamps without generating new ones (for idempotent parsing)
 */
function parseMetadata(metadata: unknown): KanbanMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const m = metadata as Record<string, unknown>;
  return {
    name: typeof m.name === 'string' ? m.name : undefined,
    description: typeof m.description === 'string' ? m.description : undefined,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
    updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : undefined,
  };
}

/**
 * Parse a .kanban file content into a KanbanDocument
 * @param content - Raw file content (JSON string)
 * @returns Parsed and validated KanbanDocument
 */
export function parseKanbanFile(content: string): KanbanDocument {
  const trimmed = content.trim();

  // Handle empty file
  if (!trimmed) {
    return createEmptyDocument();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    console.error('Invalid JSON in kanban file');
    return createEmptyDocument();
  }

  if (!parsed || typeof parsed !== 'object') {
    return createEmptyDocument();
  }

  const doc = parsed as Record<string, unknown>;

  // Check version (log warning for unknown versions but try to parse)
  if (doc.version && doc.version !== KANBAN_VERSION) {
    console.warn(`Unknown kanban version ${doc.version}, attempting to parse`);
  }

  // Track seen IDs for uniqueness
  const seenIds = new Set<string>();

  // Parse columns
  const columns: KanbanColumn[] = [];
  if (Array.isArray(doc.columns)) {
    for (const column of doc.columns.slice(0, 10)) { // Max 10 columns
      const parsedCol = parseColumn(column, seenIds);
      if (parsedCol) columns.push(parsedCol);
    }
  }

  // If no valid columns, create defaults
  if (columns.length === 0) {
    return createEmptyDocument();
  }

  return {
    version: KANBAN_VERSION,
    metadata: parseMetadata(doc.metadata),
    columns,
  };
}

/**
 * Serialize a KanbanDocument to .kanban file format
 * Does NOT inject timestamps - serialization is idempotent for change detection
 * Timestamps are updated via MARK_SAVED action when explicitly saving
 * @param document - The kanban document to serialize
 * @returns Formatted JSON string
 */
export function serializeKanbanDocument(document: KanbanDocument): string {
  const output = {
    version: document.version,
    metadata: document.metadata,
    columns: document.columns,
  };

  return JSON.stringify(output, null, 2);
}
