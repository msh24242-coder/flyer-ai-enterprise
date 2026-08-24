import { PermissionLevel } from '@prisma/client';

export interface ApprovalCheckRequest {
  toolName: string;
  permissionLevel: PermissionLevel;
  companyId: string;
  userId?: string;
  agentExecutionId?: string;
  input: Record<string, unknown>;
}

export type ApprovalOutcome = 'ALLOWED' | 'DENIED' | 'PENDING';

export interface ApprovalCheckResult {
  outcome: ApprovalOutcome;
  approvalRequestId?: string;
  reason: string;
}
