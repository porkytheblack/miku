/**
 * RangeIndex Module
 *
 * Efficient data structure for managing non-overlapping ranges.
 * Uses sweepline algorithm for batch operations and sorted array with binary search
 * for incremental updates.
 *
 * Based on RFC-001 Section 4.2.3 specifications.
 *
 * Invariants:
 *   - All stored ranges are non-overlapping
 *   - Internal array is always sorted by start position
 *   - IDs are unique
 *
 * Time Complexities:
 *   - get(id): O(1)
 *   - has(id): O(1)
 *   - delete(id): O(n)
 *   - queryPoint(point): O(log n + k)
 *   - queryRange(range): O(log n + k)
 *   - applyEdit: O(n)
 *   - fromArray: O(n log n)
 */

import {
  Range,
  rangeOverlaps,
  rangeContainsPoint,
  rangeApplyEdit,
} from './Range';
import { OverlapError, PRIORITY_VALUES, HighlightPriority } from './types';

/**
 * Constraint for items that can be stored in the RangeIndex.
 * Items must have a unique id and a range.
 */
export interface RangeIndexItem {
  readonly id: string;
  readonly range: Range;
}

/**
 * Item with priority for overlap resolution.
 */
export interface PrioritizedItem extends RangeIndexItem {
  readonly priority?: HighlightPriority;
}

/**
 * Strategy for resolving overlaps during batch operations.
 */
export type OverlapResolutionStrategy = 'keep-first' | 'keep-higher-priority' | 'reject-all';

/**
 * Event type for sweepline algorithm.
 */
interface SweeplineEvent<T extends RangeIndexItem> {
  readonly pos: number;
  readonly type: 'start' | 'end';
  readonly item: T;
}

/**
 * Result of the fromArray operation.
 */
export interface FromArrayResult<T extends RangeIndexItem> {
  readonly index: RangeIndex<T>;
  readonly rejected: readonly T[];
  readonly overlapGroups: ReadonlyMap<string, readonly string[]>;
}

/**
 * Generic class for efficient range indexing.
 * Maintains non-overlapping ranges with O(1) ID lookup and O(log n) spatial queries.
 */
export class RangeIndex<T extends RangeIndexItem> {
  /** Primary storage: items sorted by range.start */
  private items: T[] = [];

  /** Secondary index: id -> array index for O(1) lookup */
  private idIndex: Map<string, number> = new Map();

  /**
   * Private constructor. Use static factory methods to create instances.
   */
  private constructor() {}

  /**
   * Creates an empty RangeIndex.
   *
   * @returns A new empty RangeIndex
   */
  static empty<T extends RangeIndexItem>(): RangeIndex<T> {
    return new RangeIndex<T>();
  }

  /**
   * Creates a RangeIndex from an array of items.
   * Uses sweepline algorithm to detect and resolve overlaps.
   *
   * @param items - Items to index
   * @param resolveOverlap - Strategy for overlap resolution (default: 'keep-first')
   * @returns Object containing the index, rejected items, and overlap groups
   *
   * @example
   * const result = RangeIndex.fromArray(suggestions, 'keep-first');
   * console.log(`Accepted: ${result.index.size}, Rejected: ${result.rejected.length}`);
   */
  static fromArray<T extends RangeIndexItem>(
    items: readonly T[],
    resolveOverlap: OverlapResolutionStrategy = 'keep-first'
  ): FromArrayResult<T> {
    const index = new RangeIndex<T>();

    if (items.length === 0) {
      return {
        index,
        rejected: [],
        overlapGroups: new Map(),
      };
    }

    // Step 1: Create events for sweepline
    const events: SweeplineEvent<T>[] = [];

    for (const item of items) {
      events.push({ pos: item.range.start, type: 'start', item });
      events.push({ pos: item.range.end, type: 'end', item });
    }

    // Step 2: Sort events
    // Sort by position, then end events before start events at same position
    // This ensures adjacent ranges are not considered overlapping
    events.sort((a, b) => {
      if (a.pos !== b.pos) {
        return a.pos - b.pos;
      }
      // End events come before start events at the same position
      if (a.type !== b.type) {
        return a.type === 'end' ? -1 : 1;
      }
      return 0;
    });

    // Step 3: Sweep and detect overlaps
    const active: Map<string, T> = new Map();
    const accepted: Set<string> = new Set();
    const rejected: T[] = [];
    const overlapGroups: Map<string, string[]> = new Map();

    for (const event of events) {
      if (event.type === 'start') {
        if (active.size === 0) {
          // No active intervals, safe to add
          active.set(event.item.id, event.item);
          accepted.add(event.item.id);
        } else {
          // Overlap detected with all active items
          const overlappingIds = Array.from(active.keys());

          // Record the overlap
          if (!overlapGroups.has(event.item.id)) {
            overlapGroups.set(event.item.id, []);
          }
          overlapGroups.get(event.item.id)!.push(...overlappingIds);

          // Add reverse mappings
          for (const activeId of overlappingIds) {
            if (!overlapGroups.has(activeId)) {
              overlapGroups.set(activeId, []);
            }
            overlapGroups.get(activeId)!.push(event.item.id);
          }

          // Resolve overlap based on strategy
          if (resolveOverlap === 'keep-first') {
            // First item was already accepted, reject this one
            rejected.push(event.item);
          } else if (resolveOverlap === 'keep-higher-priority') {
            // Compare priorities
            const newPriority = getPriorityValue(event.item);
            let shouldReject = false;

            for (const activeItem of active.values()) {
              const activePriority = getPriorityValue(activeItem);
              if (activePriority >= newPriority) {
                shouldReject = true;
                break;
              }
            }

            if (shouldReject) {
              rejected.push(event.item);
            } else {
              // New item has higher priority, reject all active overlapping items
              for (const activeItem of active.values()) {
                if (rangeOverlaps(activeItem.range, event.item.range)) {
                  accepted.delete(activeItem.id);
                  rejected.push(activeItem);
                  active.delete(activeItem.id);
                }
              }
              active.set(event.item.id, event.item);
              accepted.add(event.item.id);
            }
          } else {
            // reject-all: reject the new item
            rejected.push(event.item);
          }
        }
      } else {
        // End event: remove from active set
        active.delete(event.item.id);
      }
    }

    // Step 4: Build the index with accepted items
    const acceptedItems = items.filter(item => accepted.has(item.id));
    acceptedItems.sort((a, b) => a.range.start - b.range.start);

    index.items = [...acceptedItems];
    index.rebuildIdIndex();

    return {
      index,
      rejected,
      overlapGroups,
    };
  }

  /**
   * Rebuilds the ID index after items array changes.
   */
  private rebuildIdIndex(): void {
    this.idIndex.clear();
    for (let i = 0; i < this.items.length; i++) {
      this.idIndex.set(this.items[i].id, i);
    }
  }

  /**
   * Gets an item by ID.
   * Time: O(1)
   *
   * @param id - The unique ID of the item
   * @returns The item if found, undefined otherwise
   */
  get(id: string): T | undefined {
    const index = this.idIndex.get(id);
    return index !== undefined ? this.items[index] : undefined;
  }

  /**
   * Checks if an ID exists in the index.
   * Time: O(1)
   *
   * @param id - The unique ID to check
   * @returns true if the ID exists
   */
  has(id: string): boolean {
    return this.idIndex.has(id);
  }

  /**
   * Removes an item by ID.
   * Time: O(n) due to array splice
   *
   * @param id - The unique ID of the item to remove
   * @returns true if the item was removed, false if not found
   */
  delete(id: string): boolean {
    const index = this.idIndex.get(id);
    if (index === undefined) {
      return false;
    }

    this.items.splice(index, 1);
    this.rebuildIdIndex();
    return true;
  }

  /**
   * Returns all items in sorted order by start position.
   * Time: O(1) - returns readonly reference
   *
   * @returns Readonly array of all items
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
   *
   * @param point - The position to query
   * @returns Array of items containing the point
   */
  queryPoint(point: number): T[] {
    if (this.items.length === 0) {
      return [];
    }

    const results: T[] = [];

    // Binary search to find the rightmost item that starts at or before the point
    let left = 0;
    let right = this.items.length - 1;
    let startIdx = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].range.start <= point) {
        startIdx = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (startIdx === -1) {
      // Point is before all ranges
      return [];
    }

    // Scan backwards from startIdx to find all ranges containing the point
    // Since ranges don't overlap, there can be at most one, but we check for safety
    for (let i = startIdx; i >= 0; i--) {
      const item = this.items[i];
      // If this range ends before or at the point, all earlier ranges also end before
      if (item.range.end <= point) {
        break;
      }
      if (rangeContainsPoint(item.range, point)) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Finds all items whose ranges overlap with the given range.
   * Time: O(log n + k) where k is the result count
   *
   * @param queryRange - The range to query for overlaps
   * @returns Array of items overlapping with the query range
   */
  queryRange(queryRange: Range): T[] {
    if (this.items.length === 0) {
      return [];
    }

    const results: T[] = [];

    // Binary search to find the first item that might overlap
    // An item can overlap if its end > queryRange.start
    let left = 0;
    let right = this.items.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].range.end <= queryRange.start) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Scan forward from 'left' to find all overlapping ranges
    for (let i = left; i < this.items.length; i++) {
      const item = this.items[i];
      // If this range starts after the query range ends, no more overlaps possible
      if (item.range.start >= queryRange.end) {
        break;
      }
      if (rangeOverlaps(item.range, queryRange)) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Applies a text edit to all ranges, removing any that become invalid.
   * Returns a new RangeIndex (immutable operation).
   * Time: O(n)
   *
   * @param editStart - Where the edit begins
   * @param deleteCount - Number of characters deleted
   * @param insertLength - Number of characters inserted
   * @returns A new RangeIndex with adjusted ranges
   */
  applyEdit(editStart: number, deleteCount: number, insertLength: number): RangeIndex<T> {
    const newIndex = new RangeIndex<T>();
    const newItems: T[] = [];

    for (const item of this.items) {
      const newRange = rangeApplyEdit(item.range, editStart, deleteCount, insertLength);
      if (newRange !== null) {
        // Create a new item with the updated range
        // We spread the item properties and override the range
        newItems.push({ ...item, range: newRange } as T);
      }
    }

    newIndex.items = newItems;
    newIndex.rebuildIdIndex();
    return newIndex;
  }

  /**
   * Creates a deep copy of the index.
   *
   * @returns A new RangeIndex with the same items
   */
  clone(): RangeIndex<T> {
    const newIndex = new RangeIndex<T>();
    newIndex.items = [...this.items];
    newIndex.rebuildIdIndex();
    return newIndex;
  }

  /**
   * Checks if adding a new range would cause an overlap.
   *
   * @param range - The range to check
   * @returns Array of IDs that would overlap with the new range
   */
  wouldOverlap(range: Range): string[] {
    return this.queryRange(range).map(item => item.id);
  }

  /**
   * Attempts to add a new item. Throws OverlapError if it would overlap.
   *
   * @param item - The item to add
   * @throws OverlapError if the new item overlaps with existing items
   * @returns A new RangeIndex with the item added
   */
  add(item: T): RangeIndex<T> {
    const overlapping = this.queryRange(item.range);
    if (overlapping.length > 0) {
      throw new OverlapError(
        `Cannot add item ${item.id}: overlaps with ${overlapping.map(o => o.id).join(', ')}`,
        item.range,
        overlapping.map(o => o.range)
      );
    }

    const newIndex = new RangeIndex<T>();

    // Find insertion position to maintain sorted order
    let insertPos = 0;
    while (insertPos < this.items.length && this.items[insertPos].range.start < item.range.start) {
      insertPos++;
    }

    newIndex.items = [
      ...this.items.slice(0, insertPos),
      item,
      ...this.items.slice(insertPos),
    ];
    newIndex.rebuildIdIndex();

    return newIndex;
  }

  /**
   * Returns an iterator over all items.
   */
  *[Symbol.iterator](): Iterator<T> {
    for (const item of this.items) {
      yield item;
    }
  }

  /**
   * Maps over all items, returning a new array.
   *
   * @param fn - Function to apply to each item
   * @returns Array of mapped results
   */
  map<U>(fn: (item: T, index: number) => U): U[] {
    return this.items.map(fn);
  }

  /**
   * Filters items, returning a new RangeIndex.
   * Note: This maintains the non-overlapping invariant by definition
   * since we're only removing items.
   *
   * @param predicate - Function to test each item
   * @returns A new RangeIndex with only matching items
   */
  filter(predicate: (item: T) => boolean): RangeIndex<T> {
    const newIndex = new RangeIndex<T>();
    newIndex.items = this.items.filter(predicate);
    newIndex.rebuildIdIndex();
    return newIndex;
  }

  /**
   * Finds the first item matching a predicate.
   *
   * @param predicate - Function to test each item
   * @returns The first matching item, or undefined
   */
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  /**
   * Checks if any item matches a predicate.
   *
   * @param predicate - Function to test each item
   * @returns true if any item matches
   */
  some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  /**
   * Checks if all items match a predicate.
   *
   * @param predicate - Function to test each item
   * @returns true if all items match
   */
  every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }

  /**
   * Gets all IDs in the index.
   *
   * @returns Array of all item IDs
   */
  getIds(): string[] {
    return Array.from(this.idIndex.keys());
  }
}

/**
 * Helper function to get the numeric priority value from an item.
 */
function getPriorityValue(item: RangeIndexItem): number {
  if ('priority' in item && typeof (item as PrioritizedItem).priority === 'string') {
    return PRIORITY_VALUES[(item as PrioritizedItem).priority as HighlightPriority];
  }
  return PRIORITY_VALUES.medium; // Default priority
}

/**
 * Detects all overlapping pairs in an array of ranges.
 * Uses the sweepline algorithm for O(n log n) complexity.
 *
 * @param items - Array of items with ranges
 * @returns Map of item ID to array of overlapping item IDs
 */
export function detectOverlaps<T extends RangeIndexItem>(
  items: readonly T[]
): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();

  if (items.length < 2) {
    return overlaps;
  }

  // Create events
  const events: SweeplineEvent<T>[] = [];
  for (const item of items) {
    events.push({ pos: item.range.start, type: 'start', item });
    events.push({ pos: item.range.end, type: 'end', item });
  }

  // Sort events
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type !== b.type) return a.type === 'end' ? -1 : 1;
    return 0;
  });

  // Sweep and collect overlaps
  const active = new Set<string>();
  const activeItems = new Map<string, T>();

  for (const event of events) {
    if (event.type === 'start') {
      // This item overlaps with all currently active items
      for (const activeId of active) {
        // Add bidirectional overlap
        if (!overlaps.has(event.item.id)) {
          overlaps.set(event.item.id, []);
        }
        overlaps.get(event.item.id)!.push(activeId);

        if (!overlaps.has(activeId)) {
          overlaps.set(activeId, []);
        }
        overlaps.get(activeId)!.push(event.item.id);
      }
      active.add(event.item.id);
      activeItems.set(event.item.id, event.item);
    } else {
      active.delete(event.item.id);
      activeItems.delete(event.item.id);
    }
  }

  return overlaps;
}
