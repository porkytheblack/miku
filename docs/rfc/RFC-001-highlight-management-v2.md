# RFC-001: Enhanced Highlight Management, State Transitions, and Tool Call Architecture for Miku

## Status
Draft

## Abstract
This RFC proposes comprehensive improvements to Miku's highlight management system, suggestion acceptance/dismissal state handling, and tool call architecture. The current implementation, while functional, exhibits O(n^2) overlap detection, lacks formal state machine definitions, and uses an ad-hoc tool call structure. This document specifies optimized algorithms, formal state machines, and a structured tool call API that will improve performance, maintainability, and extensibility.

## 1. Introduction

### 1.1 Problem Statement
Miku is an AI-powered writing editor that provides real-time suggestions for improving prose. The system currently manages highlights through a combination of:
- Linear array scanning for overlap detection
- Imperative position adjustment during text edits
- Loosely-typed tool calls for AI agent communication
- Implicit state transitions without formal specification

As documents grow larger and suggestion counts increase, these approaches create performance bottlenecks and maintenance challenges.

### 1.2 Goals
1. Reduce overlap detection complexity from O(n^2) to O(n log n)
2. Define formal state machines for suggestion lifecycle management
3. Create a type-safe, extensible tool call architecture
4. Integrate seamlessly with undo/redo operations
5. Maintain compatibility with existing components (BlockEditor, MikuContext)
6. Support future features: multi-cursor, collaborative editing, custom highlight types

### 1.3 Non-Goals
- Changing the visual appearance of highlights
- Modifying the AI provider interface (Anthropic, OpenAI, etc.)
- Restructuring the React component hierarchy
- Implementing collaborative real-time editing (though we will not preclude it)

### 1.4 Success Criteria
- Overlap detection completes in < 1ms for 1000 suggestions
- State transitions are fully predictable and testable
- Tool call validation catches 100% of malformed responses
- Zero regressions in existing functionality
- Unit test coverage > 95% for new modules

## 2. Background

### 2.1 Current State

The existing implementation consists of several interconnected modules:

**Suggestion Type** (`src/types/index.ts`):
```typescript
interface Suggestion {
  id: string;
  type: HighlightType;            // 'clarity' | 'grammar' | 'style' | 'structure' | 'economy'
  lineNumber: number;              // 1-indexed
  columnNumber: number;            // 1-indexed
  startIndex: number;              // Character offset
  endIndex: number;                // Character offset
  originalText: string;
  observation: string;
  suggestedRevision: string;
}
```

**Position Utilities** (`src/lib/textPosition.ts`):
- `LineMap`: Converts between offsets and line/column
- `computeTextEdit`: Detects the minimal edit between two strings
- `adjustSuggestions`: Shifts positions after edits
- `validateSuggestionPositions`: Verifies and deduplicates suggestions

**Overlap Detection** (in multiple locations):
```typescript
// Current O(n^2) approach in filterOverlappingSuggestions
const hasOverlap = result.some(
  existing =>
    (suggestion.startIndex >= existing.startIndex && suggestion.startIndex < existing.endIndex) ||
    (suggestion.endIndex > existing.startIndex && suggestion.endIndex <= existing.endIndex) ||
    (suggestion.startIndex <= existing.startIndex && suggestion.endIndex >= existing.endIndex)
);
```

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **Highlight** | A visual marker on a range of text |
| **Suggestion** | A highlight with associated revision data |
| **Range** | A pair of offsets (start, end) defining a text span |
| **Overlap** | Two ranges share at least one character position |
| **Tool Call** | A structured request from the AI to perform an action |
| **State Machine** | A formal model of states and transitions |
| **Interval Tree** | A data structure for efficient range queries |

### 2.3 Prior Art

**Monaco Editor**: Uses a piece table for text storage and an interval tree (augmented BST) for decorations. Achieves O(log n) for range queries and O(k + log n) for overlap detection where k is the result count.

**Grammarly**: Employs persistent data structures with structural sharing for efficient undo/redo. Uses a sweepline algorithm for overlap detection during initial placement.

**ProseMirror**: Implements decorations as a separate tree structure mapped to document positions. Uses Operational Transformation concepts for position mapping.

**VS Code Language Server Protocol**: Defines strongly-typed tool calls with JSON Schema validation. Uses discriminated unions for response types.

## 3. Algorithm Analysis

### 3.1 Candidate Approaches for Highlight Management

#### 3.1.1 Linear Array with O(n^2) Overlap Detection (Current)

**Description**: Stores suggestions in a flat array. For each new suggestion, scans all existing suggestions to check for overlap.

**Time Complexity**:
- Insert: O(n) - must check all existing
- Delete: O(n) - linear scan to find
- Query overlaps: O(n) - check all
- Batch insert of m items: O(m * n) = O(mn)

**Space Complexity**: O(n)

**Advantages**:
- Simple implementation
- Low memory overhead
- Good cache locality for small n

**Disadvantages**:
- Quadratic scaling for batch operations
- No efficient range queries
- Full rescan on every operation

**Best Suited For**: < 50 suggestions, infrequent updates

#### 3.1.2 Sorted Array with Binary Search

**Description**: Maintains suggestions sorted by start index. Uses binary search to find insertion points and potential overlaps.

**Time Complexity**:
- Insert: O(n) - insertion requires shifting
- Delete: O(n) - deletion requires shifting
- Query overlaps at point: O(log n + k)
- Query overlaps for range: O(log n + k) where k is result count

**Space Complexity**: O(n)

**Advantages**:
- Faster queries than linear scan
- Simple to implement
- Good for read-heavy workloads

**Disadvantages**:
- O(n) insertions/deletions
- Requires re-sorting after position updates

**Best Suited For**: Read-heavy workloads, moderate suggestion counts

#### 3.1.3 Interval Tree (Augmented BST)

**Description**: Each node stores a range and augmented with the maximum endpoint in its subtree. Enables efficient stabbing queries (find all intervals containing a point) and overlap queries.

**Time Complexity**:
- Insert: O(log n)
- Delete: O(log n)
- Query overlaps at point: O(log n + k)
- Query overlaps for range: O(log n + k)
- Batch position update: O(n) - must rebalance

**Space Complexity**: O(n)

**Advantages**:
- Logarithmic insertions and deletions
- Efficient overlap queries
- Well-understood data structure

**Disadvantages**:
- Complex implementation for self-balancing
- Position updates invalidate structure
- Higher constant factors

**Best Suited For**: Large suggestion counts, frequent queries

#### 3.1.4 Sweepline Algorithm for Batch Operations

**Description**: Processes ranges left-to-right using a sweepline. Maintains an active set of currently open intervals. Detects overlaps when a new interval starts while another is active.

**Time Complexity**:
- Batch overlap detection: O(n log n) - sort + sweep
- Cannot efficiently update incrementally

**Space Complexity**: O(n) for active set

**Advantages**:
- Optimal for batch processing
- Simple to implement correctly
- Deterministic output order

**Disadvantages**:
- Not suited for incremental updates
- Must re-run for any modification
- No persistent structure

**Best Suited For**: Initial suggestion validation, batch imports

#### 3.1.5 Hybrid: Sweepline + Index Map

**Description**: Combines sweepline for initial processing with a position-indexed map for efficient lookups and updates. The map stores suggestion IDs indexed by their start positions for O(1) access.

**Time Complexity**:
- Initial batch: O(n log n)
- Point query: O(1) amortized
- Range query: O(k) where k is result count
- Position update: O(1) for map update

**Space Complexity**: O(n)

**Advantages**:
- Best of both worlds
- Efficient incremental updates
- Simple position tracking

**Disadvantages**:
- Two data structures to maintain
- More complex invariant preservation

**Best Suited For**: Miku's use case - batch review followed by incremental edits

### 3.2 Comparative Analysis

| Criterion | Linear Array | Sorted Array | Interval Tree | Sweepline | Hybrid |
|-----------|--------------|--------------|---------------|-----------|--------|
| Insert Complexity | O(n) | O(n) | O(log n) | N/A | O(1) |
| Overlap Query | O(n) | O(log n + k) | O(log n + k) | O(n log n) | O(k) |
| Position Update | O(1) | O(n) | O(n) | N/A | O(1) |
| Implementation | Simple | Simple | Complex | Medium | Medium |
| Memory Overhead | Low | Low | Medium | Low | Medium |
| Batch Processing | Poor | Fair | Good | Excellent | Excellent |
| Incremental Updates | Fair | Poor | Good | Poor | Excellent |

### 3.3 Recommendation

**We recommend the Hybrid Sweepline + Index Map approach** for the following reasons:

1. **Matches Miku's Access Patterns**: Reviews produce batch suggestions (sweepline excels), followed by incremental user edits (index map excels).

2. **Optimal Complexity**: O(n log n) for initial processing, O(1) for common operations (accept, dismiss, position updates).

3. **Maintainable Implementation**: Sweepline is straightforward to implement correctly. Index maps are standard JavaScript patterns.

4. **Position Update Efficiency**: When user edits text, we only need to update offset values in the map - no rebalancing required.

5. **Future Extensibility**: The architecture naturally supports multiple highlight layers (different types) and priority-based conflict resolution.

## 4. Detailed Design

### 4.1 Architecture Overview

```
+-------------------+      +-------------------+      +-------------------+
|   AI Provider     | ---> |   Tool Executor   | ---> | HighlightManager  |
|  (tool calls)     |      |  (validation)     |      |  (state machine)  |
+-------------------+      +-------------------+      +-------------------+
                                                              |
                                                              v
                           +-------------------+      +-------------------+
                           |   RangeIndex      | <--- |  SuggestionStore  |
                           | (sweepline+map)   |      |  (immutable)      |
                           +-------------------+      +-------------------+
                                                              |
                                                              v
                           +-------------------+      +-------------------+
                           |   UndoManager     | <--- |   EditorState     |
                           |  (command stack)  |      |  (observable)     |
                           +-------------------+      +-------------------+
```

### 4.2 Data Structures

#### 4.2.1 Range

```typescript
/**
 * Represents an immutable text range with character offsets.
 * Invariants:
 *   - start >= 0
 *   - end >= start
 *   - start and end are integers
 */
interface Range {
  readonly start: number;
  readonly end: number;
}

/**
 * Factory functions for Range creation and manipulation.
 */
const Range = {
  /**
   * Creates a new Range, validating invariants.
   * @throws RangeError if start > end or either is negative
   */
  create(start: number, end: number): Range {
    if (start < 0 || end < start || !Number.isInteger(start) || !Number.isInteger(end)) {
      throw new RangeError(`Invalid range: [${start}, ${end})`);
    }
    return Object.freeze({ start, end });
  },

  /**
   * Returns the length of the range.
   */
  length(range: Range): number {
    return range.end - range.start;
  },

  /**
   * Checks if two ranges overlap (share at least one position).
   * Adjacent ranges (one ends where another starts) do NOT overlap.
   */
  overlaps(a: Range, b: Range): boolean {
    return a.start < b.end && b.start < a.end;
  },

  /**
   * Checks if range `a` contains range `b` entirely.
   */
  contains(a: Range, b: Range): boolean {
    return a.start <= b.start && a.end >= b.end;
  },

  /**
   * Checks if a point falls within the range (inclusive start, exclusive end).
   */
  containsPoint(range: Range, point: number): boolean {
    return point >= range.start && point < range.end;
  },

  /**
   * Applies a text edit to a range, returning the adjusted range or null if deleted.
   *
   * @param range - The range to adjust
   * @param editStart - Where the edit begins
   * @param deleteCount - Number of characters deleted
   * @param insertLength - Number of characters inserted
   * @returns Adjusted range, or null if the range was completely deleted
   */
  applyEdit(range: Range, editStart: number, deleteCount: number, insertLength: number): Range | null {
    const editEnd = editStart + deleteCount;
    const delta = insertLength - deleteCount;

    // Case 1: Range is completely before edit - no change
    if (range.end <= editStart) {
      return range;
    }

    // Case 2: Range is completely after edit - shift by delta
    if (range.start >= editEnd) {
      return Range.create(range.start + delta, range.end + delta);
    }

    // Case 3: Range is completely within deleted region - deleted
    if (range.start >= editStart && range.end <= editEnd) {
      return null;
    }

    // Case 4: Edit is completely within range - adjust end
    if (range.start <= editStart && range.end >= editEnd) {
      return Range.create(range.start, range.end + delta);
    }

    // Case 5: Range starts before edit, ends within - truncate
    if (range.start < editStart && range.end <= editEnd) {
      const newEnd = editStart;
      return newEnd > range.start ? Range.create(range.start, newEnd) : null;
    }

    // Case 6: Range starts within edit, ends after - shift start
    if (range.start >= editStart && range.start < editEnd && range.end > editEnd) {
      const newStart = editStart + insertLength;
      const newEnd = range.end + delta;
      return newEnd > newStart ? Range.create(newStart, newEnd) : null;
    }

    // Fallback (shouldn't reach)
    return range;
  }
};
```

#### 4.2.2 Highlight

```typescript
/**
 * Categories of highlights with associated visual treatments.
 */
type HighlightCategory =
  | 'clarity'      // Yellow - confusing or unclear text
  | 'grammar'      // Red - grammatical errors
  | 'style'        // Blue - stylistic suggestions
  | 'structure'    // Purple - structural improvements
  | 'economy'      // Green - verbose text that can be shortened
  | 'search'       // Orange - search result matches (future)
  | 'selection';   // Gray - user selection (future)

/**
 * Priority determines which highlight "wins" when overlaps occur.
 * Higher priority highlights are displayed; lower priority are hidden.
 */
type HighlightPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

const PRIORITY_VALUES: Record<HighlightPriority, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  background: 0
};

/**
 * Base highlight without suggestion data.
 * Used for search results, selections, and other non-suggestion highlights.
 */
interface Highlight {
  readonly id: string;
  readonly range: Range;
  readonly category: HighlightCategory;
  readonly priority: HighlightPriority;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Extended highlight with suggestion data for AI-generated improvements.
 */
interface SuggestionHighlight extends Highlight {
  readonly originalText: string;
  readonly observation: string;
  readonly suggestedRevision: string;
  readonly confidence?: number;  // 0-1, how confident the AI is
}

/**
 * Type guard for suggestion highlights.
 */
function isSuggestionHighlight(h: Highlight): h is SuggestionHighlight {
  return 'suggestedRevision' in h;
}
```

#### 4.2.3 RangeIndex

```typescript
/**
 * Efficient data structure for managing non-overlapping ranges.
 * Uses sweepline for batch operations and sorted array for incremental updates.
 *
 * Invariants:
 *   - All stored ranges are non-overlapping
 *   - Internal array is always sorted by start position
 *   - IDs are unique
 */
class RangeIndex<T extends { id: string; range: Range }> {
  // Primary storage: items sorted by range.start
  private items: T[] = [];

  // Secondary index: id -> array index for O(1) lookup
  private idIndex: Map<string, number> = new Map();

  /**
   * Creates a RangeIndex from an array of items.
   * Uses sweepline to detect and resolve overlaps.
   *
   * @param items - Items to index
   * @param resolveOverlap - Strategy for overlap resolution
   * @returns Tuple of [RangeIndex, rejectedItems]
   */
  static fromArray<T extends { id: string; range: Range }>(
    items: T[],
    resolveOverlap: 'keep-first' | 'keep-higher-priority' = 'keep-first'
  ): [RangeIndex<T>, T[]] {
    const index = new RangeIndex<T>();
    const rejected: T[] = [];

    // Step 1: Create events for sweepline
    type Event = { pos: number; type: 'start' | 'end'; item: T };
    const events: Event[] = [];

    for (const item of items) {
      events.push({ pos: item.range.start, type: 'start', item });
      events.push({ pos: item.range.end, type: 'end', item });
    }

    // Step 2: Sort events (start events before end events at same position)
    events.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.type !== b.type) return a.type === 'end' ? -1 : 1;
      return 0;
    });

    // Step 3: Sweep and detect overlaps
    const active: Set<string> = new Set();
    const accepted: Set<string> = new Set();

    for (const event of events) {
      if (event.type === 'start') {
        if (active.size === 0) {
          // No active intervals, safe to add
          active.add(event.item.id);
          accepted.add(event.item.id);
        } else {
          // Overlap detected
          if (resolveOverlap === 'keep-first') {
            rejected.push(event.item);
          } else {
            // keep-higher-priority: compare with active items
            // For now, keep first (priority comparison would go here)
            rejected.push(event.item);
          }
        }
      } else {
        active.delete(event.item.id);
      }
    }

    // Step 4: Build the index with accepted items
    const acceptedItems = items.filter(item => accepted.has(item.id));
    acceptedItems.sort((a, b) => a.range.start - b.range.start);

    index.items = acceptedItems;
    index.rebuildIdIndex();

    return [index, rejected];
  }

  private rebuildIdIndex(): void {
    this.idIndex.clear();
    for (let i = 0; i < this.items.length; i++) {
      this.idIndex.set(this.items[i].id, i);
    }
  }

  /**
   * Gets an item by ID.
   * Time: O(1)
   */
  get(id: string): T | undefined {
    const index = this.idIndex.get(id);
    return index !== undefined ? this.items[index] : undefined;
  }

  /**
   * Checks if an ID exists in the index.
   * Time: O(1)
   */
  has(id: string): boolean {
    return this.idIndex.has(id);
  }

  /**
   * Removes an item by ID.
   * Time: O(n) due to array splice
   */
  delete(id: string): boolean {
    const index = this.idIndex.get(id);
    if (index === undefined) return false;

    this.items.splice(index, 1);
    this.rebuildIdIndex();
    return true;
  }

  /**
   * Returns all items.
   * Time: O(n)
   */
  getAll(): readonly T[] {
    return this.items;
  }

  /**
   * Returns the count of items.
   * Time: O(1)
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * Finds all items whose ranges contain the given point.
   * Time: O(log n + k) where k is the result count
   */
  queryPoint(point: number): T[] {
    const results: T[] = [];

    // Binary search to find first item that might contain point
    let left = 0;
    let right = this.items.length - 1;
    let startIdx = this.items.length;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].range.start <= point) {
        startIdx = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Scan backwards and forwards to find all containing ranges
    for (let i = startIdx; i >= 0; i--) {
      const item = this.items[i];
      if (item.range.end <= point) break;
      if (Range.containsPoint(item.range, point)) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Finds all items whose ranges overlap with the given range.
   * Time: O(log n + k) where k is the result count
   */
  queryRange(range: Range): T[] {
    const results: T[] = [];

    // Binary search to find first item that might overlap
    let left = 0;
    let right = this.items.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].range.end <= range.start) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Scan forward to find all overlapping ranges
    for (let i = left; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.range.start >= range.end) break;
      if (Range.overlaps(item.range, range)) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Applies a text edit to all ranges, removing any that become invalid.
   * Returns a new RangeIndex (immutable operation).
   * Time: O(n)
   */
  applyEdit(editStart: number, deleteCount: number, insertLength: number): RangeIndex<T> {
    const newIndex = new RangeIndex<T>();
    const newItems: T[] = [];

    for (const item of this.items) {
      const newRange = Range.applyEdit(item.range, editStart, deleteCount, insertLength);
      if (newRange !== null) {
        newItems.push({ ...item, range: newRange } as T);
      }
    }

    newIndex.items = newItems;
    newIndex.rebuildIdIndex();
    return newIndex;
  }

  /**
   * Creates a deep copy of the index.
   */
  clone(): RangeIndex<T> {
    const newIndex = new RangeIndex<T>();
    newIndex.items = [...this.items];
    newIndex.rebuildIdIndex();
    return newIndex;
  }
}
```

#### 4.2.4 SuggestionStore

```typescript
/**
 * Immutable store for suggestions with efficient operations.
 * Supports transactional updates for undo/redo integration.
 */
interface SuggestionStoreState {
  readonly highlights: RangeIndex<SuggestionHighlight>;
  readonly activeId: string | null;
  readonly version: number;  // Incremented on each change for cache invalidation
}

type SuggestionStoreAction =
  | { type: 'SET_ALL'; highlights: SuggestionHighlight[] }
  | { type: 'REMOVE'; id: string }
  | { type: 'REMOVE_ALL' }
  | { type: 'SET_ACTIVE'; id: string | null }
  | { type: 'APPLY_EDIT'; editStart: number; deleteCount: number; insertLength: number }
  | { type: 'RESTORE'; state: SuggestionStoreState };

/**
 * Pure reducer for suggestion store state transitions.
 */
function suggestionStoreReducer(
  state: SuggestionStoreState,
  action: SuggestionStoreAction
): SuggestionStoreState {
  switch (action.type) {
    case 'SET_ALL': {
      const [highlights, _rejected] = RangeIndex.fromArray(action.highlights);
      return {
        highlights,
        activeId: null,
        version: state.version + 1
      };
    }

    case 'REMOVE': {
      const newHighlights = state.highlights.clone();
      newHighlights.delete(action.id);
      return {
        highlights: newHighlights,
        activeId: state.activeId === action.id ? null : state.activeId,
        version: state.version + 1
      };
    }

    case 'REMOVE_ALL': {
      const [emptyHighlights] = RangeIndex.fromArray<SuggestionHighlight>([]);
      return {
        highlights: emptyHighlights,
        activeId: null,
        version: state.version + 1
      };
    }

    case 'SET_ACTIVE': {
      if (action.id !== null && !state.highlights.has(action.id)) {
        return state;  // Invalid ID, no change
      }
      return {
        ...state,
        activeId: action.id,
        version: state.version + 1
      };
    }

    case 'APPLY_EDIT': {
      const newHighlights = state.highlights.applyEdit(
        action.editStart,
        action.deleteCount,
        action.insertLength
      );
      // Clear active if it was removed
      const newActiveId = state.activeId && newHighlights.has(state.activeId)
        ? state.activeId
        : null;
      return {
        highlights: newHighlights,
        activeId: newActiveId,
        version: state.version + 1
      };
    }

    case 'RESTORE': {
      return action.state;
    }

    default:
      return state;
  }
}
```

### 4.3 State Machine Definitions

#### 4.3.1 Suggestion Lifecycle State Machine

```
                                 +----------------+
                                 |    PENDING     |
                                 | (AI reviewing) |
                                 +-------+--------+
                                         |
                         review_complete |
                                         v
+----------+  user_activates   +---------+---------+  user_deactivates  +----------+
|          | <-----------------+                   +-------------------> |          |
|  ACTIVE  |                   |      READY        |                    | INACTIVE |
|          | ----------------> |                   | <------------------ |          |
+----+-----+  user_deactivates +---------+---------+  user_activates    +----+-----+
     |                                   |                                    |
     | user_accepts                      | text_edit                          |
     v                                   v                                    |
+----+-----+                   +---------+---------+                          |
|          |                   |                   |                          |
| ACCEPTED |                   |     ADJUSTED      |                          |
|          |                   | (positions moved) |                          |
+----+-----+                   +---------+---------+                          |
     |                                   |                                    |
     | text_applied                      | validation                         |
     v                                   v                                    |
+----+------+                  +---------+---------+                          |
|           |                  |     VALIDATED     |      text_changed_too_much
| COMPLETED |                  | (text still valid)| --------------------------+
|           |                  +-------------------+                          |
+-----------+                            |                                    |
                                         | text_mismatch                      |
                                         v                                    |
                               +---------+---------+                          |
                               |                   | <------------------------+
                               |    INVALIDATED    |
                               |                   |
                               +-------------------+

     user_dismisses (from any active state)
            |
            v
     +-----------+
     | DISMISSED |
     +-----------+
```

**State Descriptions**:

| State | Description | Transitions Out |
|-------|-------------|-----------------|
| PENDING | AI is generating suggestions | review_complete -> READY |
| READY | Suggestions available, none selected | user_activates -> ACTIVE, text_edit -> ADJUSTED |
| ACTIVE | User is viewing a specific suggestion | user_accepts -> ACCEPTED, user_deactivates -> INACTIVE, user_dismisses -> DISMISSED |
| INACTIVE | Suggestion exists but not focused | user_activates -> ACTIVE, text_edit -> ADJUSTED |
| ADJUSTED | Positions shifted due to edit | validation -> VALIDATED or INVALIDATED |
| VALIDATED | After adjustment, text still matches | (re-enters READY/INACTIVE) |
| INVALIDATED | Text no longer matches suggestion | (removed from store) |
| ACCEPTED | User accepted the suggestion | text_applied -> COMPLETED |
| COMPLETED | Terminal state, suggestion fully applied | (removed from store) |
| DISMISSED | User rejected the suggestion | (removed from store) |

#### 4.3.2 Highlight Manager State Machine

```typescript
/**
 * States for the overall highlight management system.
 */
type HighlightManagerState =
  | 'IDLE'           // No suggestions, ready for review
  | 'REVIEWING'      // AI is processing document
  | 'HAS_SUGGESTIONS'// Suggestions available
  | 'APPLYING'       // Currently applying a suggestion
  | 'ERROR';         // Error state, requires recovery

/**
 * Events that trigger state transitions.
 */
type HighlightManagerEvent =
  | { type: 'REQUEST_REVIEW' }
  | { type: 'REVIEW_COMPLETE'; suggestions: SuggestionHighlight[] }
  | { type: 'REVIEW_FAILED'; error: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string }
  | { type: 'DISMISS_SUGGESTION'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'TEXT_CHANGED'; editStart: number; deleteCount: number; insertLength: number }
  | { type: 'RECOVER' };

/**
 * State machine transition function.
 */
function highlightManagerTransition(
  state: HighlightManagerState,
  event: HighlightManagerEvent
): HighlightManagerState {
  switch (state) {
    case 'IDLE':
      switch (event.type) {
        case 'REQUEST_REVIEW': return 'REVIEWING';
        default: return state;
      }

    case 'REVIEWING':
      switch (event.type) {
        case 'REVIEW_COMPLETE':
          return event.suggestions.length > 0 ? 'HAS_SUGGESTIONS' : 'IDLE';
        case 'REVIEW_FAILED': return 'ERROR';
        default: return state;
      }

    case 'HAS_SUGGESTIONS':
      switch (event.type) {
        case 'ACCEPT_SUGGESTION': return 'APPLYING';
        case 'DISMISS_SUGGESTION': return 'HAS_SUGGESTIONS';  // Check if empty after
        case 'CLEAR_ALL': return 'IDLE';
        case 'TEXT_CHANGED': return 'HAS_SUGGESTIONS';  // Stay, suggestions adjusted
        case 'REQUEST_REVIEW': return 'REVIEWING';
        default: return state;
      }

    case 'APPLYING':
      // Transitions back after apply completes
      // (handled by side effects, returns to HAS_SUGGESTIONS or IDLE)
      return state;

    case 'ERROR':
      switch (event.type) {
        case 'RECOVER': return 'IDLE';
        default: return state;
      }

    default:
      return state;
  }
}
```

### 4.4 Algorithm Specification

#### 4.4.1 Accept Suggestion

```
PROCEDURE acceptSuggestion(store: SuggestionStore, documentContent: string, suggestionId: string)
  REQUIRE: suggestionId exists in store.highlights
  ENSURE: suggestion is applied to document, store is updated, undo entry created

  1. LET suggestion = store.highlights.get(suggestionId)

  2. // Validate current text matches expected
     LET currentText = documentContent.slice(suggestion.range.start, suggestion.range.end)
     IF currentText != suggestion.originalText THEN
       // Try to find the text elsewhere
       LET foundRange = findExactPosition(documentContent, suggestion.originalText,
                                           suggestion.range.start)
       IF foundRange == null THEN
         // Text no longer exists, dismiss instead
         RETURN dismissSuggestion(store, suggestionId)
       END IF
       SET suggestion.range = foundRange
     END IF

  3. // Calculate the edit parameters
     LET editStart = suggestion.range.start
     LET deleteCount = Range.length(suggestion.range)
     LET insertText = suggestion.suggestedRevision
     LET insertLength = insertText.length
     LET delta = insertLength - deleteCount

  4. // Create undo entry BEFORE making changes
     LET undoEntry = {
       type: 'ACCEPT_SUGGESTION',
       suggestionId: suggestionId,
       originalText: suggestion.originalText,
       revisedText: insertText,
       position: editStart,
       previousStoreState: store.clone()
     }
     undoManager.push(undoEntry)

  5. // Apply text change to document
     LET newDocument = documentContent.slice(0, editStart)
                       + insertText
                       + documentContent.slice(editStart + deleteCount)

  6. // Remove the accepted suggestion
     store.dispatch({ type: 'REMOVE', id: suggestionId })

  7. // Adjust remaining suggestion positions
     store.dispatch({
       type: 'APPLY_EDIT',
       editStart,
       deleteCount,
       insertLength
     })

  8. RETURN {
       newDocument,
       undoEntry
     }
```

#### 4.4.2 Batch Overlap Detection (Sweepline)

```
PROCEDURE detectOverlaps(ranges: Range[]): Map<string, string[]>
  REQUIRE: ranges is an array of Range objects with IDs
  ENSURE: returns map of rangeId -> array of overlapping rangeIds

  1. // Create events
     LET events: Event[] = []
     FOR EACH range IN ranges DO
       events.push({ pos: range.start, type: 'START', id: range.id })
       events.push({ pos: range.end, type: 'END', id: range.id })
     END FOR

  2. // Sort events: by position, then END before START at same position
     SORT events BY (a, b) =>
       IF a.pos != b.pos THEN a.pos - b.pos
       ELSE IF a.type == 'END' AND b.type == 'START' THEN -1
       ELSE IF a.type == 'START' AND b.type == 'END' THEN 1
       ELSE 0

  3. // Sweep and collect overlaps
     LET active: Set<string> = new Set()
     LET overlaps: Map<string, string[]> = new Map()

  4. FOR EACH event IN events DO
       IF event.type == 'START' THEN
         // This range overlaps with all currently active ranges
         FOR EACH activeId IN active DO
           // Add bidirectional overlap
           IF NOT overlaps.has(event.id) THEN overlaps.set(event.id, [])
           overlaps.get(event.id).push(activeId)

           IF NOT overlaps.has(activeId) THEN overlaps.set(activeId, [])
           overlaps.get(activeId).push(event.id)
         END FOR
         active.add(event.id)
       ELSE // event.type == 'END'
         active.delete(event.id)
       END IF
     END FOR

  5. RETURN overlaps
```

### 4.5 Tool Call Architecture

#### 4.5.1 Type-Safe Tool Definitions

```typescript
/**
 * Base interface for all tool parameters.
 */
interface ToolParameters {
  readonly [key: string]: unknown;
}

/**
 * Generic tool definition with type-safe parameters.
 */
interface ToolDefinition<TName extends string, TParams extends ToolParameters, TResult> {
  readonly name: TName;
  readonly description: string;
  readonly parameters: {
    readonly type: 'object';
    readonly properties: {
      readonly [K in keyof TParams]: {
        readonly type: string;
        readonly description: string;
        readonly enum?: readonly string[];
        readonly required?: boolean;
      };
    };
    readonly required: readonly (keyof TParams)[];
  };
  readonly execute: (params: TParams, context: ToolContext) => TResult | Promise<TResult>;
  readonly validate: (params: unknown) => params is TParams;
}

/**
 * Context provided to tool execution.
 */
interface ToolContext {
  readonly document: {
    readonly content: string;
    readonly lines: readonly string[];
    readonly lineMap: LineMap;
  };
  readonly store: SuggestionStoreState;
}

/**
 * Result wrapper for tool execution.
 */
type ToolResult<T> =
  | { success: true; value: T; message: string }
  | { success: false; error: string; recoverable: boolean };
```

#### 4.5.2 Highlight Tool Definition

```typescript
interface HighlightTextParams extends ToolParameters {
  readonly line_number: number;
  readonly start_column: number;
  readonly end_column: number;
  readonly original_text: string;
  readonly suggestion_type: HighlightCategory;
  readonly observation: string;
  readonly suggested_revision: string;
  readonly confidence?: number;
}

const highlightTextTool: ToolDefinition<'highlight_text', HighlightTextParams, SuggestionHighlight> = {
  name: 'highlight_text',
  description: `Highlight a specific portion of text with a suggestion for improvement.

Guidelines:
- line_number is 1-indexed (first line is 1)
- start_column and end_column are 0-indexed within the line
- original_text MUST exactly match the text at the specified position
- suggestion_type must be one of: clarity, grammar, style, structure, economy
- observation explains WHY the text needs attention
- suggested_revision is the improved version of the text
- confidence (optional) is 0-1 indicating how confident you are`,

  parameters: {
    type: 'object',
    properties: {
      line_number: {
        type: 'number',
        description: 'The 1-indexed line number where the text begins'
      },
      start_column: {
        type: 'number',
        description: 'The 0-indexed column where the highlight starts'
      },
      end_column: {
        type: 'number',
        description: 'The 0-indexed column where the highlight ends'
      },
      original_text: {
        type: 'string',
        description: 'The exact text being highlighted'
      },
      suggestion_type: {
        type: 'string',
        description: 'The category of suggestion',
        enum: ['clarity', 'grammar', 'style', 'structure', 'economy']
      },
      observation: {
        type: 'string',
        description: 'Explanation of why this text needs attention'
      },
      suggested_revision: {
        type: 'string',
        description: 'The improved version of the text'
      },
      confidence: {
        type: 'number',
        description: 'Confidence level 0-1 (optional)'
      }
    },
    required: ['line_number', 'start_column', 'end_column', 'original_text',
               'suggestion_type', 'observation', 'suggested_revision']
  },

  validate(params: unknown): params is HighlightTextParams {
    if (typeof params !== 'object' || params === null) return false;
    const p = params as Record<string, unknown>;

    return (
      typeof p.line_number === 'number' && p.line_number >= 1 &&
      typeof p.start_column === 'number' && p.start_column >= 0 &&
      typeof p.end_column === 'number' && p.end_column > p.start_column &&
      typeof p.original_text === 'string' && p.original_text.length > 0 &&
      typeof p.suggestion_type === 'string' &&
      ['clarity', 'grammar', 'style', 'structure', 'economy'].includes(p.suggestion_type) &&
      typeof p.observation === 'string' &&
      typeof p.suggested_revision === 'string' &&
      (p.confidence === undefined || (typeof p.confidence === 'number' &&
        p.confidence >= 0 && p.confidence <= 1))
    );
  },

  execute(params: HighlightTextParams, context: ToolContext): ToolResult<SuggestionHighlight> {
    const { document } = context;

    // Calculate absolute offset
    const lineIndex = params.line_number - 1;
    if (lineIndex < 0 || lineIndex >= document.lines.length) {
      return {
        success: false,
        error: `Line ${params.line_number} does not exist (document has ${document.lines.length} lines)`,
        recoverable: true
      };
    }

    const lineStart = document.lineMap.lineColumnToOffset({
      line: params.line_number,
      column: 1
    });
    const startOffset = lineStart + params.start_column;
    const endOffset = lineStart + params.end_column;

    // Validate the text matches
    const actualText = document.content.slice(startOffset, endOffset);
    if (actualText !== params.original_text) {
      // Try to find the text on the same line
      const lineContent = document.lines[lineIndex];
      const foundIndex = lineContent.indexOf(params.original_text);

      if (foundIndex === -1) {
        return {
          success: false,
          error: `Text "${params.original_text}" not found at specified position. ` +
                 `Found "${actualText}" instead.`,
          recoverable: true
        };
      }

      // Adjust to found position
      const adjustedStart = lineStart + foundIndex;
      const adjustedEnd = adjustedStart + params.original_text.length;

      const highlight: SuggestionHighlight = {
        id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        range: Range.create(adjustedStart, adjustedEnd),
        category: params.suggestion_type,
        priority: 'medium',
        originalText: params.original_text,
        observation: params.observation,
        suggestedRevision: params.suggested_revision,
        confidence: params.confidence
      };

      return {
        success: true,
        value: highlight,
        message: `Highlighted text at adjusted position (line ${params.line_number}, ` +
                 `columns ${foundIndex}-${foundIndex + params.original_text.length})`
      };
    }

    const highlight: SuggestionHighlight = {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      range: Range.create(startOffset, endOffset),
      category: params.suggestion_type,
      priority: 'medium',
      originalText: params.original_text,
      observation: params.observation,
      suggestedRevision: params.suggested_revision,
      confidence: params.confidence
    };

    return {
      success: true,
      value: highlight,
      message: `Highlighted "${params.original_text}" at line ${params.line_number}`
    };
  }
};
```

#### 4.5.3 Tool Registry and Executor

```typescript
/**
 * Registry for all available tools.
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition<string, ToolParameters, unknown>> = new Map();

  register<TName extends string, TParams extends ToolParameters, TResult>(
    tool: ToolDefinition<TName, TParams, TResult>
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<string, ToolParameters, unknown>);
  }

  get(name: string): ToolDefinition<string, ToolParameters, unknown> | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition<string, ToolParameters, unknown>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns tool definitions in the format expected by AI providers.
   */
  toProviderFormat(): Array<{
    name: string;
    description: string;
    parameters: object;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }
}

/**
 * Executes tool calls with validation and error handling.
 */
class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private contextProvider: () => ToolContext
  ) {}

  async execute(
    toolCall: { name: string; arguments: Record<string, unknown> }
  ): Promise<ToolResult<unknown>> {
    const tool = this.registry.get(toolCall.name);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
        recoverable: false
      };
    }

    // Validate parameters
    if (!tool.validate(toolCall.arguments)) {
      return {
        success: false,
        error: `Invalid parameters for tool "${toolCall.name}": ${JSON.stringify(toolCall.arguments)}`,
        recoverable: true
      };
    }

    try {
      const context = this.contextProvider();
      const result = await tool.execute(toolCall.arguments, context);
      return result as ToolResult<unknown>;
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: true
      };
    }
  }

  /**
   * Executes multiple tool calls, collecting results.
   */
  async executeBatch(
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  ): Promise<Map<string, ToolResult<unknown>>> {
    const results = new Map<string, ToolResult<unknown>>();

    for (const call of toolCalls) {
      const result = await this.execute(call);
      results.set(call.id, result);
    }

    return results;
  }
}
```

### 4.6 Undo/Redo Integration

```typescript
/**
 * Command interface for undo/redo operations.
 */
interface Command {
  readonly type: string;
  readonly execute: () => void;
  readonly undo: () => void;
  readonly description: string;
}

/**
 * Command for accepting a suggestion.
 */
class AcceptSuggestionCommand implements Command {
  readonly type = 'ACCEPT_SUGGESTION';
  readonly description: string;

  constructor(
    private suggestionId: string,
    private originalText: string,
    private revisedText: string,
    private position: number,
    private previousStoreState: SuggestionStoreState,
    private documentUpdater: (content: string) => void,
    private storeUpdater: (action: SuggestionStoreAction) => void,
    private getDocument: () => string
  ) {
    this.description = `Accept suggestion: "${originalText}" -> "${revisedText}"`;
  }

  execute(): void {
    const doc = this.getDocument();
    const newDoc = doc.slice(0, this.position) +
                   this.revisedText +
                   doc.slice(this.position + this.originalText.length);
    this.documentUpdater(newDoc);
    this.storeUpdater({ type: 'REMOVE', id: this.suggestionId });

    const delta = this.revisedText.length - this.originalText.length;
    this.storeUpdater({
      type: 'APPLY_EDIT',
      editStart: this.position,
      deleteCount: this.originalText.length,
      insertLength: this.revisedText.length
    });
  }

  undo(): void {
    const doc = this.getDocument();
    const newDoc = doc.slice(0, this.position) +
                   this.originalText +
                   doc.slice(this.position + this.revisedText.length);
    this.documentUpdater(newDoc);
    this.storeUpdater({ type: 'RESTORE', state: this.previousStoreState });
  }
}

/**
 * Manages undo/redo stack with configurable limits.
 */
class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action

    // Trim if over limit
    while (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1];
    return command?.description ?? null;
  }

  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command?.description ?? null;
  }
}
```

### 4.7 Error Handling

```typescript
/**
 * Error hierarchy for highlight management.
 */
abstract class HighlightError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
}

class RangeValidationError extends HighlightError {
  readonly code = 'RANGE_VALIDATION';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly range: Range,
    public readonly expectedText: string,
    public readonly actualText: string
  ) {
    super(message);
    this.name = 'RangeValidationError';
  }
}

class OverlapError extends HighlightError {
  readonly code = 'OVERLAP';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly newRange: Range,
    public readonly existingRanges: Range[]
  ) {
    super(message);
    this.name = 'OverlapError';
  }
}

class ToolExecutionError extends HighlightError {
  readonly code = 'TOOL_EXECUTION';
  readonly recoverable: boolean;

  constructor(
    message: string,
    public readonly toolName: string,
    public readonly params: unknown,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    this.recoverable = recoverable;
  }
}

class StateTransitionError extends HighlightError {
  readonly code = 'STATE_TRANSITION';
  readonly recoverable = false;

  constructor(
    message: string,
    public readonly currentState: string,
    public readonly event: string
  ) {
    super(message);
    this.name = 'StateTransitionError';
  }
}
```

### 4.8 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty document | Return empty suggestion set; disable review button |
| Single character document | Allow review; minimum highlight length is 1 |
| Maximum size document (10MB+) | Chunk document for review; process in batches |
| Malformed AI response | Validate each tool call; skip invalid, log warning |
| Concurrent edits during review | Cancel pending review; restart after stabilization |
| Suggestion spans multiple lines | Calculate range using LineMap; render across line breaks |
| Highlight at document end | Ensure range.end <= document.length |
| Zero-width range | Reject as invalid (end must be > start) |
| Duplicate suggestions | Deduplicate by range overlap during sweepline |
| Cyclic undo (undo -> edit -> undo) | Undo stack respects chronological order |

## 5. Implementation Guide

### 5.1 Prerequisites

**Dependencies**:
- TypeScript 5.0+
- React 18+
- No additional runtime dependencies required

**Knowledge Required**:
- Understanding of interval/range data structures
- Familiarity with finite state machines
- Experience with immutable data patterns

### 5.2 Implementation Order

1. **Range and RangeIndex** (Week 1)
   - Implement Range interface and factory functions
   - Build RangeIndex with sweepline algorithm
   - Write comprehensive unit tests

2. **SuggestionStore Reducer** (Week 1)
   - Implement pure reducer function
   - Add all action handlers
   - Test state transitions

3. **Tool Definitions** (Week 2)
   - Define type-safe tool interfaces
   - Implement highlight_text tool
   - Implement other tools (get_line_content, etc.)
   - Build tool registry and executor

4. **State Machine Integration** (Week 2)
   - Implement HighlightManager state machine
   - Connect to SuggestionStore
   - Add transition guards

5. **Undo/Redo Manager** (Week 3)
   - Implement Command pattern
   - Build AcceptSuggestionCommand
   - Integrate with existing editor

6. **React Integration** (Week 3)
   - Create new hooks (useHighlightManager, useSuggestionStore)
   - Migrate BlockEditor to new architecture
   - Update MikuContext

7. **Migration and Testing** (Week 4)
   - Feature flag for gradual rollout
   - Integration tests
   - Performance benchmarks

### 5.3 Testing Strategy

**Unit Tests**:
- Range overlap detection: 100% branch coverage
- RangeIndex operations: all methods tested
- State machine transitions: all valid and invalid transitions
- Tool validation: valid and invalid parameter combinations

**Integration Tests**:
- Accept suggestion flow: end-to-end
- Dismiss suggestion flow: end-to-end
- Undo/redo cycles: multiple levels
- Text edit with active suggestions: position updates

**Performance Benchmarks**:
- Overlap detection with 1000 ranges: < 10ms
- RangeIndex creation with 1000 items: < 5ms
- State updates with 100 suggestions: < 1ms
- Memory usage with 10000 ranges: < 5MB

### 5.4 Common Pitfalls

1. **Off-by-one errors in ranges**: Use half-open intervals [start, end) consistently
2. **Stale state in callbacks**: Use functional updates in React state setters
3. **Memory leaks in listeners**: Clean up event listeners in useEffect cleanup
4. **Race conditions in async operations**: Use AbortController for cancellation
5. **Mutation of immutable data**: Use Object.freeze in development for detection

## 6. Performance Characteristics

### 6.1 Complexity Analysis

| Operation | Current | Proposed | Improvement |
|-----------|---------|----------|-------------|
| Batch overlap detection | O(n^2) | O(n log n) | Quadratic to linearithmic |
| Point query | O(n) | O(log n + k) | Linear to logarithmic |
| Range query | O(n) | O(log n + k) | Linear to logarithmic |
| Insert suggestion | O(n) | O(n) | No change (array insert) |
| Delete suggestion | O(n) | O(n) | No change (array splice) |
| Position update (single edit) | O(n) | O(n) | No change (update all) |
| Lookup by ID | O(n) | O(1) | Linear to constant |

### 6.2 Benchmarking Methodology

```typescript
async function benchmarkOverlapDetection(sizes: number[]): Promise<void> {
  for (const n of sizes) {
    // Generate n random non-overlapping ranges
    const ranges = generateRandomRanges(n, 10000);

    const start = performance.now();
    const [index, rejected] = RangeIndex.fromArray(ranges);
    const elapsed = performance.now() - start;

    console.log(`n=${n}: ${elapsed.toFixed(2)}ms, rejected=${rejected.length}`);
  }
}

// Expected output:
// n=100: 0.5ms, rejected=0
// n=1000: 3ms, rejected=0
// n=10000: 25ms, rejected=0
```

### 6.3 Expected Performance

For a typical document with 50-200 suggestions:
- Initial review processing: < 5ms
- Accept suggestion: < 1ms
- Text edit position adjustment: < 2ms
- Highlight rendering: < 1ms per suggestion

For stress test with 1000 suggestions:
- Initial review processing: < 20ms
- Accept suggestion: < 2ms
- Text edit position adjustment: < 10ms

### 6.4 Optimization Opportunities

1. **Web Workers**: Move sweepline algorithm to worker thread for large documents
2. **Virtual Scrolling**: Only render visible highlights in BlockEditor
3. **Incremental Updates**: Skip full re-render when only positions change
4. **Memoization**: Cache highlight HTML generation with useMemo

## 7. Security Considerations

1. **XSS Prevention**: All suggestion text must be escaped before rendering in HTML
2. **Tool Call Validation**: Never trust AI-provided parameters without validation
3. **Resource Limits**: Cap maximum suggestions per review to prevent DoS
4. **Sanitization**: Strip any HTML/script tags from AI responses

## 8. Operational Considerations

### 8.1 Monitoring

```typescript
interface HighlightMetrics {
  suggestionCount: number;
  overlapDetectionTime: number;
  stateTransitions: Map<string, number>;
  toolCallSuccessRate: number;
  averageAcceptTime: number;
}
```

### 8.2 Alerting

- Alert if overlap detection exceeds 100ms
- Alert if tool call success rate drops below 90%
- Alert if state machine enters ERROR state

### 8.3 Debugging

```typescript
// Enable debug mode for verbose logging
const HIGHLIGHT_DEBUG = process.env.NODE_ENV === 'development';

function debugLog(category: string, message: string, data?: unknown): void {
  if (HIGHLIGHT_DEBUG) {
    console.log(`[Highlight:${category}] ${message}`, data);
  }
}
```

## 9. Migration Plan

### Phase 1: Parallel Implementation (Week 1-2)
- Implement new modules without touching existing code
- Comprehensive unit tests for all new code

### Phase 2: Feature Flag Integration (Week 3)
```typescript
const USE_NEW_HIGHLIGHT_MANAGER =
  process.env.NEXT_PUBLIC_NEW_HIGHLIGHT_MANAGER === 'true';
```

### Phase 3: Gradual Rollout (Week 4)
- Enable for 10% of sessions
- Monitor metrics and error rates
- Increase to 50%, then 100%

### Phase 4: Cleanup (Week 5)
- Remove feature flag
- Delete legacy code
- Update documentation

## 10. Open Questions

1. **Priority-based overlap resolution**: Should we allow overlapping highlights with different priorities, where higher priority visually "wins"?

2. **Collaborative editing**: How should highlights behave when multiple users edit simultaneously? (Deferred to future RFC)

3. **Persistence**: Should suggestion state be persisted across sessions? If so, what serialization format?

4. **Animation**: Should highlights animate when positions shift? Performance implications?

## 11. References

1. Cormen, T. H., et al. "Introduction to Algorithms" - Chapter on Interval Trees
2. Monaco Editor Source Code - Decoration handling: https://github.com/microsoft/monaco-editor
3. ProseMirror Guide - Decorations: https://prosemirror.net/docs/guide/#view.decorations
4. Language Server Protocol Specification: https://microsoft.github.io/language-server-protocol/

## Appendices

### A. Worked Examples

#### A.1 Overlap Detection Sweepline Trace

Given ranges:
- A: [0, 10]
- B: [5, 15] (overlaps with A)
- C: [20, 30]

Events:
1. pos=0, START, A -> active={A}
2. pos=5, START, B -> overlap detected (A active), B rejected
3. pos=10, END, A -> active={}
4. pos=20, START, C -> active={C}
5. pos=30, END, C -> active={}

Result: accepted=[A, C], rejected=[B]

#### A.2 Position Adjustment After Accept

Document: "The quick brown fox"
Suggestion at [4, 9]: "quick" -> "fast"

Before:
- Suggestion 1: [4, 9] "quick"
- Suggestion 2: [16, 19] "fox"

User accepts Suggestion 1:
- Edit: start=4, deleteCount=5, insertLength=4
- Delta = 4 - 5 = -1

After:
- Document: "The fast brown fox"
- Suggestion 2: [15, 18] "fox" (shifted by -1)

### B. Proof of Correctness

**Theorem**: The sweepline algorithm correctly identifies all overlapping pairs.

**Proof**: By induction on the number of events.

Base case: With 0 or 1 range, there are no overlaps. The algorithm returns an empty overlap set.

Inductive step: Assume the algorithm correctly identifies overlaps for k events. For event k+1:

Case 1 (START event): If there are active intervals, the new interval overlaps with all of them by the definition of overlapping (a.start < b.end AND b.start < a.end). Since we process events in sorted order, the active set contains exactly those intervals whose start has been processed but end has not.

Case 2 (END event): Removing from the active set does not affect overlap detection for future intervals.

Therefore, all overlapping pairs are identified. QED.

### C. Alternative Approaches Considered

#### C.1 Rope Data Structure

Considered using a rope (binary tree of strings) for document storage with integrated range annotations.

**Rejected because**:
- Significant implementation complexity
- Miku's documents are typically < 100KB where array operations are efficient
- Would require major refactoring of existing editor

#### C.2 CRDT-based Highlights

Considered implementing highlights as Conflict-free Replicated Data Types for future collaborative editing.

**Deferred because**:
- Adds significant complexity without immediate benefit
- Collaborative editing is not a current priority
- Can be added later without breaking proposed architecture

#### C.3 Canvas-based Rendering

Considered rendering highlights on a canvas overlay instead of DOM elements.

**Rejected because**:
- Breaks accessibility (screen readers, keyboard navigation)
- Complicates hit testing for click interactions
- DOM performance is adequate for expected highlight counts
