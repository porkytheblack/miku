import { Suggestion, AggressivenessLevel } from '@/types';

// Helper to calculate line number from index
function getLineNumber(text: string, index: number): number {
  const textBeforeIndex = text.slice(0, index);
  return (textBeforeIndex.match(/\n/g) || []).length + 1;
}

// Aggressiveness thresholds
const THRESHOLDS = {
  gentle: {
    longSentenceWords: 40,
    checkPassiveVoice: false,
    checkRedundantPhrases: true,
    checkGrammar: true,
  },
  balanced: {
    longSentenceWords: 30,
    checkPassiveVoice: true,
    checkRedundantPhrases: true,
    checkGrammar: true,
  },
  strict: {
    longSentenceWords: 20,
    checkPassiveVoice: true,
    checkRedundantPhrases: true,
    checkGrammar: true,
  },
};

// Mock AI analysis - in a real app this would call an API
export function analyzeSuggestions(text: string, aggressiveness: AggressivenessLevel = 'balanced'): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let id = 0;
  const config = THRESHOLDS[aggressiveness];

  // Check for long sentences (clarity)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  let currentIndex = 0;

  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    const startIndex = text.indexOf(trimmed, currentIndex);
    if (startIndex === -1) return;

    currentIndex = startIndex + trimmed.length;
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount > config.longSentenceWords) {
      suggestions.push({
        id: `suggestion-${id++}`,
        type: 'clarity',
        lineNumber: getLineNumber(text, startIndex),
        startIndex,
        endIndex: startIndex + trimmed.length,
        originalText: trimmed,
        observation: `This sentence is ${wordCount} words. Consider breaking it up for better readability.`,
        suggestedRevision: splitLongSentence(trimmed),
      });
    }
  });

  // Check for passive voice (style) - only in balanced and strict modes
  if (config.checkPassiveVoice) {
    const passivePatterns = [
      /\b(is|are|was|were|be|been|being)\s+(\w+ed)\b/gi,
      /\b(is|are|was|were|be|been|being)\s+(\w+en)\b/gi,
    ];

    passivePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const context = getContext(text, match.index, match[0].length);
        suggestions.push({
          id: `suggestion-${id++}`,
          type: 'style',
          lineNumber: getLineNumber(text, context.startIndex),
          startIndex: context.startIndex,
          endIndex: context.endIndex,
          originalText: context.text,
          observation: 'This appears to use passive voice. Active voice often reads more directly.',
          suggestedRevision: context.text,
        });
      }
    });
  }

  // Check for redundant phrases (economy)
  if (config.checkRedundantPhrases) {
    const redundantPhrases = [
      { pattern: /\bvery unique\b/gi, suggestion: 'unique' },
      { pattern: /\bcompletely finished\b/gi, suggestion: 'finished' },
      { pattern: /\bpast history\b/gi, suggestion: 'history' },
      { pattern: /\bfuture plans\b/gi, suggestion: 'plans' },
      { pattern: /\bfree gift\b/gi, suggestion: 'gift' },
      { pattern: /\bbasic fundamentals\b/gi, suggestion: 'fundamentals' },
      { pattern: /\badvance planning\b/gi, suggestion: 'planning' },
      { pattern: /\bin order to\b/gi, suggestion: 'to' },
      { pattern: /\bat this point in time\b/gi, suggestion: 'now' },
      { pattern: /\bdue to the fact that\b/gi, suggestion: 'because' },
    ];

    redundantPhrases.forEach(({ pattern, suggestion }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        suggestions.push({
          id: `suggestion-${id++}`,
          type: 'economy',
          lineNumber: getLineNumber(text, match.index),
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          originalText: match[0],
          observation: `"${match[0]}" is redundant.`,
          suggestedRevision: suggestion,
        });
      }
    });
  }

  // Check for common grammar issues
  if (config.checkGrammar) {
    const grammarPatterns = [
      { pattern: /\bits\s+(?=a\s|the\s|an\s)/gi, observation: 'Check if this should be "it\'s" (it is).' },
      { pattern: /\byour\s+(?=going|doing|being)/gi, observation: 'Check if this should be "you\'re" (you are).' },
      { pattern: /\btheir\s+(?=is|are|was|were)/gi, observation: 'Check if this should be "there" or "they\'re".' },
      { pattern: /\bthen\s+(?=I|you|he|she|it|we|they)\s+(?:will|would|should|could|might)/gi, observation: 'Check if this should be "than" for comparison.' },
    ];

    grammarPatterns.forEach(({ pattern, observation }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const context = getContext(text, match.index, match[0].length);
        suggestions.push({
          id: `suggestion-${id++}`,
          type: 'grammar',
          lineNumber: getLineNumber(text, context.startIndex),
          startIndex: context.startIndex,
          endIndex: context.endIndex,
          originalText: context.text,
          observation,
          suggestedRevision: context.text,
        });
      }
    });
  }

  // Remove duplicates based on overlapping ranges
  return deduplicateSuggestions(suggestions);
}

function getContext(text: string, matchIndex: number, matchLength: number): { text: string; startIndex: number; endIndex: number } {
  let startIndex = matchIndex;
  let endIndex = matchIndex + matchLength;

  while (startIndex > 0 && !/[.!?]/.test(text[startIndex - 1])) {
    startIndex--;
    if (matchIndex - startIndex > 50) break;
  }

  while (endIndex < text.length && !/[.!?]/.test(text[endIndex])) {
    endIndex++;
    if (endIndex - matchIndex > 50) break;
  }

  if (endIndex < text.length && /[.!?]/.test(text[endIndex])) {
    endIndex++;
  }

  return {
    text: text.slice(startIndex, endIndex).trim(),
    startIndex,
    endIndex,
  };
}

function splitLongSentence(sentence: string): string {
  const words = sentence.split(/\s+/);
  const midpoint = Math.floor(words.length / 2);

  const breakWords = ['and', 'but', 'or', 'which', 'that', 'because', 'while', 'although', 'however'];
  let breakIndex = midpoint;

  for (let i = midpoint - 5; i <= midpoint + 5 && i < words.length; i++) {
    if (i > 0 && breakWords.includes(words[i].toLowerCase())) {
      breakIndex = i;
      break;
    }
  }

  const firstPart = words.slice(0, breakIndex).join(' ');
  const secondPart = words.slice(breakIndex).join(' ');
  const secondCapitalized = secondPart.charAt(0).toUpperCase() + secondPart.slice(1);

  return `${firstPart}. ${secondCapitalized}`;
}

function deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const result: Suggestion[] = [];

  for (const suggestion of suggestions) {
    const overlaps = result.some(
      existing =>
        (suggestion.startIndex >= existing.startIndex && suggestion.startIndex < existing.endIndex) ||
        (suggestion.endIndex > existing.startIndex && suggestion.endIndex <= existing.endIndex) ||
        (suggestion.startIndex <= existing.startIndex && suggestion.endIndex >= existing.endIndex)
    );

    if (!overlaps) {
      result.push(suggestion);
    }
  }

  return result;
}
