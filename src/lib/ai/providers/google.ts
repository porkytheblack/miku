import { GoogleGenerativeAI, Content, SchemaType } from '@google/generative-ai';
import { AIProviderInterface, Message, ToolDefinition, ProviderResponse, ToolCall } from '../types';

export class GoogleProvider implements AIProviderInterface {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  private convertMessagesToGemini(messages: Message[]): { contents: Content[]; systemInstruction?: string } {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const contents: Content[] = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    return {
      contents,
      systemInstruction: systemMessage?.content,
    };
  }

  private convertType(type: string): SchemaType {
    switch (type.toLowerCase()) {
      case 'string': return SchemaType.STRING;
      case 'number': return SchemaType.NUMBER;
      case 'integer': return SchemaType.INTEGER;
      case 'boolean': return SchemaType.BOOLEAN;
      case 'array': return SchemaType.ARRAY;
      case 'object': return SchemaType.OBJECT;
      default: return SchemaType.STRING;
    }
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<ProviderResponse> {
    const { contents, systemInstruction } = this.convertMessagesToGemini(messages);

    // Build tools configuration if provided
    const toolsConfig = tools ? [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: Object.fromEntries(
            Object.entries(tool.parameters.properties).map(([key, value]) => [
              key,
              {
                type: this.convertType(value.type),
                description: value.description,
                ...(value.enum ? { enum: value.enum } : {}),
              } as Record<string, unknown>,
            ])
          ),
          required: tool.parameters.required,
        },
      })),
    }] : undefined;

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: toolsConfig as any,
    });

    const result = await model.generateContent({ contents });
    const response = result.response;

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if ('text' in part && part.text) {
          textContent += part.text;
        } else if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: part.functionCall.name,
            arguments: (part.functionCall.args || {}) as Record<string, unknown>,
          });
        }
      }
    }

    const finishReason = response.candidates?.[0]?.finishReason;

    return {
      content: textContent || null,
      toolCalls,
      finishReason: toolCalls.length > 0 ? 'tool_calls' :
                    finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const { contents, systemInstruction } = this.convertMessagesToGemini(messages);

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction,
    });

    const result = await model.generateContentStream({ contents });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
