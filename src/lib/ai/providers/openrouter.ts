import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class OpenRouterProvider implements AIProviderInterface {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    // Convert messages to OpenAI format (OpenRouter uses OpenAI-compatible API)
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Convert tools to OpenAI format
    const formattedTools = tools.length > 0 ? tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })) : undefined;

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      max_tokens: 4096,
    };

    if (formattedTools) {
      body.tools = formattedTools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://miku.app', // Required by OpenRouter
        'X-Title': 'Miku Editor', // Optional but recommended
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Parse tool calls if present
    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        try {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        } catch (e) {
          console.error('Failed to parse tool call arguments:', e);
        }
      }
    }

    return {
      content: message.content || '',
      toolCalls,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    };
  }
}
