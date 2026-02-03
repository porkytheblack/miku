# RFC-001: SimpleKanban File Format and Editor

## Status
Draft

## Abstract

This RFC proposes the addition of a SimpleKanban feature to Miku, providing a lightweight kanban board for task management. The feature introduces a new `.kanban` file extension with a JSON-based format, following the established patterns from the `.miku-env` implementation. SimpleKanban is designed for the 80% use case: personal task organization within a writing or project workspace, not enterprise project management.

## 1. Introduction

### 1.1 Problem Statement

Writers and developers using Miku often need to track tasks, ideas, and progress alongside their documents. Currently, they must either:
1. Use a separate tool (context switching)
2. Maintain a plain text TODO list (lacks visual organization)
3. Embed tasks in documents (mixing concerns)

A simple, integrated kanban board would provide visual task organization without leaving the Miku environment.

### 1.2 Goals

1. Provide a simple kanban board stored as a human-readable file
2. Support the standard kanban workflow: columns with movable cards
3. Allow cards to contain tasks with completion states
4. Follow established Miku patterns for file type detection and custom editors
5. Enable file-based storage that works with version control
6. Keep the implementation minimal and maintainable

### 1.3 Non-Goals

1. Real-time collaboration or multi-user features
2. Complex project management (assignments, due dates, time tracking)
3. Integration with external project management tools (Jira, Trello, etc.)
4. Card attachments or rich media embedding
5. Board templates or automation rules
6. Analytics or reporting features

### 1.4 Success Criteria

1. Users can create, edit, and save `.kanban` files
2. Files are human-readable JSON that can be version-controlled
3. Cards can be dragged between columns
4. Cards can contain checkbox tasks
5. The editor integrates seamlessly with Miku's existing file browser and tab system
6. Performance remains acceptable with up to 100 cards per board

## 2. Background

### 2.1 Current State

Miku currently supports two file types:
- **markdown** (`.md`, `.markdown`, `.mdown`, `.txt`): Rendered in BlockEditor with AI suggestions
- **miku-env** (`.miku-env`, `.mikuenv`): Rendered in EnvEditor for secure secret management

The architecture for custom file types is well-established:

```
fileTypes.ts          - Detects file type from path/content
EditorSwitcher.tsx    - Routes to appropriate editor component
[Type]EditorContext   - Manages editor state via reducer
[Type]Editor/         - Component directory with index.tsx and sub-components
[type]Parser.ts       - Serialization/deserialization logic
types/index.ts        - TypeScript interfaces for the data model
```

### 2.2 Terminology

- **Board**: A kanban board, stored as a single `.kanban` file
- **Column**: A vertical container for cards (e.g., "To Do", "In Progress", "Done")
- **Card**: A unit of work within a column, containing a title and optional description
- **Task**: A checkbox item within a card, representing a sub-task
- **State**: The completion status of a task (todo, in-progress, done)

### 2.3 Prior Art

| Tool | Format | Complexity | Notes |
|------|--------|------------|-------|
| Trello | Proprietary JSON | High | Full PM features, cloud-only |
| GitHub Projects | GraphQL API | Medium | Tightly coupled to GitHub |
| Obsidian Kanban | Markdown | Low | Uses YAML frontmatter + lists |
| Notion | Proprietary | High | Database-backed |

The Obsidian Kanban plugin provides the closest inspiration: file-based, simple, integrated with a text editor. However, its Markdown format becomes unwieldy for complex cards. A JSON format offers better structure while remaining human-readable.

## 3. Algorithm Analysis

### 3.1 Candidate Approaches for File Format

#### 3.1.1 Markdown with YAML Frontmatter

```markdown
---
columns:
  - id: todo
    title: To Do
  - id: done
    title: Done
---

## todo

- [ ] Card title
  - [ ] Task 1
  - [x] Task 2

## done

- [x] Completed card
```

- **Advantages**: Human-readable, familiar syntax, git-diff friendly
- **Disadvantages**: Parsing ambiguity, limited metadata, description handling awkward
- **Best Suited For**: Simple lists without descriptions or metadata

#### 3.1.2 JSON

```json
{
  "version": "1.0",
  "columns": [
    {
      "id": "todo",
      "title": "To Do",
      "cards": [
        {
          "id": "card-1",
          "title": "Implement feature",
          "tasks": [
            { "id": "task-1", "text": "Design API", "state": "done" }
          ]
        }
      ]
    }
  ]
}
```

- **Advantages**: Unambiguous parsing, rich metadata, established tooling
- **Disadvantages**: More verbose, merge conflicts harder to resolve manually
- **Best Suited For**: Structured data with nested relationships

#### 3.1.3 YAML

```yaml
version: "1.0"
columns:
  - id: todo
    title: To Do
    cards:
      - id: card-1
        title: Implement feature
        tasks:
          - id: task-1
            text: Design API
            state: done
```

- **Advantages**: More readable than JSON, less verbose
- **Disadvantages**: Whitespace-sensitive, requires additional parser dependency, indentation errors common
- **Best Suited For**: Configuration files with moderate complexity

### 3.2 Comparative Analysis

| Criterion | Markdown | JSON | YAML |
|-----------|----------|------|------|
| Human Readability | Excellent | Good | Very Good |
| Parse Reliability | Poor | Excellent | Good |
| Existing Tooling in Miku | None | Native | None |
| Merge Conflict Resolution | Easy | Medium | Medium |
| Metadata Support | Limited | Full | Full |
| Implementation Complexity | High | Low | Medium |
| Consistency with miku-env | Low | High | Low |

### 3.3 Recommendation

**JSON format** is recommended for the following reasons:

1. **Consistency**: The `.miku-env` format already uses a text-based format with structured content; JSON provides similar benefits with explicit structure
2. **Reliability**: No parsing ambiguity; standard `JSON.parse()` handles all edge cases
3. **Tooling**: No additional dependencies required
4. **Extensibility**: Easy to add new fields without breaking existing files
5. **Pretty-printing**: `JSON.stringify(data, null, 2)` provides readable output

The primary downside (merge conflicts) is mitigated by:
- Single-user design (conflicts are rare)
- Card IDs enabling conflict resolution tools
- Formatted JSON with one property per line

## 4. Detailed Design

### 4.1 Architecture Overview

```
src/
  types/index.ts                    # Add Kanban types
  lib/
    fileTypes.ts                    # Add .kanban detection
    kanbanParser.ts                 # Parse/serialize .kanban files
  context/
    KanbanEditorContext.tsx         # State management
  components/
    EditorSwitcher.tsx              # Add kanban routing
    KanbanEditor/
      index.tsx                     # Main editor component
      KanbanColumn.tsx              # Column component
      KanbanCard.tsx                # Card component
      KanbanTaskList.tsx            # Task list within card
      KanbanToolbar.tsx             # Board toolbar
      KanbanEmptyState.tsx          # Empty board state
```

### 4.2 Data Structures

#### 4.2.1 TypeScript Interfaces

```typescript
// src/types/index.ts

/**
 * Task state follows a simple three-state model.
 * Unlike binary checkboxes, this allows tracking work-in-progress.
 */
export type TaskState = 'todo' | 'in-progress' | 'done';

/**
 * A task is a single checklist item within a card.
 * Tasks are intentionally simple: text and state only.
 */
export interface KanbanTask {
  id: string;           // Unique within the board, format: "task-{timestamp}-{random}"
  text: string;         // Task description, single line, max 500 chars
  state: TaskState;     // Current completion state
}

/**
 * A card represents a unit of work.
 * Cards can optionally contain sub-tasks for breaking down work.
 */
export interface KanbanCard {
  id: string;           // Unique within the board, format: "card-{timestamp}-{random}"
  title: string;        // Card title, single line, max 200 chars
  description?: string; // Optional multi-line description, max 2000 chars
  tasks: KanbanTask[];  // Sub-tasks, can be empty
  color?: string;       // Optional color label (predefined palette)
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
}

/**
 * A column is a vertical container for cards.
 * Columns have a fixed order defined by their position in the array.
 */
export interface KanbanColumn {
  id: string;           // Unique within the board, format: "col-{timestamp}-{random}"
  title: string;        // Column title, max 50 chars
  cards: KanbanCard[];  // Cards in display order (top to bottom)
}

/**
 * Board metadata for display and identification.
 */
export interface KanbanMetadata {
  name?: string;        // Board name (defaults to filename)
  description?: string; // Board description
  createdAt?: string;   // ISO 8601 timestamp
  updatedAt?: string;   // ISO 8601 timestamp
}

/**
 * Complete kanban document structure.
 * This is what gets serialized to/from the .kanban file.
 */
export interface KanbanDocument {
  version: string;              // Format version, currently "1.0"
  metadata: KanbanMetadata;     // Board-level metadata
  columns: KanbanColumn[];      // Columns in display order (left to right)
}

/**
 * File type detection union - add 'kanban' to existing type
 */
export type FileType = 'markdown' | 'miku-env' | 'kanban';

/**
 * Color palette for card labels.
 * Limited set for visual consistency.
 */
export type KanbanCardColor =
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';
```

#### 4.2.2 Invariants

1. **ID Uniqueness**: All IDs within a board must be unique (enforced at parse time)
2. **Non-empty Columns**: A board must have at least one column
3. **Column Limit**: Maximum 10 columns per board (UX constraint)
4. **Card Limit**: Maximum 100 cards per column (performance constraint)
5. **Task Limit**: Maximum 20 tasks per card (UX constraint)
6. **Version Compatibility**: Parser must handle unknown fields gracefully (forward compatibility)

### 4.3 File Format Specification

#### 4.3.1 File Extension

Primary: `.kanban`
Alternative: `.miku-kanban` (for disambiguation in mixed environments)

#### 4.3.2 Magic Header (Optional)

For content-based detection, files may optionally start with:
```json
{"$schema": "miku-kanban-v1", ...}
```

This is not required but enables detection of `.kanban` content in files without the extension.

#### 4.3.3 Complete File Example

```json
{
  "version": "1.0",
  "metadata": {
    "name": "Project Alpha Tasks",
    "description": "Main development board for Project Alpha",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-02-03T14:22:00Z"
  },
  "columns": [
    {
      "id": "col-1705312200000-abc123",
      "title": "Backlog",
      "cards": []
    },
    {
      "id": "col-1705312200001-def456",
      "title": "To Do",
      "cards": [
        {
          "id": "card-1705312300000-ghi789",
          "title": "Implement user authentication",
          "description": "Add login/logout functionality with session management.",
          "color": "blue",
          "tasks": [
            {
              "id": "task-1705312400000-jkl012",
              "text": "Design login form UI",
              "state": "done"
            },
            {
              "id": "task-1705312400001-mno345",
              "text": "Implement backend auth endpoints",
              "state": "in-progress"
            },
            {
              "id": "task-1705312400002-pqr678",
              "text": "Add session persistence",
              "state": "todo"
            }
          ],
          "createdAt": "2025-01-15T10:35:00Z",
          "updatedAt": "2025-02-01T09:15:00Z"
        }
      ]
    },
    {
      "id": "col-1705312200002-stu901",
      "title": "In Progress",
      "cards": [
        {
          "id": "card-1705312300001-vwx234",
          "title": "Write documentation",
          "tasks": [],
          "createdAt": "2025-01-20T14:00:00Z",
          "updatedAt": "2025-01-20T14:00:00Z"
        }
      ]
    },
    {
      "id": "col-1705312200003-yza567",
      "title": "Done",
      "cards": []
    }
  ]
}
```

### 4.4 Algorithm Specification

#### 4.4.1 Parsing (.kanban file to KanbanDocument)

```
PROCEDURE parseKanbanFile(content: string): KanbanDocument
  REQUIRE: content is a non-empty string
  ENSURE: returns valid KanbanDocument or throws ParseError

  1. Trim whitespace from content
  2. IF content is empty THEN
       RETURN createEmptyDocument()

  3. TRY
       parsed := JSON.parse(content)
     CATCH SyntaxError
       THROW ParseError("Invalid JSON syntax")

  4. IF parsed.version is undefined THEN
       THROW ParseError("Missing version field")

  5. IF parsed.version !== "1.0" THEN
       LOG warning "Unknown version {parsed.version}, attempting parse"

  6. document := {
       version: parsed.version || "1.0",
       metadata: validateMetadata(parsed.metadata || {}),
       columns: []
     }

  7. seenIds := new Set()

  8. FOR EACH column IN (parsed.columns || [])
       validatedColumn := validateColumn(column, seenIds)
       document.columns.push(validatedColumn)

  9. IF document.columns.length === 0 THEN
       document.columns := createDefaultColumns()

  10. RETURN document
```

#### 4.4.2 Serialization (KanbanDocument to .kanban file)

```
PROCEDURE serializeKanbanDocument(document: KanbanDocument): string
  REQUIRE: document is a valid KanbanDocument
  ENSURE: returns formatted JSON string

  1. output := {
       version: document.version,
       metadata: {
         ...document.metadata,
         updatedAt: new Date().toISOString()
       },
       columns: document.columns.map(serializeColumn)
     }

  2. RETURN JSON.stringify(output, null, 2)
```

#### 4.4.3 Card Movement Between Columns

```
PROCEDURE moveCard(
  document: KanbanDocument,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): KanbanDocument
  REQUIRE: cardId exists in fromColumnId
  REQUIRE: toIndex >= 0 AND toIndex <= toColumn.cards.length
  ENSURE: card is in toColumn at toIndex, removed from fromColumn

  1. fromColumn := findColumn(document, fromColumnId)
  2. toColumn := findColumn(document, toColumnId)

  3. IF fromColumn is null OR toColumn is null THEN
       THROW Error("Column not found")

  4. cardIndex := fromColumn.cards.findIndex(c => c.id === cardId)

  5. IF cardIndex === -1 THEN
       THROW Error("Card not found in source column")

  6. card := fromColumn.cards[cardIndex]
  7. card.updatedAt := new Date().toISOString()

  8. // Remove from source
     fromColumn.cards.splice(cardIndex, 1)

  9. // Insert at destination
     // Adjust index if moving within same column and source was before destination
     IF fromColumnId === toColumnId AND cardIndex < toIndex THEN
       toIndex := toIndex - 1

  10. toColumn.cards.splice(toIndex, 0, card)

  11. RETURN document  // mutated in place for performance
```

### 4.5 Interface Definition

#### 4.5.1 Parser Module (kanbanParser.ts)

```typescript
/**
 * Parse a .kanban file content into a KanbanDocument.
 * @param content - Raw file content (JSON string)
 * @returns Parsed and validated KanbanDocument
 * @throws ParseError if content is invalid
 */
export function parseKanbanFile(content: string): KanbanDocument;

/**
 * Serialize a KanbanDocument to .kanban file format.
 * @param document - The kanban document to serialize
 * @returns Formatted JSON string
 */
export function serializeKanbanDocument(document: KanbanDocument): string;

/**
 * Create a new empty kanban document with default columns.
 * @returns Fresh KanbanDocument with To Do, In Progress, Done columns
 */
export function createEmptyDocument(): KanbanDocument;

/**
 * Generate a unique ID for kanban entities.
 * @param prefix - ID prefix ('col', 'card', 'task')
 * @returns Unique ID string
 */
export function generateId(prefix: 'col' | 'card' | 'task'): string;

/**
 * Create a new card with default values.
 * @param title - Card title
 * @returns New KanbanCard
 */
export function createCard(title: string): KanbanCard;

/**
 * Create a new task with default values.
 * @param text - Task text
 * @returns New KanbanTask
 */
export function createTask(text: string): KanbanTask;

/**
 * Create a new column with default values.
 * @param title - Column title
 * @returns New KanbanColumn
 */
export function createColumn(title: string): KanbanColumn;
```

#### 4.5.2 Context Actions (KanbanEditorContext.tsx)

```typescript
type KanbanEditorAction =
  // Document loading
  | { type: 'LOAD_CONTENT'; content: string }
  | { type: 'LOAD_DOCUMENT'; document: KanbanDocument }

  // Column operations
  | { type: 'ADD_COLUMN'; title: string }
  | { type: 'UPDATE_COLUMN'; id: string; title: string }
  | { type: 'DELETE_COLUMN'; id: string }
  | { type: 'MOVE_COLUMN'; id: string; direction: 'left' | 'right' }

  // Card operations
  | { type: 'ADD_CARD'; columnId: string; card?: Partial<KanbanCard> }
  | { type: 'UPDATE_CARD'; id: string; updates: Partial<Omit<KanbanCard, 'id'>> }
  | { type: 'DELETE_CARD'; id: string }
  | { type: 'MOVE_CARD'; cardId: string; fromColumnId: string; toColumnId: string; toIndex: number }

  // Task operations
  | { type: 'ADD_TASK'; cardId: string; text: string }
  | { type: 'UPDATE_TASK'; cardId: string; taskId: string; updates: Partial<Omit<KanbanTask, 'id'>> }
  | { type: 'DELETE_TASK'; cardId: string; taskId: string }
  | { type: 'CYCLE_TASK_STATE'; cardId: string; taskId: string }

  // UI state
  | { type: 'SET_EDITING_CARD'; cardId: string | null }
  | { type: 'SET_DRAGGING_CARD'; cardId: string | null }

  // Persistence
  | { type: 'MARK_SAVED' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<KanbanMetadata> };
```

### 4.6 Error Handling

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| Invalid JSON syntax | Throw ParseError with line/column info |
| Missing version field | Throw ParseError |
| Unknown version | Log warning, attempt parse with current schema |
| Duplicate IDs | Regenerate duplicate IDs during parse |
| Missing required fields | Use defaults, log warning |
| Constraint violations (limits) | Truncate with warning |
| Circular column reference | Not possible with array structure |
| File read failure | Propagate to UI, show error toast |
| File write failure | Propagate to UI, show error toast, retain dirty state |

### 4.7 Edge Cases

#### Empty Inputs
- **Empty file**: Create document with default columns (To Do, In Progress, Done)
- **Empty columns array**: Add default columns
- **Empty cards array**: Valid, render empty column

#### Single Element Inputs
- **Single column**: Valid, allow adding more
- **Single card**: Valid, normal operation
- **Single task**: Valid, normal operation

#### Maximum Size Inputs
- **100 cards in column**: Warn user, allow but suggest archiving
- **20 tasks in card**: Prevent adding more, show message
- **10 columns**: Prevent adding more, show message

#### Malformed Inputs
- **Invalid JSON**: Show parse error, prevent opening
- **Missing IDs**: Generate IDs during parse
- **Invalid task state**: Default to 'todo'
- **Future version**: Log warning, attempt parse

#### Concurrent Access
- **Not supported**: Single-user design; file locking not implemented
- **External modification**: Warn on save if file changed (future enhancement)

## 5. Implementation Guide

### 5.1 Prerequisites

- Node.js 18+ and npm/pnpm
- Understanding of React Context + useReducer pattern
- Familiarity with existing Miku codebase (especially EnvEditor implementation)

### 5.2 Implementation Order

1. **Types** (30 min)
   - Add interfaces to `src/types/index.ts`
   - Update `FileType` union

2. **Parser** (2 hours)
   - Create `src/lib/kanbanParser.ts`
   - Implement parse, serialize, factory functions
   - Write unit tests

3. **File Type Detection** (30 min)
   - Update `src/lib/fileTypes.ts`
   - Add `.kanban` extension mapping
   - Add content detection for magic header

4. **Context** (2 hours)
   - Create `src/context/KanbanEditorContext.tsx`
   - Implement reducer with all actions
   - Add computed values (filtered views, etc.)

5. **Editor Components** (4 hours)
   - Create `src/components/KanbanEditor/` directory
   - Implement `index.tsx` (main editor)
   - Implement `KanbanColumn.tsx`
   - Implement `KanbanCard.tsx`
   - Implement `KanbanTaskList.tsx`
   - Implement `KanbanToolbar.tsx`
   - Implement `KanbanEmptyState.tsx`

6. **Editor Integration** (1 hour)
   - Update `EditorSwitcher.tsx` to route kanban files
   - Update `FileBrowser.tsx` to show kanban icon
   - Test file open/save flow

7. **Drag and Drop** (2 hours)
   - Implement card drag between columns
   - Implement card reorder within column
   - Handle drop zone highlighting

8. **Polish** (2 hours)
   - Keyboard navigation
   - Empty states
   - Error handling UI
   - Performance optimization

### 5.3 Testing Strategy

#### Unit Tests (kanbanParser.test.ts)
- Parse valid JSON
- Parse empty file
- Parse file with missing optional fields
- Handle invalid JSON gracefully
- Serialize round-trip (parse -> serialize -> parse === original)
- ID generation uniqueness
- Constraint validation

#### Integration Tests
- Create new kanban file
- Open existing kanban file
- Save modified kanban file
- Switch between kanban and other file types
- Dirty state tracking

#### Manual Testing Checklist
- [ ] Create new board from file browser
- [ ] Add/edit/delete columns
- [ ] Add/edit/delete cards
- [ ] Add/edit/delete tasks in cards
- [ ] Drag card within column
- [ ] Drag card between columns
- [ ] Task state cycling (click to advance)
- [ ] Save and reopen preserves all data
- [ ] Undo/redo on close warning
- [ ] Keyboard navigation

### 5.4 Common Pitfalls

1. **ID Collisions**: Always use `generateId()`, never hardcode IDs
2. **Mutation**: Return new objects from reducer, don't mutate state directly
3. **Drag State Leaks**: Ensure drag state is cleared on drop and on unmount
4. **Z-Index**: Dragging card must appear above all columns
5. **Performance**: Use `React.memo` for Column and Card components
6. **Touch Events**: Drag-and-drop must work on touch devices
7. **Content Getter**: Register content getter like EnvEditor does

## 6. Performance Characteristics

### 6.1 Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Parse file | O(n) where n = total entities | O(n) |
| Serialize file | O(n) | O(n) |
| Add card | O(1) | O(1) |
| Move card | O(m) where m = cards in column | O(1) |
| Find card by ID | O(c * m) where c = columns | O(1) |
| Render board | O(n) | O(n) |

### 6.2 Benchmarking Methodology

Measure the following with Chrome DevTools:
1. Time to parse 100-card board from JSON
2. Time to serialize 100-card board to JSON
3. Initial render time for 100-card board
4. Re-render time after single card move
5. Drag interaction frame rate (target: 60fps)

### 6.3 Expected Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| Parse 100 cards | < 5ms | < 20ms |
| Serialize 100 cards | < 5ms | < 20ms |
| Initial render 100 cards | < 50ms | < 100ms |
| Re-render after move | < 16ms | < 33ms |
| Drag frame rate | 60fps | 30fps |

### 6.4 Optimization Opportunities

1. **Virtualization**: For boards with 100+ cards, virtualize column scroll
2. **Memoization**: Memoize card components to prevent unnecessary re-renders
3. **Lazy parsing**: For very large files, stream-parse (unlikely to be needed)
4. **Debounced save**: Batch rapid changes before serialization

## 7. Security Considerations

1. **No executable content**: JSON format contains only data, no scripts
2. **Input sanitization**: All string fields are treated as plain text in UI
3. **File path validation**: Rely on existing Tauri file handling security
4. **No network access**: All data is local, no external communication
5. **No sensitive data**: Unlike miku-env, kanban files don't contain secrets

## 8. Operational Considerations

### 8.1 Monitoring

For development/debugging:
- Console log parse errors with details
- Track dirty state changes
- Log drag-and-drop operations

### 8.2 Alerting

Not applicable for local-only feature.

### 8.3 Debugging

1. **Parse failures**: Full error message with content preview
2. **State issues**: React DevTools to inspect context state
3. **Drag problems**: Console log drag events
4. **Save failures**: Toast with file system error

## 9. Migration Plan

Not applicable - this is a new feature with no existing data to migrate.

## 10. Open Questions

1. **Column limit**: Is 10 columns sufficient? Should it be configurable?
2. **Archive feature**: Should completed cards auto-archive or have manual archive?
3. **Search**: Should there be search/filter functionality for large boards?
4. **Card colors**: Is the proposed 7-color palette sufficient?
5. **Markdown in descriptions**: Should card descriptions support markdown rendering?

## 11. References

1. Miku codebase: `src/components/EnvEditor/` - reference implementation
2. Miku codebase: `src/lib/envParser.ts` - parsing patterns
3. React DnD documentation: https://react-dnd.github.io/react-dnd/
4. Obsidian Kanban plugin: https://github.com/mgmeyers/obsidian-kanban

## Appendices

### A. Worked Example: Creating and Editing a Board

**Step 1: User creates new .kanban file**

```
Action: User clicks "New File" in file browser, enters "tasks.kanban"
Result: Empty file created, KanbanEditor opens
```

Initial document state:
```json
{
  "version": "1.0",
  "metadata": {
    "createdAt": "2025-02-03T15:00:00Z"
  },
  "columns": [
    { "id": "col-...", "title": "To Do", "cards": [] },
    { "id": "col-...", "title": "In Progress", "cards": [] },
    { "id": "col-...", "title": "Done", "cards": [] }
  ]
}
```

**Step 2: User adds a card**

```
Action: User clicks "+" in "To Do" column, types "Implement login"
Dispatch: { type: 'ADD_CARD', columnId: 'col-...', card: { title: 'Implement login' } }
```

Document state after:
```json
{
  "columns": [
    {
      "id": "col-...",
      "title": "To Do",
      "cards": [
        {
          "id": "card-...",
          "title": "Implement login",
          "tasks": [],
          "createdAt": "2025-02-03T15:01:00Z",
          "updatedAt": "2025-02-03T15:01:00Z"
        }
      ]
    },
    ...
  ]
}
```

**Step 3: User adds tasks to the card**

```
Action: User clicks card to expand, adds task "Design form"
Dispatch: { type: 'ADD_TASK', cardId: 'card-...', text: 'Design form' }
```

**Step 4: User drags card to "In Progress"**

```
Action: User drags card from "To Do" column and drops in "In Progress"
Dispatch: { type: 'MOVE_CARD', cardId: 'card-...', fromColumnId: 'col-todo', toColumnId: 'col-progress', toIndex: 0 }
```

**Step 5: User saves (Cmd+S)**

```
Action: DocumentContext.saveDocument() called
Flow: getContent() -> serializeKanbanDocument(document) -> saveFile(path, content)
```

### B. Proof of Correctness

**Theorem**: The card movement operation preserves all cards and maintains valid board state.

**Proof**:
1. `moveCard` operates on a single card identified by `cardId`
2. The card is found in `fromColumn` at a specific index (step 4-5)
3. If card is not found, operation throws and no mutation occurs (step 5)
4. Card is removed from `fromColumn.cards` array (step 8)
5. Card is inserted into `toColumn.cards` array at `toIndex` (step 10)
6. No other cards are modified
7. Total card count: |cards| = |cards| - 1 + 1 = |cards| (invariant preserved)
8. All IDs remain unique (no ID modification occurs)

QED

### C. Alternative Approaches Considered

#### C.1 Using SQLite Instead of JSON Files

**Rationale for consideration**: Better query performance, atomic operations.

**Rejection reasons**:
- Violates "files you can version control" goal
- Introduces significant complexity for minimal benefit at expected scale
- Not human-readable
- Requires additional dependencies

#### C.2 Separate Files per Card

**Rationale for consideration**: Better for git merges, smaller file sizes.

**Rejection reasons**:
- Complicates file management
- Requires directory per board
- Atomic save becomes complex
- More file system operations

#### C.3 No Sub-tasks, Just Cards

**Rationale for consideration**: Simpler implementation and mental model.

**Rejection reasons**:
- Common use case is breaking down cards into steps
- Without tasks, users would create many small cards
- Tasks provide clear progress indication within a card
- Obsidian Kanban and similar tools support this pattern
