import OpenAI from 'openai';
import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class OpenAIProvider implements AIProviderInterface {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // For client-side usage; prefer server-side in production
    });
    this.model = model;
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<ProviderResponse> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const openaiTools: OpenAI.ChatCompletionTool[] | undefined = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    });

    const choice = response.choices[0];
    const message = choice.message;

    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type === 'function') {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        }
      }
    }

    return {
      content: message.content,
      toolCalls,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' :
                    choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
