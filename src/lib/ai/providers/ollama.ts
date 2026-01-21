import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class OllamaProvider implements AIProviderInterface {
  private model: string;
  private baseUrl: string;

  constructor(model: string, baseUrl: string = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    // Convert messages to Ollama format
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Ollama supports tools in OpenAI-compatible format
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
      stream: false,
    };

    if (formattedTools) {
      body.tools = formattedTools;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.message;

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
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  // Helper method to list available models
  static async listModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }
}
