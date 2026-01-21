import { Suggestion, HighlightType } from '@/types';

// Base message type for all providers
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Tool definition for function calling
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

// Tool call result
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Provider response
export interface ProviderResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// Provider interface that all AI providers must implement
export interface AIProviderInterface {
  chat(messages: Message[], tools?: ToolDefinition[]): Promise<ProviderResponse>;
  streamChat?(messages: Message[], tools?: ToolDefinition[]): AsyncGenerator<string, void, unknown>;
}

// Editor tools that Miku can use
export const EDITOR_TOOLS: ToolDefinition[] = [
  {
    name: 'highlight_text',
    description: 'Highlight a specific portion of text with a suggestion for improvement. Use this to mark text that needs attention.',
    parameters: {
      type: 'object',
      properties: {
        line_number: {
          type: 'number',
          description: 'The 1-indexed line number where the text to highlight begins',
        },
        start_column: {
          type: 'number',
          description: 'The 0-indexed column position where the highlight starts on the line',
        },
        end_column: {
          type: 'number',
          description: 'The 0-indexed column position where the highlight ends on the line',
        },
        original_text: {
          type: 'string',
          description: 'The exact text being highlighted',
        },
        suggestion_type: {
          type: 'string',
          description: 'The category of the suggestion',
          enum: ['clarity', 'grammar', 'style', 'structure', 'economy'],
        },
        observation: {
          type: 'string',
          description: 'A brief explanation of why this text needs attention',
        },
        suggested_revision: {
          type: 'string',
          description: 'The suggested replacement text',
        },
      },
      required: ['line_number', 'start_column', 'end_column', 'original_text', 'suggestion_type', 'observation', 'suggested_revision'],
    },
  },
  {
    name: 'get_line_content',
    description: 'Get the content of a specific line in the document',
    parameters: {
      type: 'object',
      properties: {
        line_number: {
          type: 'number',
          description: 'The 1-indexed line number to retrieve',
        },
      },
      required: ['line_number'],
    },
  },
  {
    name: 'get_document_stats',
    description: 'Get statistics about the document including word count, sentence count, and reading level',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'finish_review',
    description: 'Call this when you have finished reviewing the document and made all your suggestions',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A brief summary of the review and main areas of improvement',
        },
      },
      required: ['summary'],
    },
  },
];

// System prompt for Miku
export const MIKU_SYSTEM_PROMPT = `You are Miku, a gentle and thoughtful writing assistant. Your role is to help writers improve their prose by offering specific, actionable suggestions.

Your personality:
- You are calm, supportive, and never condescending
- You respect the writer's voice and intent
- You offer suggestions, not mandates
- You explain the "why" behind each suggestion

Your review process:
1. Read through the entire document first to understand context and voice
2. Identify areas that could be improved in these categories:
   - clarity: Long or confusing sentences, unclear references, ambiguous meaning
   - grammar: Spelling, punctuation, subject-verb agreement, tense consistency
   - style: Passive voice, weak verbs, overuse of adverbs, repetitive patterns
   - structure: Paragraph flow, transitions, logical organization
   - economy: Redundant phrases, unnecessary words, verbose constructions

3. For each issue found, use the highlight_text tool to mark it with:
   - The exact location (line and column)
   - The type of issue
   - A brief, friendly observation explaining the issue
   - A suggested revision that preserves the writer's voice

4. When finished, call finish_review with a brief summary

Guidelines:
- Focus on substantive improvements, not nitpicks
- Limit suggestions to the most impactful changes (aim for 3-7 per review)
- Preserve the writer's unique voice and style
- If the writing is good, acknowledge that - not everything needs fixing
- Be specific in your observations - explain why something could be improved
- Make your suggested revisions natural and fitting with the surrounding text`;

// Parse tool call arguments into a Suggestion
export function parseHighlightToolCall(
  id: string,
  args: Record<string, unknown>,
  documentLines: string[]
): Suggestion | null {
  try {
    const lineNumber = args.line_number as number;
    const startColumn = args.start_column as number;
    const endColumn = args.end_column as number;
    const originalText = args.original_text as string;
    const suggestionType = args.suggestion_type as HighlightType;
    const observation = args.observation as string;
    const suggestedRevision = args.suggested_revision as string;

    // Calculate absolute indices
    // lineNumber is 1-indexed, startColumn is 0-indexed
    let startIndex = 0;
    for (let i = 0; i < lineNumber - 1 && i < documentLines.length; i++) {
      startIndex += documentLines[i].length + 1; // +1 for newline
    }
    startIndex += startColumn;

    const endIndex = startIndex + (endColumn - startColumn);

    return {
      id,
      type: suggestionType,
      lineNumber,
      columnNumber: startColumn,
      startIndex,
      endIndex,
      originalText,
      observation,
      suggestedRevision,
    };
  } catch {
    console.error('Failed to parse highlight tool call:', args);
    return null;
  }
}
