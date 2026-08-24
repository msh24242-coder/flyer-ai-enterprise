import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  IAIProvider,
  AIProviderRequest,
  AIProviderResponse,
  AIStreamEvent,
} from './ai-provider.interface';
import {
  CanonicalMessage,
  CanonicalContentBlock,
  CanonicalTool,
} from '../../../../common/types/canonical.types';

@Injectable()
export class AnthropicProvider implements IAIProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    const params = this.buildParams(request);
    const response = await this.client.messages.create({
      ...params,
      stream: false,
    });
    return this.mapResponse(response, request.model);
  }

  async stream(
    request: AIProviderRequest,
    onEvent: (event: AIStreamEvent) => void,
  ): Promise<AIProviderResponse> {
    const params = this.buildParams(request);
    const stream = await this.client.messages.stream({ ...params });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onEvent({ type: 'text_delta', delta: event.delta.text });
      } else if (
        event.type === 'content_block_start' &&
        event.content_block.type === 'tool_use'
      ) {
        onEvent({
          type: 'tool_use',
          toolUse: {
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          },
        });
      }
    }

    const finalMessage = await stream.finalMessage();
    onEvent({
      type: 'usage',
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    });

    return this.mapResponse(finalMessage, request.model);
  }

  private buildParams(request: AIProviderRequest): Anthropic.MessageCreateParamsNonStreaming {
    const messages = request.messages.map((m) => this.toAnthropicMessage(m));
    const tools: Anthropic.Tool[] | undefined =
      request.tools && request.tools.length > 0
        ? request.tools.map((t) => this.toAnthropicTool(t))
        : undefined;

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: request.model,
      system: request.system,
      messages,
      max_tokens: request.maxTokens ?? 8192,
    };

    if (tools) params.tools = tools;

    if (request.thinking) {
      Object.assign(params, { thinking: { type: 'adaptive' } });
    }

    return params;
  }

  private toAnthropicMessage(msg: CanonicalMessage): Anthropic.MessageParam {
    const content: Anthropic.ContentBlockParam[] = msg.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      } else if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        };
      } else {
        return {
          type: 'tool_result' as const,
          tool_use_id: block.toolUseId,
          content: block.content,
          is_error: block.isError,
        };
      }
    });

    return { role: msg.role, content };
  }

  private toAnthropicTool(tool: CanonicalTool): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    };
  }

  private mapResponse(response: Anthropic.Message, model: string): AIProviderResponse {
    const content: CanonicalContentBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        content.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
      // skip thinking, redacted_thinking, web_search_result blocks
    }

    const assistantMessage: CanonicalMessage = { role: 'assistant', content };

    let stopReason: AIProviderResponse['stopReason'] = 'end_turn';
    if (response.stop_reason === 'tool_use') stopReason = 'tool_use';
    else if (response.stop_reason === 'max_tokens') stopReason = 'max_tokens';

    return {
      messages: [assistantMessage],
      stopReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model,
    };
  }
}
