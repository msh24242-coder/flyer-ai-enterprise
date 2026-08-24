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

export interface AgentIdentity {
  agentType: AgentType;
  displayName: string;
  version: string;
}
