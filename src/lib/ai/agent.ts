import { AIProvider, Suggestion, ReviewRequest, ReviewResponse } from '@/types';
import {
  AIProviderInterface,
  Message,
  EDITOR_TOOLS,
  MIKU_SYSTEM_PROMPT,
  parseHighlightToolCall,
  ToolCall,
} from './types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GoogleProvider } from './providers/google';

export class MikuAgent {
  private provider: AIProviderInterface;
  private documentContent: string = '';
  private documentLines: string[] = [];

  constructor(providerType: AIProvider, apiKey: string, model: string) {
    switch (providerType) {
      case 'openai':
        this.provider = new OpenAIProvider(apiKey, model);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(apiKey, model);
        break;
      case 'google':
        this.provider = new GoogleProvider(apiKey, model);
        break;
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }
  }

  private getLineContent(lineNumber: number): string {
    if (lineNumber < 1 || lineNumber > this.documentLines.length) {
      return '';
    }
    return this.documentLines[lineNumber - 1];
  }

  private getDocumentStats(): Record<string, unknown> {
    const content = this.documentContent;
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);

    // Calculate average words per sentence
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;

    // Simple reading level estimate (Flesch-Kincaid approximation)
    const avgSyllables = words.reduce((acc, word) => {
      return acc + this.countSyllables(word);
    }, 0) / Math.max(words.length, 1);

    const readingLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllables - 15.59;

    return {
      characterCount: content.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      lineCount: this.documentLines.length,
      averageWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      estimatedReadingLevel: Math.max(0, Math.round(readingLevel * 10) / 10),
    };
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private processToolCall(toolCall: ToolCall): { result: string; suggestion?: Suggestion } {
    const { name, arguments: args, id } = toolCall;

    console.log('[MikuAgent] Processing tool call:', name, 'with args:', JSON.stringify(args, null, 2));

    switch (name) {
      case 'highlight_text': {
        const suggestion = parseHighlightToolCall(
          `suggestion-${id}`,
          args,
          this.documentLines
        );
        console.log('[MikuAgent] Parsed suggestion:', suggestion);
        return {
          result: suggestion
            ? `Successfully highlighted text at line ${args.line_number}`
            : 'Failed to create highlight',
          suggestion: suggestion || undefined,
        };
      }

      case 'get_line_content': {
        const lineNumber = args.line_number as number;
        const content = this.getLineContent(lineNumber);
        return {
          result: content
            ? `Line ${lineNumber}: "${content}"`
            : `Line ${lineNumber} does not exist`,
        };
      }

      case 'get_document_stats': {
        const stats = this.getDocumentStats();
        return {
          result: JSON.stringify(stats, null, 2),
        };
      }

      case 'finish_review': {
        return {
          result: `Review completed. Summary: ${args.summary}`,
        };
      }

      default:
        return {
          result: `Unknown tool: ${name}`,
        };
    }
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    this.documentContent = request.content;
    this.documentLines = request.content.split('\n');

    const suggestions: Suggestion[] = [];
    let summary = '';

    // Build the initial user message
    let userMessage = `Please review the following document and provide suggestions for improvement:\n\n---\n${request.content}\n---`;

    if (request.focusAreas && request.focusAreas.length > 0) {
      userMessage += `\n\nPlease focus particularly on: ${request.focusAreas.join(', ')}`;
    }

    const messages: Message[] = [
      { role: 'system', content: MIKU_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    // Agent loop - continue until the agent finishes or we hit max iterations
    const maxIterations = 10;
    let iteration = 0;
    let finished = false;

    while (!finished && iteration < maxIterations) {
      iteration++;

      const response = await this.provider.chat(messages, EDITOR_TOOLS);

      console.log('[MikuAgent] Provider response:', {
        hasContent: !!response.content,
        toolCallsCount: response.toolCalls.length,
        finishReason: response.finishReason,
        toolCalls: response.toolCalls.map(tc => ({ name: tc.name, id: tc.id })),
      });

      // Process any text content
      if (response.content) {
        messages.push({ role: 'assistant', content: response.content });
      }

      // Process tool calls
      if (response.toolCalls.length > 0) {
        const toolResults: string[] = [];

        for (const toolCall of response.toolCalls) {
          const { result, suggestion } = this.processToolCall(toolCall);
          toolResults.push(`[${toolCall.name}]: ${result}`);

          if (suggestion) {
            suggestions.push(suggestion);
          }

          if (toolCall.name === 'finish_review') {
            summary = toolCall.arguments.summary as string;
            finished = true;
          }
        }

        // Add tool results as a user message for the next iteration
        if (!finished) {
          messages.push({
            role: 'user',
            content: `Tool results:\n${toolResults.join('\n')}\n\nPlease continue with your review or call finish_review when done.`,
          });
        }
      }

      // If no tool calls and stop reason, we're done
      if (response.toolCalls.length === 0 && response.finishReason === 'stop') {
        finished = true;
      }
    }

    // Filter out overlapping suggestions - keep only the first suggestion for each text range
    const filteredSuggestions = this.filterOverlappingSuggestions(suggestions);

    console.log('[MikuAgent] Review complete:', {
      totalSuggestions: suggestions.length,
      filteredSuggestions: filteredSuggestions.length,
      iterations: iteration,
      summary: summary.substring(0, 100),
    });

    return {
      suggestions: filteredSuggestions,
      summary,
    };
  }

  /**
   * Filter out overlapping suggestions, keeping only the first one for each text range
   */
  private filterOverlappingSuggestions(suggestions: Suggestion[]): Suggestion[] {
    if (suggestions.length <= 1) return suggestions;

    // Sort by startIndex
    const sorted = [...suggestions].sort((a, b) => a.startIndex - b.startIndex);
    const result: Suggestion[] = [];

    for (const suggestion of sorted) {
      // Check if this suggestion overlaps with any already accepted suggestion
      const hasOverlap = result.some(
        existing =>
          (suggestion.startIndex >= existing.startIndex && suggestion.startIndex < existing.endIndex) ||
          (suggestion.endIndex > existing.startIndex && suggestion.endIndex <= existing.endIndex) ||
          (suggestion.startIndex <= existing.startIndex && suggestion.endIndex >= existing.endIndex)
      );

      if (!hasOverlap) {
        result.push(suggestion);
      }
    }

    return result;
  }
}

// Factory function for creating the agent
export function createMikuAgent(
  provider: AIProvider,
  apiKey: string,
  model: string
): MikuAgent {
  return new MikuAgent(provider, apiKey, model);
}
