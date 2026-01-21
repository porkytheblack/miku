/**
 * Text Position Utilities
 *
 * This module provides utilities for:
 * 1. Converting between character offsets and line/column positions
 * 2. Computing text diffs and mapping position changes
 * 3. Adjusting suggestion positions when text is edited
 *
 * Based on algorithms used by Grammarly, Monaco Editor, and similar tools.
 */

import { Suggestion } from '@/types';

/**
 * Represents a position in text as line and column (1-indexed)
 */
export interface LineColumn {
  line: number;   // 1-indexed line number
  column: number; // 1-indexed column number
}

/**
 * Represents a range in text using character offsets
 */
export interface OffsetRange {
  start: number;
  end: number;
}

/**
 * Represents a range in text using line/column positions
 */
export interface LineColumnRange {
  start: LineColumn;
  end: LineColumn;
}

/**
 * Represents a single edit operation
 */
export interface TextEdit {
  offset: number;      // Where the edit starts
  deleteCount: number; // How many characters were deleted
  insertText: string;  // What was inserted
}

/**
 * A line map for fast offset <-> line/column conversions
 * Stores the starting offset of each line
 */
export class LineMap {
  private lineStarts: number[];
  private text: string;

  constructor(text: string) {
    this.text = text;
    this.lineStarts = this.computeLineStarts(text);
  }

  private computeLineStarts(text: string): number[] {
    const starts: number[] = [0]; // Line 1 starts at offset 0

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        starts.push(i + 1);
      }
    }

    return starts;
  }

  /**
   * Convert a character offset to line/column position
   */
  offsetToLineColumn(offset: number): LineColumn {
    if (offset < 0) offset = 0;
    if (offset > this.text.length) offset = this.text.length;

    // Binary search to find the line
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.lineStarts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    const line = low + 1; // 1-indexed
    const column = offset - this.lineStarts[low] + 1; // 1-indexed

    return { line, column };
  }

  /**
   * Convert line/column position to character offset
   */
  lineColumnToOffset(pos: LineColumn): number {
    const lineIndex = Math.max(0, Math.min(pos.line - 1, this.lineStarts.length - 1));
    const lineStart = this.lineStarts[lineIndex];

    // Calculate line length
    const lineEnd = lineIndex + 1 < this.lineStarts.length
      ? this.lineStarts[lineIndex + 1] - 1 // Exclude newline
      : this.text.length;
    const lineLength = lineEnd - lineStart + 1;

    // Clamp column to valid range
    const column = Math.max(1, Math.min(pos.column, lineLength));

    return lineStart + column - 1;
  }

  /**
   * Get text for a specific line (1-indexed)
   */
  getLine(lineNumber: number): string {
    const lineIndex = lineNumber - 1;
    if (lineIndex < 0 || lineIndex >= this.lineStarts.length) {
      return '';
    }

    const start = this.lineStarts[lineIndex];
    const end = lineIndex + 1 < this.lineStarts.length
      ? this.lineStarts[lineIndex + 1] - 1 // Exclude newline
      : this.text.length;

    return this.text.slice(start, end);
  }

  /**
   * Get total number of lines
   */
  getLineCount(): number {
    return this.lineStarts.length;
  }

  /**
   * Get the full text
   */
  getText(): string {
    return this.text;
  }
}

/**
 * Compute the minimal edit to transform oldText into newText
 * Uses Myers diff algorithm simplified for single-edit detection
 */
export function computeTextEdit(oldText: string, newText: string): TextEdit | null {
  if (oldText === newText) {
    return null;
  }

  const oldLen = oldText.length;
  const newLen = newText.length;

  // Find common prefix
  let prefixLen = 0;
  const maxPrefix = Math.min(oldLen, newLen);
  while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (but don't overlap with prefix)
  let suffixLen = 0;
  const maxSuffix = Math.min(oldLen - prefixLen, newLen - prefixLen);
  while (
    suffixLen < maxSuffix &&
    oldText[oldLen - 1 - suffixLen] === newText[newLen - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Calculate the edit
  const deleteCount = oldLen - prefixLen - suffixLen;
  const insertText = newText.slice(prefixLen, newLen - suffixLen);

  return {
    offset: prefixLen,
    deleteCount,
    insertText,
  };
}

/**
 * Adjust a position after a text edit
 */
export function adjustOffset(offset: number, edit: TextEdit): number {
  // Position is before the edit - no change
  if (offset <= edit.offset) {
    return offset;
  }

  // Position is within the deleted range - move to edit start
  if (offset < edit.offset + edit.deleteCount) {
    return edit.offset;
  }

  // Position is after the edit - shift by the delta
  const delta = edit.insertText.length - edit.deleteCount;
  return offset + delta;
}

/**
 * Adjust a range after a text edit
 * Returns null if the range was completely deleted
 */
export function adjustRange(range: OffsetRange, edit: TextEdit): OffsetRange | null {
  const editEnd = edit.offset + edit.deleteCount;

  // Range is completely before the edit
  if (range.end <= edit.offset) {
    return range;
  }

  // Range is completely after the edit
  if (range.start >= editEnd) {
    const delta = edit.insertText.length - edit.deleteCount;
    return {
      start: range.start + delta,
      end: range.end + delta,
    };
  }

  // Range overlaps with the edit

  // Edit is completely within the range
  if (range.start <= edit.offset && range.end >= editEnd) {
    const delta = edit.insertText.length - edit.deleteCount;
    return {
      start: range.start,
      end: range.end + delta,
    };
  }

  // Range starts before edit but ends within/at edit
  if (range.start < edit.offset && range.end <= editEnd) {
    // Truncate to edit start
    return {
      start: range.start,
      end: edit.offset,
    };
  }

  // Range starts within edit but ends after
  if (range.start >= edit.offset && range.start < editEnd && range.end > editEnd) {
    const delta = edit.insertText.length - edit.deleteCount;
    return {
      start: edit.offset + edit.insertText.length,
      end: range.end + delta,
    };
  }

  // Range is completely within the deleted region
  if (range.start >= edit.offset && range.end <= editEnd) {
    return null; // Range was deleted
  }

  // Shouldn't reach here, but return unchanged as fallback
  return range;
}

/**
 * Adjust all suggestions after a text edit
 */
export function adjustSuggestions(
  suggestions: Suggestion[],
  oldText: string,
  newText: string
): Suggestion[] {
  const edit = computeTextEdit(oldText, newText);

  if (!edit) {
    return suggestions;
  }

  const adjusted: Suggestion[] = [];
  const newLineMap = new LineMap(newText);

  for (const suggestion of suggestions) {
    const newRange = adjustRange(
      { start: suggestion.startIndex, end: suggestion.endIndex },
      edit
    );

    if (newRange === null) {
      // Suggestion was deleted - skip it
      continue;
    }

    // Validate the range is still within bounds
    if (newRange.start < 0 || newRange.end > newText.length || newRange.start >= newRange.end) {
      continue;
    }

    // Get the new text at this position
    const newOriginalText = newText.slice(newRange.start, newRange.end);

    // Check if the text still roughly matches (allow for minor differences)
    // This prevents highlighting completely different text
    if (!textsAreSimilar(suggestion.originalText, newOriginalText)) {
      continue;
    }

    // Update the suggestion with new positions
    const newLineCol = newLineMap.offsetToLineColumn(newRange.start);

    adjusted.push({
      ...suggestion,
      startIndex: newRange.start,
      endIndex: newRange.end,
      lineNumber: newLineCol.line,
      originalText: newOriginalText,
    });
  }

  return adjusted;
}

/**
 * Check if two texts are similar enough to keep a suggestion
 * Uses Levenshtein distance ratio
 */
function textsAreSimilar(text1: string, text2: string, threshold = 0.7): boolean {
  if (text1 === text2) return true;
  if (!text1 || !text2) return false;

  // Quick check: if lengths are too different, they're not similar
  const lenRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
  if (lenRatio < threshold) return false;

  // Check if one is a substring of the other (common during typing)
  if (text1.includes(text2) || text2.includes(text1)) return true;

  // Calculate simple similarity (character overlap)
  const chars1 = new Set(text1.toLowerCase());
  const chars2 = new Set(text2.toLowerCase());
  const intersection = [...chars1].filter(c => chars2.has(c)).length;
  const unionSet = new Set([...chars1, ...chars2]);
  const similarity = intersection / unionSet.size;

  return similarity >= threshold;
}

/**
 * Find the exact position to highlight based on the original text
 * This handles cases where the text might appear multiple times
 */
export function findExactPosition(
  content: string,
  originalText: string,
  approximateOffset: number,
  lineNumber: number
): OffsetRange | null {
  const lineMap = new LineMap(content);

  // First, try to find at the approximate offset
  if (approximateOffset >= 0 && approximateOffset + originalText.length <= content.length) {
    const textAtOffset = content.slice(approximateOffset, approximateOffset + originalText.length);
    if (textAtOffset === originalText) {
      return { start: approximateOffset, end: approximateOffset + originalText.length };
    }
  }

  // If not found at exact offset, search on the same line
  const lineText = lineMap.getLine(lineNumber);
  const lineStart = lineMap.lineColumnToOffset({ line: lineNumber, column: 1 });

  const indexInLine = lineText.indexOf(originalText);
  if (indexInLine !== -1) {
    const start = lineStart + indexInLine;
    return { start, end: start + originalText.length };
  }

  // Search in nearby lines (±2 lines)
  for (let delta = 1; delta <= 2; delta++) {
    for (const offset of [-delta, delta]) {
      const searchLine = lineNumber + offset;
      if (searchLine < 1 || searchLine > lineMap.getLineCount()) continue;

      const searchLineText = lineMap.getLine(searchLine);
      const idx = searchLineText.indexOf(originalText);
      if (idx !== -1) {
        const searchLineStart = lineMap.lineColumnToOffset({ line: searchLine, column: 1 });
        const start = searchLineStart + idx;
        return { start, end: start + originalText.length };
      }
    }
  }

  // Last resort: search entire document
  const globalIndex = content.indexOf(originalText);
  if (globalIndex !== -1) {
    return { start: globalIndex, end: globalIndex + originalText.length };
  }

  return null;
}

/**
 * Validate and fix suggestion positions against current content
 * Returns suggestions with corrected positions, filtering out overlaps
 */
export function validateSuggestionPositions(
  suggestions: Suggestion[],
  content: string
): Suggestion[] {
  const lineMap = new LineMap(content);
  const validated: Suggestion[] = [];
  const usedRanges: OffsetRange[] = [];

  // Helper to check if a range overlaps with any used range
  const hasOverlap = (range: OffsetRange): boolean => {
    return usedRanges.some(
      used =>
        (range.start >= used.start && range.start < used.end) ||
        (range.end > used.start && range.end <= used.end) ||
        (range.start <= used.start && range.end >= used.end)
    );
  };

  for (const suggestion of suggestions) {
    // Check if current position is valid
    const currentText = content.slice(suggestion.startIndex, suggestion.endIndex);
    const currentRange: OffsetRange = { start: suggestion.startIndex, end: suggestion.endIndex };

    console.log(`[validatePositions] Checking ${suggestion.id}:`, {
      originalText: JSON.stringify(suggestion.originalText),
      currentText: JSON.stringify(currentText),
      matches: currentText === suggestion.originalText,
      startIndex: suggestion.startIndex,
      endIndex: suggestion.endIndex,
    });

    if (currentText === suggestion.originalText) {
      // Position is correct, but check for overlaps
      if (!hasOverlap(currentRange)) {
        console.log(`[validatePositions] ${suggestion.id}: Position correct, adding`);
        validated.push(suggestion);
        usedRanges.push(currentRange);
      } else {
        console.log(`[validatePositions] ${suggestion.id}: Overlaps with existing, skipping`);
      }
      continue;
    }

    // Try to find the correct position
    console.log(`[validatePositions] ${suggestion.id}: Position wrong, searching for correct position...`);
    const correctRange = findExactPosition(
      content,
      suggestion.originalText,
      suggestion.startIndex,
      suggestion.lineNumber
    );

    if (correctRange) {
      console.log(`[validatePositions] ${suggestion.id}: Found at`, correctRange);
      if (!hasOverlap(correctRange)) {
        const lineCol = lineMap.offsetToLineColumn(correctRange.start);
        validated.push({
          ...suggestion,
          startIndex: correctRange.start,
          endIndex: correctRange.end,
          lineNumber: lineCol.line,
        });
        usedRanges.push(correctRange);
      } else {
        console.log(`[validatePositions] ${suggestion.id}: New position overlaps, skipping`);
      }
    } else {
      console.log(`[validatePositions] ${suggestion.id}: Could not find text in content`);
    }
  }

  return validated;
}
