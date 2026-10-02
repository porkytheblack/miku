import { describe, it, expect } from 'vitest';
import { countWords, readingTimeMinutes } from '../readingTime';

describe('countWords', () => {
  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace only', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts non-whitespace sequences', () => {
    expect(countWords('the quick brown fox')).toBe(4);
  });

  it('collapses repeated whitespace and newlines', () => {
    expect(countWords('line one\nline  two\t\tline three')).toBe(6);
  });
});

describe('readingTimeMinutes', () => {
  it('returns null for empty text', () => {
    expect(readingTimeMinutes('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(readingTimeMinutes('   \n  ')).toBeNull();
  });

  it('rounds to the nearest minute', () => {
    expect(readingTimeMinutes('a'.repeat(10))).toBe(1);
    // 400 words -> 2 minutes
    expect(readingTimeMinutes(Array(400).fill('word').join(' '))).toBe(2);
    // 300 words -> 1.5 -> rounds to 2
    expect(readingTimeMinutes(Array(300).fill('word').join(' '))).toBe(2);
  });

  it('has a minimum of one minute for any non-empty text', () => {
    expect(readingTimeMinutes('hello')).toBe(1);
  });
});