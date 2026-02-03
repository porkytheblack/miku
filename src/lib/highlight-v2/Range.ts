/**
 * Range Module
 *
 * Provides an immutable Range type for representing text spans with character offsets.
 * Implements all operations specified in RFC-001 Section 4.2.1.
 *
 * Invariants:
 *   - start >= 0
 *   - end >= start
 *   - start and end are integers
 *
 * Uses half-open interval notation [start, end) where:
 *   - start is inclusive
 *   - end is exclusive
 */

/**
 * Represents an immutable text range with character offsets.
 * The range uses half-open interval semantics [start, end).
 */
export interface Range {
  readonly start: number;
  readonly end: number;
}

/**
 * Error thrown when attempting to create an invalid range.
 */
export class RangeValidationError extends Error {
  constructor(
    message: string,
    public readonly start: number,
    public readonly end: number
  ) {
    super(message);
    this.name = 'RangeValidationError';
    Object.setPrototypeOf(this, RangeValidationError.prototype);
  }
}

/**
 * Creates a new Range, validating invariants.
 *
 * @param start - The starting offset (inclusive)
 * @param end - The ending offset (exclusive)
 * @returns A frozen Range object
 * @throws RangeValidationError if start > end, either is negative, or either is not an integer
 *
 * @example
 * const range = createRange(0, 10); // Creates range [0, 10)
 */
export function createRange(start: number, end: number): Range {
  if (!Number.isInteger(start)) {
    throw new RangeValidationError(
      `Invalid range: start must be an integer, got ${start}`,
      start,
      end
    );
  }
  if (!Number.isInteger(end)) {
    throw new RangeValidationError(
      `Invalid range: end must be an integer, got ${end}`,
      start,
      end
    );
  }
  if (start < 0) {
    throw new RangeValidationError(
      `Invalid range: start must be non-negative, got ${start}`,
      start,
      end
    );
  }
  if (end < start) {
    throw new RangeValidationError(
      `Invalid range: end (${end}) must be >= start (${start})`,
      start,
      end
    );
  }
  return Object.freeze({ start, end });
}

/**
 * Returns the length of the range (number of characters it spans).
 *
 * @param range - The range to measure
 * @returns The length (end - start)
 *
 * @example
 * rangeLength(createRange(5, 10)); // Returns 5
 */
export function rangeLength(range: Range): number {
  return range.end - range.start;
}

/**
 * Checks if two ranges overlap (share at least one position).
 * Adjacent ranges (one ends where another starts) do NOT overlap.
 *
 * Two ranges [a.start, a.end) and [b.start, b.end) overlap if and only if:
 *   a.start < b.end AND b.start < a.end
 *
 * @param a - First range
 * @param b - Second range
 * @returns true if the ranges share at least one character position
 *
 * @example
 * rangeOverlaps(createRange(0, 10), createRange(5, 15)); // true (overlap at 5-10)
 * rangeOverlaps(createRange(0, 10), createRange(10, 20)); // false (adjacent, no overlap)
 */
export function rangeOverlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Checks if range `a` contains range `b` entirely.
 * A range contains another if the contained range's start and end are
 * both within the containing range.
 *
 * @param a - The potentially containing range
 * @param b - The potentially contained range
 * @returns true if a contains b entirely
 *
 * @example
 * rangeContains(createRange(0, 20), createRange(5, 15)); // true
 * rangeContains(createRange(5, 15), createRange(0, 20)); // false
 */
export function rangeContains(a: Range, b: Range): boolean {
  return a.start <= b.start && a.end >= b.end;
}

/**
 * Checks if a point falls within the range (inclusive start, exclusive end).
 *
 * @param range - The range to check
 * @param point - The point to check
 * @returns true if start <= point < end
 *
 * @example
 * rangeContainsPoint(createRange(5, 10), 7); // true
 * rangeContainsPoint(createRange(5, 10), 5); // true (start is inclusive)
 * rangeContainsPoint(createRange(5, 10), 10); // false (end is exclusive)
 */
export function rangeContainsPoint(range: Range, point: number): boolean {
  return point >= range.start && point < range.end;
}

/**
 * Applies a text edit to a range, returning the adjusted range or null if deleted.
 *
 * This function handles all 6 edit cases from RFC-001 Section 4.2.1:
 *
 * Case 1: Range is completely before edit - no change
 * Case 2: Range is completely after edit - shift by delta
 * Case 3: Range is completely within deleted region - deleted (return null)
 * Case 4: Edit is completely within range - adjust end by delta
 * Case 5: Range starts before edit, ends within deleted region - truncate to edit start
 * Case 6: Range starts within deleted region, ends after - shift start to after inserted text
 *
 * @param range - The range to adjust
 * @param editStart - Where the edit begins
 * @param deleteCount - Number of characters deleted
 * @param insertLength - Number of characters inserted
 * @returns Adjusted range, or null if the range was completely deleted
 *
 * @example
 * // Case 2: Range after edit, edit inserts more than it deletes
 * rangeApplyEdit(createRange(20, 30), 5, 3, 10);
 * // Returns { start: 27, end: 37 } (shifted by delta = 10 - 3 = 7)
 */
export function rangeApplyEdit(
  range: Range,
  editStart: number,
  deleteCount: number,
  insertLength: number
): Range | null {
  const editEnd = editStart + deleteCount;
  const delta = insertLength - deleteCount;

  // Case 1: Range is completely before edit - no change
  // If the range ends at or before the edit start, it's unaffected
  if (range.end <= editStart) {
    return range;
  }

  // Case 2: Range is completely after edit - shift by delta
  // If the range starts at or after the edit end, shift the entire range
  if (range.start >= editEnd) {
    return createRange(range.start + delta, range.end + delta);
  }

  // Case 3: Range is completely within deleted region - deleted
  // The entire range falls within [editStart, editEnd)
  if (range.start >= editStart && range.end <= editEnd) {
    return null;
  }

  // Case 4: Edit is completely within range - adjust end
  // The edit happens entirely inside the range
  if (range.start <= editStart && range.end >= editEnd) {
    return createRange(range.start, range.end + delta);
  }

  // Case 5: Range starts before edit, ends within deleted region - truncate
  // Range overlaps the start of the edit
  if (range.start < editStart && range.end <= editEnd) {
    const newEnd = editStart;
    // If truncation results in zero-length range, treat as deleted
    if (newEnd <= range.start) {
      return null;
    }
    return createRange(range.start, newEnd);
  }

  // Case 6: Range starts within deleted region, ends after - shift start
  // Range overlaps the end of the edit
  if (range.start >= editStart && range.start < editEnd && range.end > editEnd) {
    const newStart = editStart + insertLength;
    const newEnd = range.end + delta;
    // If the new range is invalid (start >= end), treat as deleted
    if (newEnd <= newStart) {
      return null;
    }
    return createRange(newStart, newEnd);
  }

  // Fallback: should not reach here given the above cases are exhaustive
  // Return unchanged as a safety measure
  return range;
}

/**
 * Checks if a range is valid (satisfies all invariants).
 *
 * @param range - The range to validate
 * @returns true if the range is valid
 */
export function isValidRange(range: Range): boolean {
  return (
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end >= range.start
  );
}

/**
 * Compares two ranges by their start position.
 * Useful for sorting ranges.
 *
 * @param a - First range
 * @param b - Second range
 * @returns Negative if a starts before b, positive if after, 0 if same start
 */
export function compareRangesByStart(a: Range, b: Range): number {
  return a.start - b.start;
}

/**
 * Creates a range from an existing range-like object.
 * Useful for converting untyped objects to proper Range instances.
 *
 * @param obj - An object with start and end properties
 * @returns A new frozen Range
 * @throws RangeValidationError if the object doesn't have valid start/end values
 */
export function rangeFrom(obj: { start: number; end: number }): Range {
  return createRange(obj.start, obj.end);
}

/**
 * Calculates the intersection of two ranges.
 *
 * @param a - First range
 * @param b - Second range
 * @returns The intersection range, or null if ranges don't overlap
 *
 * @example
 * rangeIntersection(createRange(0, 10), createRange(5, 15));
 * // Returns { start: 5, end: 10 }
 */
export function rangeIntersection(a: Range, b: Range): Range | null {
  if (!rangeOverlaps(a, b)) {
    return null;
  }
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return createRange(start, end);
}

/**
 * Calculates the union of two overlapping or adjacent ranges.
 *
 * @param a - First range
 * @param b - Second range
 * @returns The union range, or null if ranges are not overlapping or adjacent
 *
 * @example
 * rangeUnion(createRange(0, 10), createRange(5, 15));
 * // Returns { start: 0, end: 15 }
 */
export function rangeUnion(a: Range, b: Range): Range | null {
  // Check if ranges overlap or are adjacent
  if (a.end < b.start || b.end < a.start) {
    return null;
  }
  const start = Math.min(a.start, b.start);
  const end = Math.max(a.end, b.end);
  return createRange(start, end);
}
