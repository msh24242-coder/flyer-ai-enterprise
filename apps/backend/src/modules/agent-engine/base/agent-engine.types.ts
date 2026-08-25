import { AgentType, PermissionLevel } from '@prisma/client';
import { CanonicalMessage, CanonicalTool } from '../../../common/types/canonical.types';
import { TraceResult } from '../observability/observability.types';

export interface AgentToolDefinition {
  tool: CanonicalTool;
  permissionLevel: PermissionLevel;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentExecutionContext {
  companyId: string;
  userId?: string;
  conversationId?: string;
  conversationHistory: CanonicalMessage[];
  userMessage: string;
  model: string;
  additionalContext?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  response: string;
  traceResult: TraceResult;
  pendingApprovalId?: string;
}

export type AgentStreamEventType =
  | { type: 'agent_start'; agentType: string }
  | { type: 'tool_start'; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; durationMs: number; isError: boolean }
  | { type: 'token'; delta: string }
  | { type: 'agent_done'; result: AgentExecutionResult }
  | { type: 'agent_error'; message: string };

export interface AgentIdentity {
  agentType: AgentType;
  displayName: string;
  version: string;
}
