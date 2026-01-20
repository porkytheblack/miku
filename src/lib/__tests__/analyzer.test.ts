import { describe, it, expect } from 'vitest';
import { analyzeSuggestions } from '../analyzer';

describe('analyzeSuggestions', () => {
  describe('long sentence detection', () => {
    it('should detect sentences over 30 words', () => {
      const longSentence = 'This is a very long sentence that contains more than thirty words and should definitely be flagged by our analyzer because it is way too long for comfortable reading and comprehension by most readers who prefer shorter sentences.';
      const suggestions = analyzeSuggestions(longSentence);

      const claritySuggestion = suggestions.find(s => s.type === 'clarity');
      expect(claritySuggestion).toBeDefined();
      expect(claritySuggestion?.observation).toContain('words');
    });

    it('should not flag short sentences', () => {
      const shortText = 'This is short. This is also short.';
      const suggestions = analyzeSuggestions(shortText);

      const claritySuggestion = suggestions.find(s => s.type === 'clarity');
      expect(claritySuggestion).toBeUndefined();
    });
  });

  describe('redundant phrase detection', () => {
    it('should detect "in order to"', () => {
      const text = 'I went to the store in order to buy milk.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion).toBeDefined();
      expect(economySuggestion?.originalText).toBe('in order to');
      expect(economySuggestion?.suggestedRevision).toBe('to');
    });

    it('should detect "very unique"', () => {
      const text = 'This is a very unique opportunity.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion).toBeDefined();
      expect(economySuggestion?.suggestedRevision).toBe('unique');
    });

    it('should detect "past history"', () => {
      const text = 'Looking at the past history of this company.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion).toBeDefined();
      expect(economySuggestion?.suggestedRevision).toBe('history');
    });

    it('should detect "due to the fact that"', () => {
      const text = 'I was late due to the fact that traffic was bad.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion).toBeDefined();
      expect(economySuggestion?.suggestedRevision).toBe('because');
    });
  });

  describe('passive voice detection', () => {
    it('should detect "was completed"', () => {
      const text = 'The task was completed by the team.';
      const suggestions = analyzeSuggestions(text);

      const styleSuggestion = suggestions.find(s => s.type === 'style');
      expect(styleSuggestion).toBeDefined();
      expect(styleSuggestion?.observation).toContain('passive voice');
    });

    it('should detect "is being updated"', () => {
      const text = 'The work is being updated right now.';
      const suggestions = analyzeSuggestions(text);

      const styleSuggestion = suggestions.find(s => s.type === 'style');
      expect(styleSuggestion).toBeDefined();
    });
  });

  describe('line number calculation', () => {
    it('should calculate correct line numbers', () => {
      const text = 'Line one.\nLine two in order to test.\nLine three.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion?.lineNumber).toBe(2);
    });

    it('should handle text on first line', () => {
      const text = 'In order to start, we begin here.';
      const suggestions = analyzeSuggestions(text);

      const economySuggestion = suggestions.find(s => s.type === 'economy');
      expect(economySuggestion?.lineNumber).toBe(1);
    });
  });

  describe('deduplication', () => {
    it('should not return overlapping suggestions', () => {
      // This text has potential overlaps
      const text = 'The task was completed in order to finish it.';
      const suggestions = analyzeSuggestions(text);

      // Check that no suggestions overlap
      for (let i = 0; i < suggestions.length; i++) {
        for (let j = i + 1; j < suggestions.length; j++) {
          const a = suggestions[i];
          const b = suggestions[j];
          const overlaps =
            (a.startIndex >= b.startIndex && a.startIndex < b.endIndex) ||
            (a.endIndex > b.startIndex && a.endIndex <= b.endIndex) ||
            (a.startIndex <= b.startIndex && a.endIndex >= b.endIndex);
          expect(overlaps).toBe(false);
        }
      }
    });
  });

  describe('empty and trivial inputs', () => {
    it('should return empty array for empty string', () => {
      const suggestions = analyzeSuggestions('');
      expect(suggestions).toHaveLength(0);
    });

    it('should return empty array for whitespace only', () => {
      const suggestions = analyzeSuggestions('   \n\t  ');
      expect(suggestions).toHaveLength(0);
    });

    it('should handle clean text with no issues', () => {
      const text = 'This is clean text. It has no issues.';
      const suggestions = analyzeSuggestions(text);
      expect(suggestions).toHaveLength(0);
    });
  });
});
