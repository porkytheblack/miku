import { describe, it, expect, vi } from 'vitest';
import { MikuAgent } from '../agent';
import { parseHighlightToolCall, EDITOR_TOOLS, MIKU_SYSTEM_PROMPT } from '../types';

// Mock the providers with proper class implementations
vi.mock('../providers/openai', () => ({
  OpenAIProvider: class MockOpenAIProvider {
    chat = vi.fn();
  },
}));

vi.mock('../providers/anthropic', () => ({
  AnthropicProvider: class MockAnthropicProvider {
    chat = vi.fn();
  },
}));

vi.mock('../providers/google', () => ({
  GoogleProvider: class MockGoogleProvider {
    chat = vi.fn();
  },
}));

describe('MikuAgent', () => {
  describe('parseHighlightToolCall', () => {
    const documentLines = [
      'This is line one.',
      'This is line two with some text.',
      'This is line three.',
    ];

    it('should parse a valid highlight tool call', () => {
      const result = parseHighlightToolCall(
        'test-id',
        {
          line_number: 2,
          start_column: 0,
          end_column: 20,
          original_text: 'This is line two',
          suggestion_type: 'clarity',
          observation: 'This could be clearer',
          suggested_revision: 'Line two is here',
        },
        documentLines
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
      expect(result?.type).toBe('clarity');
      expect(result?.lineNumber).toBe(2);
      expect(result?.originalText).toBe('This is line two');
      expect(result?.observation).toBe('This could be clearer');
      expect(result?.suggestedRevision).toBe('Line two is here');
    });

    it('should calculate correct start index for multi-line documents', () => {
      const result = parseHighlightToolCall(
        'test-id',
        {
          line_number: 2,
          start_column: 5,
          end_column: 10,
          original_text: 'is li',
          suggestion_type: 'grammar',
          observation: 'Grammar issue',
          suggested_revision: 'is a li',
        },
        documentLines
      );

      // Line 1 is 17 chars ('This is line one.') + newline = 18 chars
      // Start column 5 on line 2 = 18 + 5 = 23
      expect(result?.startIndex).toBe(23);
      expect(result?.endIndex).toBe(28); // 23 + (10-5) = 28
    });

    it('should handle first line correctly', () => {
      const result = parseHighlightToolCall(
        'test-id',
        {
          line_number: 1,
          start_column: 0,
          end_column: 4,
          original_text: 'This',
          suggestion_type: 'style',
          observation: 'Style issue',
          suggested_revision: 'That',
        },
        documentLines
      );

      expect(result?.startIndex).toBe(0);
      expect(result?.endIndex).toBe(4);
    });

    it('should handle missing fields gracefully', () => {
      const result = parseHighlightToolCall(
        'test-id',
        {
          // Only line_number provided, other fields missing
          line_number: 1,
          start_column: 0,
          end_column: 4,
          original_text: 'This',
          suggestion_type: 'clarity',
          observation: 'Test',
          suggested_revision: 'That',
        },
        documentLines
      );

      // With all fields provided, it should work
      expect(result).not.toBeNull();
      expect(result?.startIndex).toBe(0);
    });
  });

  describe('EDITOR_TOOLS', () => {
    it('should have highlight_text tool', () => {
      const highlightTool = EDITOR_TOOLS.find(t => t.name === 'highlight_text');
      expect(highlightTool).toBeDefined();
      expect(highlightTool?.parameters.required).toContain('line_number');
      expect(highlightTool?.parameters.required).toContain('suggestion_type');
    });

    it('should have get_line_content tool', () => {
      const tool = EDITOR_TOOLS.find(t => t.name === 'get_line_content');
      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('line_number');
    });

    it('should have get_document_stats tool', () => {
      const tool = EDITOR_TOOLS.find(t => t.name === 'get_document_stats');
      expect(tool).toBeDefined();
    });

    it('should have finish_review tool', () => {
      const tool = EDITOR_TOOLS.find(t => t.name === 'finish_review');
      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('summary');
    });

    it('should have valid suggestion types in highlight_text', () => {
      const highlightTool = EDITOR_TOOLS.find(t => t.name === 'highlight_text');
      const suggestionType = highlightTool?.parameters.properties.suggestion_type;
      expect(suggestionType?.enum).toContain('clarity');
      expect(suggestionType?.enum).toContain('grammar');
      expect(suggestionType?.enum).toContain('style');
      expect(suggestionType?.enum).toContain('structure');
      expect(suggestionType?.enum).toContain('economy');
    });
  });

  describe('MIKU_SYSTEM_PROMPT', () => {
    it('should define Miku personality', () => {
      expect(MIKU_SYSTEM_PROMPT).toContain('Miku');
      expect(MIKU_SYSTEM_PROMPT).toContain('writing assistant');
    });

    it('should list all suggestion categories', () => {
      expect(MIKU_SYSTEM_PROMPT).toContain('clarity');
      expect(MIKU_SYSTEM_PROMPT).toContain('grammar');
      expect(MIKU_SYSTEM_PROMPT).toContain('style');
      expect(MIKU_SYSTEM_PROMPT).toContain('structure');
      expect(MIKU_SYSTEM_PROMPT).toContain('economy');
    });

    it('should mention tool usage', () => {
      expect(MIKU_SYSTEM_PROMPT).toContain('highlight_text');
      expect(MIKU_SYSTEM_PROMPT).toContain('finish_review');
    });
  });
});

describe('MikuAgent Integration', () => {
  it('should create agent with OpenAI provider', () => {
    const agent = new MikuAgent('openai', 'test-key', 'gpt-4o');
    expect(agent).toBeDefined();
  });

  it('should create agent with Anthropic provider', () => {
    const agent = new MikuAgent('anthropic', 'test-key', 'claude-sonnet-4-20250514');
    expect(agent).toBeDefined();
  });

  it('should create agent with Google provider', () => {
    const agent = new MikuAgent('google', 'test-key', 'gemini-2.0-flash');
    expect(agent).toBeDefined();
  });

  it('should throw for unknown provider', () => {
    expect(() => {
      // @ts-expect-error Testing invalid provider
      new MikuAgent('unknown', 'test-key', 'model');
    }).toThrow('Unknown provider');
  });
});
