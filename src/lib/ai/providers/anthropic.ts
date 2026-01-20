import Anthropic from '@anthropic-ai/sdk';
import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class AnthropicProvider implements AIProviderInterface {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // For client-side usage; prefer server-side in production
    });
    this.model = model;
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<ProviderResponse> {
    // Anthropic requires system message to be separate
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = otherMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const anthropicTools: Anthropic.Tool[] | undefined = tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties as Record<string, Anthropic.Tool.InputSchema>,
        required: tool.parameters.required,
      },
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent || null,
      toolCalls,
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' :
                    response.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = otherMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
