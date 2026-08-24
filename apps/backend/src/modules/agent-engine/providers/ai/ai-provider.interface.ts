import { CanonicalMessage, CanonicalTool } from '../../../../common/types/canonical.types';

export interface AIStreamEvent {
  type: 'text_delta' | 'tool_use' | 'message_stop' | 'usage';
  delta?: string;
  toolUse?: { id: string; name: string; input: Record<string, unknown> };
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProviderRequest {
  model: string;
  system: string;
  messages: CanonicalMessage[];
  tools?: CanonicalTool[];
  maxTokens?: number;
  thinking?: boolean;
}

export interface AIProviderResponse {
  messages: CanonicalMessage[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface IAIProvider {
  readonly name: string;
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;
  stream(request: AIProviderRequest, onEvent: (event: AIStreamEvent) => void): Promise<AIProviderResponse>;
}
