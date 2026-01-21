import { describe, it, expect } from 'vitest';
import {
  LineMap,
  computeTextEdit,
  adjustOffset,
  adjustRange,
  adjustSuggestions,
  findExactPosition,
  validateSuggestionPositions,
} from './textPosition';
import { Suggestion } from '@/types';

describe('LineMap', () => {
  describe('offsetToLineColumn', () => {
    it('converts offset to line/column for single line', () => {
      const lineMap = new LineMap('Hello World');
      expect(lineMap.offsetToLineColumn(0)).toEqual({ line: 1, column: 1 });
      expect(lineMap.offsetToLineColumn(6)).toEqual({ line: 1, column: 7 });
    });

    it('converts offset to line/column for multiple lines', () => {
      const lineMap = new LineMap('Hello\nWorld\nTest');
      expect(lineMap.offsetToLineColumn(0)).toEqual({ line: 1, column: 1 });
      expect(lineMap.offsetToLineColumn(5)).toEqual({ line: 1, column: 6 }); // newline char
      expect(lineMap.offsetToLineColumn(6)).toEqual({ line: 2, column: 1 });
      expect(lineMap.offsetToLineColumn(12)).toEqual({ line: 3, column: 1 });
    });

    it('handles offset beyond text length', () => {
      const lineMap = new LineMap('Hello');
      expect(lineMap.offsetToLineColumn(100)).toEqual({ line: 1, column: 6 });
    });

    it('handles negative offset', () => {
      const lineMap = new LineMap('Hello');
      expect(lineMap.offsetToLineColumn(-5)).toEqual({ line: 1, column: 1 });
    });
  });

  describe('lineColumnToOffset', () => {
    it('converts line/column to offset for single line', () => {
      const lineMap = new LineMap('Hello World');
      expect(lineMap.lineColumnToOffset({ line: 1, column: 1 })).toBe(0);
      expect(lineMap.lineColumnToOffset({ line: 1, column: 7 })).toBe(6);
    });

    it('converts line/column to offset for multiple lines', () => {
      const lineMap = new LineMap('Hello\nWorld\nTest');
      expect(lineMap.lineColumnToOffset({ line: 1, column: 1 })).toBe(0);
      expect(lineMap.lineColumnToOffset({ line: 2, column: 1 })).toBe(6);
      expect(lineMap.lineColumnToOffset({ line: 3, column: 1 })).toBe(12);
    });
  });

  describe('getLine', () => {
    it('returns the correct line text', () => {
      const lineMap = new LineMap('Hello\nWorld\nTest');
      expect(lineMap.getLine(1)).toBe('Hello');
      expect(lineMap.getLine(2)).toBe('World');
      expect(lineMap.getLine(3)).toBe('Test');
    });

    it('returns empty string for invalid line numbers', () => {
      const lineMap = new LineMap('Hello\nWorld');
      expect(lineMap.getLine(0)).toBe('');
      expect(lineMap.getLine(5)).toBe('');
    });
  });

  describe('getLineCount', () => {
    it('returns correct line count', () => {
      expect(new LineMap('Hello').getLineCount()).toBe(1);
      expect(new LineMap('Hello\nWorld').getLineCount()).toBe(2);
      expect(new LineMap('Hello\nWorld\n').getLineCount()).toBe(3);
    });
  });
});

describe('computeTextEdit', () => {
  it('returns null for identical texts', () => {
    expect(computeTextEdit('Hello', 'Hello')).toBeNull();
  });

  it('detects insertion at end', () => {
    const edit = computeTextEdit('Hello', 'Hello World');
    expect(edit).toEqual({
      offset: 5,
      deleteCount: 0,
      insertText: ' World',
    });
  });

  it('detects insertion at beginning', () => {
    const edit = computeTextEdit('World', 'Hello World');
    expect(edit).toEqual({
      offset: 0,
      deleteCount: 0,
      insertText: 'Hello ',
    });
  });

  it('detects deletion', () => {
    const edit = computeTextEdit('Hello World', 'Hello');
    expect(edit).toEqual({
      offset: 5,
      deleteCount: 6,
      insertText: '',
    });
  });

  it('detects replacement', () => {
    const edit = computeTextEdit('Hello World', 'Hello Universe');
    expect(edit).toEqual({
      offset: 6,
      deleteCount: 5,
      insertText: 'Universe',
    });
  });

  it('handles insertion in middle', () => {
    const edit = computeTextEdit('Hello World', 'Hello Beautiful World');
    expect(edit).toEqual({
      offset: 6,
      deleteCount: 0,
      insertText: 'Beautiful ',
    });
  });
});

describe('adjustOffset', () => {
  it('does not change offset before edit', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'xyz' };
    expect(adjustOffset(5, edit)).toBe(5);
  });

  it('moves offset within deleted range to edit start', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'xyz' };
    expect(adjustOffset(12, edit)).toBe(10);
  });

  it('shifts offset after edit by delta (insertion)', () => {
    const edit = { offset: 10, deleteCount: 0, insertText: 'xyz' };
    expect(adjustOffset(20, edit)).toBe(23);
  });

  it('shifts offset after edit by delta (deletion)', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: '' };
    expect(adjustOffset(20, edit)).toBe(15);
  });

  it('shifts offset after edit by delta (replacement)', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'xyz' };
    expect(adjustOffset(20, edit)).toBe(18); // -5 + 3 = -2
  });
});

describe('adjustRange', () => {
  it('returns range unchanged if before edit', () => {
    const edit = { offset: 20, deleteCount: 5, insertText: 'xyz' };
    expect(adjustRange({ start: 0, end: 10 }, edit)).toEqual({ start: 0, end: 10 });
  });

  it('shifts range if after edit', () => {
    const edit = { offset: 5, deleteCount: 0, insertText: 'abc' };
    expect(adjustRange({ start: 10, end: 20 }, edit)).toEqual({ start: 13, end: 23 });
  });

  it('expands range when edit is inside range', () => {
    const edit = { offset: 5, deleteCount: 2, insertText: 'abcde' };
    expect(adjustRange({ start: 0, end: 20 }, edit)).toEqual({ start: 0, end: 23 });
  });

  it('truncates range when range ends within edit', () => {
    const edit = { offset: 10, deleteCount: 10, insertText: 'xyz' };
    expect(adjustRange({ start: 5, end: 15 }, edit)).toEqual({ start: 5, end: 10 });
  });

  it('returns null when range is completely within edit', () => {
    const edit = { offset: 5, deleteCount: 10, insertText: 'xyz' };
    expect(adjustRange({ start: 7, end: 12 }, edit)).toBeNull();
  });
});

describe('adjustSuggestions', () => {
  const baseSuggestion: Suggestion = {
    id: 'test-1',
    type: 'clarity',
    lineNumber: 1,
    columnNumber: 1,
    startIndex: 0,
    endIndex: 5,
    originalText: 'Hello',
    observation: 'Test observation',
    suggestedRevision: 'Hi',
  };

  it('returns suggestions unchanged if text is identical', () => {
    const result = adjustSuggestions([baseSuggestion], 'Hello World', 'Hello World');
    expect(result).toEqual([baseSuggestion]);
  });

  it('adjusts suggestion position after insertion before', () => {
    const suggestion = { ...baseSuggestion, startIndex: 6, endIndex: 11, originalText: 'World' };
    const result = adjustSuggestions([suggestion], 'Hello World', 'Hey Hello World');
    expect(result[0].startIndex).toBe(10);
    expect(result[0].endIndex).toBe(15);
    expect(result[0].originalText).toBe('World');
  });

  it('removes suggestion if its text was deleted', () => {
    const result = adjustSuggestions([baseSuggestion], 'Hello World', 'World');
    expect(result.length).toBe(0);
  });

  it('keeps suggestion if text is similar', () => {
    const suggestion = { ...baseSuggestion, startIndex: 0, endIndex: 5, originalText: 'Hello' };
    const result = adjustSuggestions([suggestion], 'Hello World', 'Helloo World');
    // Should keep since "Hello" is similar to "Helloo"
    expect(result.length).toBe(1);
  });
});

describe('findExactPosition', () => {
  it('finds text at approximate offset', () => {
    const result = findExactPosition('Hello World', 'World', 6, 1);
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('finds text on the same line if not at offset', () => {
    const result = findExactPosition('Hello World Test', 'World', 0, 1);
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('finds text in nearby lines', () => {
    const content = 'Line 1\nLine 2 with World\nLine 3';
    const result = findExactPosition(content, 'World', 0, 1);
    // "World" starts at position 19 in the string:
    // 'Line 1\n' = 7 chars, 'Line 2 with ' = 12 chars, total = 19
    expect(result).toEqual({ start: 19, end: 24 });
  });

  it('returns null if text not found', () => {
    const result = findExactPosition('Hello World', 'NotFound', 0, 1);
    expect(result).toBeNull();
  });
});

describe('validateSuggestionPositions', () => {
  const createSuggestion = (startIndex: number, originalText: string): Suggestion => ({
    id: `test-${startIndex}`,
    type: 'clarity',
    lineNumber: 1,
    columnNumber: startIndex + 1,
    startIndex,
    endIndex: startIndex + originalText.length,
    originalText,
    observation: 'Test',
    suggestedRevision: originalText.toUpperCase(),
  });

  it('keeps suggestions with correct positions', () => {
    const content = 'Hello World Test';
    const suggestions = [
      createSuggestion(0, 'Hello'),
      createSuggestion(6, 'World'),
    ];
    const result = validateSuggestionPositions(suggestions, content);
    expect(result.length).toBe(2);
  });

  it('corrects suggestion position if text moved', () => {
    const content = 'Prefix Hello World';
    const suggestion = createSuggestion(0, 'Hello'); // Wrong position
    const result = validateSuggestionPositions([suggestion], content);
    expect(result.length).toBe(1);
    expect(result[0].startIndex).toBe(7);
    expect(result[0].endIndex).toBe(12);
  });

  it('removes overlapping suggestions', () => {
    const content = 'Hello World';
    const suggestions = [
      createSuggestion(0, 'Hello Wor'),
      createSuggestion(6, 'World'), // Overlaps with first
    ];
    const result = validateSuggestionPositions(suggestions, content);
    expect(result.length).toBe(1);
    expect(result[0].originalText).toBe('Hello Wor');
  });

  it('removes suggestions whose text cannot be found', () => {
    const content = 'Hello World';
    const suggestion = createSuggestion(0, 'NotInText');
    const result = validateSuggestionPositions([suggestion], content);
    expect(result.length).toBe(0);
  });
});
