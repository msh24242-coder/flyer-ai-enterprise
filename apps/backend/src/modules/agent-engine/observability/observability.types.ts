import { AgentType, PermissionLevel } from '@prisma/client';

export interface TraceContext {
  traceId: string;
  agentType: AgentType;
  companyId: string;
  userId?: string;
  conversationId?: string;
  model: string;
  startedAt: Date;
}

export interface ToolCallRecord {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  isError: boolean;
  durationMs: number;
  permissionLevel: PermissionLevel;
  wasApproved: boolean;
}

export interface TraceResult {
  traceId: string;
  agentExecutionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  totalLatencyMs: number;
  iterations: number;
  toolCalls: ToolCallRecord[];
  finalStatus: 'COMPLETED' | 'FAILED' | 'PENDING_APPROVAL';
  errorMessage?: string;
}
