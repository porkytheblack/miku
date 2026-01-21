import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class LMStudioProvider implements AIProviderInterface {
  private model: string;
  private baseUrl: string;

  constructor(model: string, baseUrl: string = 'http://localhost:1234/v1') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    // LM Studio uses OpenAI-compatible API
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
      temperature: 0.7,
    };

    if (formattedTools) {
      body.tools = formattedTools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${error}`);
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
            id: tc.id || `tool-${Date.now()}`,
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
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

  // Helper method to list available models from LM Studio
  static async listModels(baseUrl: string = 'http://localhost:1234/v1'): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl}/models`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || [];
    } catch {
      return [];
    }
  }
}
