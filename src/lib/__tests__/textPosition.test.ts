import { describe, it, expect } from 'vitest';
import {
  LineMap,
  computeTextEdit,
  adjustOffset,
  adjustRange,
  adjustSuggestions,
  validateSuggestionPositions,
  findExactPosition,
} from '../textPosition';
import { Suggestion } from '@/types';

describe('LineMap', () => {
  describe('offsetToLineColumn', () => {
    it('should convert offset to line/column for single line', () => {
      const lineMap = new LineMap('hello world');
      expect(lineMap.offsetToLineColumn(0)).toEqual({ line: 1, column: 1 });
      expect(lineMap.offsetToLineColumn(5)).toEqual({ line: 1, column: 6 });
      expect(lineMap.offsetToLineColumn(11)).toEqual({ line: 1, column: 12 });
    });

    it('should convert offset to line/column for multiple lines', () => {
      const lineMap = new LineMap('hello\nworld\ntest');
      expect(lineMap.offsetToLineColumn(0)).toEqual({ line: 1, column: 1 });
      expect(lineMap.offsetToLineColumn(5)).toEqual({ line: 1, column: 6 }); // newline
      expect(lineMap.offsetToLineColumn(6)).toEqual({ line: 2, column: 1 }); // 'w'
      expect(lineMap.offsetToLineColumn(11)).toEqual({ line: 2, column: 6 }); // newline
      expect(lineMap.offsetToLineColumn(12)).toEqual({ line: 3, column: 1 }); // 't'
    });

    it('should handle empty string', () => {
      const lineMap = new LineMap('');
      expect(lineMap.offsetToLineColumn(0)).toEqual({ line: 1, column: 1 });
    });
  });

  describe('lineColumnToOffset', () => {
    it('should convert line/column to offset', () => {
      const lineMap = new LineMap('hello\nworld\ntest');
      expect(lineMap.lineColumnToOffset({ line: 1, column: 1 })).toBe(0);
      expect(lineMap.lineColumnToOffset({ line: 2, column: 1 })).toBe(6);
      expect(lineMap.lineColumnToOffset({ line: 3, column: 1 })).toBe(12);
    });

    it('should handle edge cases', () => {
      const lineMap = new LineMap('hello');
      expect(lineMap.lineColumnToOffset({ line: 1, column: 6 })).toBe(5); // last char
    });
  });

  describe('getLine', () => {
    it('should return the correct line content', () => {
      const lineMap = new LineMap('hello\nworld\ntest');
      expect(lineMap.getLine(1)).toBe('hello');
      expect(lineMap.getLine(2)).toBe('world');
      expect(lineMap.getLine(3)).toBe('test');
    });

    it('should return empty string for invalid line numbers', () => {
      const lineMap = new LineMap('hello');
      expect(lineMap.getLine(0)).toBe('');
      expect(lineMap.getLine(2)).toBe('');
    });
  });
});

describe('computeTextEdit', () => {
  it('should return null for identical texts', () => {
    expect(computeTextEdit('hello', 'hello')).toBeNull();
  });

  it('should detect insertion at end', () => {
    const edit = computeTextEdit('hello', 'hello world');
    expect(edit).toEqual({
      offset: 5,
      deleteCount: 0,
      insertText: ' world',
    });
  });

  it('should detect insertion at start', () => {
    const edit = computeTextEdit('world', 'hello world');
    expect(edit).toEqual({
      offset: 0,
      deleteCount: 0,
      insertText: 'hello ',
    });
  });

  it('should detect deletion', () => {
    const edit = computeTextEdit('hello world', 'hello');
    expect(edit).toEqual({
      offset: 5,
      deleteCount: 6,
      insertText: '',
    });
  });

  it('should detect replacement', () => {
    const edit = computeTextEdit('hello world', 'hello there');
    expect(edit).toEqual({
      offset: 6,
      deleteCount: 5,
      insertText: 'there',
    });
  });

  it('should detect single character insertion', () => {
    const edit = computeTextEdit('helo', 'hello');
    expect(edit).toEqual({
      offset: 3,
      deleteCount: 0,
      insertText: 'l',
    });
  });
});

describe('adjustOffset', () => {
  it('should not change offset before edit', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    expect(adjustOffset(5, edit)).toBe(5);
  });

  it('should move offset at edit point to edit start', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    expect(adjustOffset(12, edit)).toBe(10);
  });

  it('should shift offset after edit by delta', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    // Delta = 3 - 5 = -2
    expect(adjustOffset(20, edit)).toBe(18);
  });

  it('should handle pure insertion', () => {
    const edit = { offset: 10, deleteCount: 0, insertText: 'abc' };
    expect(adjustOffset(15, edit)).toBe(18); // shifted by 3
  });
});

describe('adjustRange', () => {
  it('should not change range before edit', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    expect(adjustRange({ start: 0, end: 5 }, edit)).toEqual({ start: 0, end: 5 });
  });

  it('should shift range after edit', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    // Delta = 3 - 5 = -2
    expect(adjustRange({ start: 20, end: 25 }, edit)).toEqual({ start: 18, end: 23 });
  });

  it('should return null when range is completely deleted', () => {
    const edit = { offset: 5, deleteCount: 10, insertText: '' };
    expect(adjustRange({ start: 7, end: 12 }, edit)).toBeNull();
  });

  it('should truncate range that starts before and ends within edit', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    expect(adjustRange({ start: 5, end: 12 }, edit)).toEqual({ start: 5, end: 10 });
  });

  it('should handle edit completely within range', () => {
    const edit = { offset: 10, deleteCount: 5, insertText: 'abc' };
    // Range [5, 20] contains edit [10, 15]
    // Delta = 3 - 5 = -2, so end becomes 18
    expect(adjustRange({ start: 5, end: 20 }, edit)).toEqual({ start: 5, end: 18 });
  });
});

describe('adjustSuggestions', () => {
  const createSuggestion = (id: string, start: number, end: number, text: string): Suggestion => ({
    id,
    type: 'grammar',
    lineNumber: 1,
    columnNumber: start + 1,
    startIndex: start,
    endIndex: end,
    originalText: text,
    observation: 'Test',
    suggestedRevision: text,
  });

  it('should return suggestions unchanged when text is unchanged', () => {
    const suggestions = [createSuggestion('1', 0, 5, 'hello')];
    const result = adjustSuggestions(suggestions, 'hello world', 'hello world');
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(5);
  });

  it('should adjust suggestions after text insertion', () => {
    const suggestions = [createSuggestion('1', 6, 11, 'world')];
    // Insert "new " at position 6
    const result = adjustSuggestions(suggestions, 'hello world', 'hello new world');
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(10);
    expect(result[0].endIndex).toBe(15);
  });

  it('should remove suggestions when text is deleted', () => {
    const suggestions = [createSuggestion('1', 6, 11, 'world')];
    // Delete "world"
    const result = adjustSuggestions(suggestions, 'hello world', 'hello ');
    expect(result).toHaveLength(0);
  });

  it('should keep suggestions that still match', () => {
    const suggestions = [createSuggestion('1', 0, 5, 'hello')];
    // Add text at end
    const result = adjustSuggestions(suggestions, 'hello world', 'hello world!');
    expect(result).toHaveLength(1);
    expect(result[0].originalText).toBe('hello');
  });
});

describe('findExactPosition', () => {
  it('should find text at exact offset', () => {
    const result = findExactPosition('hello world', 'world', 6, 1);
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('should find text on same line when offset is wrong', () => {
    const result = findExactPosition('hello world', 'world', 0, 1);
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('should find text on different line', () => {
    const result = findExactPosition('hello\nworld', 'world', 0, 2);
    expect(result).toEqual({ start: 6, end: 11 });
  });

  it('should return null when text is not found', () => {
    const result = findExactPosition('hello world', 'foo', 0, 1);
    expect(result).toBeNull();
  });
});

describe('validateSuggestionPositions', () => {
  const createSuggestion = (id: string, start: number, end: number, text: string): Suggestion => ({
    id,
    type: 'grammar',
    lineNumber: 1,
    columnNumber: start + 1,
    startIndex: start,
    endIndex: end,
    originalText: text,
    observation: 'Test',
    suggestedRevision: text,
  });

  it('should keep valid suggestions', () => {
    const suggestions = [createSuggestion('1', 0, 5, 'hello')];
    const result = validateSuggestionPositions(suggestions, 'hello world');
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(5);
  });

  it('should fix invalid positions', () => {
    const suggestions = [createSuggestion('1', 0, 5, 'world')]; // wrong position
    const result = validateSuggestionPositions(suggestions, 'hello world');
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(6);
    expect(result[0].endIndex).toBe(11);
  });

  it('should remove suggestions that cannot be found', () => {
    const suggestions = [createSuggestion('1', 0, 5, 'foo')];
    const result = validateSuggestionPositions(suggestions, 'hello world');
    expect(result).toHaveLength(0);
  });

  it('should prevent overlapping highlights', () => {
    const suggestions = [
      createSuggestion('1', 0, 11, 'hello world'),
      createSuggestion('2', 6, 11, 'world'), // overlaps with first
    ];
    const result = validateSuggestionPositions(suggestions, 'hello world');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});
