import { Injectable, Logger } from '@nestjs/common';
import { PermissionLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ApprovalCheckRequest,
  ApprovalCheckResult,
} from './approval.types';

@Injectable()
export class ApprovalEngineService {
  private readonly logger = new Logger(ApprovalEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(request: ApprovalCheckRequest): Promise<ApprovalCheckResult> {
    const { toolName, permissionLevel, companyId, userId, agentExecutionId, input } = request;

    if (permissionLevel === PermissionLevel.READ) {
      return { outcome: 'ALLOWED', reason: 'READ operations are always allowed' };
    }

    if (permissionLevel === PermissionLevel.WRITE) {
      return { outcome: 'ALLOWED', reason: 'WRITE operations are allowed for authorized agents' };
    }

    if (permissionLevel === PermissionLevel.APPROVAL_REQUIRED) {
      const approvalRequest = await this.prisma.approvalRequest.create({
        data: {
          companyId,
          requestedById: userId,
          agentExecutionId,
          toolName,
          toolInput: input as Prisma.InputJsonValue,
          permissionLevel,
          status: 'PENDING',
        },
      });

      this.logger.warn(
        `Tool "${toolName}" requires approval. ApprovalRequest ID: ${approvalRequest.id}`,
      );

      return {
        outcome: 'PENDING',
        approvalRequestId: approvalRequest.id,
        reason: `Tool "${toolName}" requires human approval before execution`,
      };
    }

    if (permissionLevel === PermissionLevel.ADMIN_ONLY) {
      if (!userId) {
        return { outcome: 'DENIED', reason: 'ADMIN_ONLY tools require an authenticated user' };
      }

      const membership = await this.prisma.user.findFirst({
        where: { id: userId, companyId, role: 'ADMIN' },
      });

      if (!membership) {
        return { outcome: 'DENIED', reason: 'User does not have ADMIN role for this company' };
      }

      return { outcome: 'ALLOWED', reason: 'User is ADMIN' };
    }

    return { outcome: 'DENIED', reason: `Unknown permission level: ${permissionLevel}` };
  }

  async resolveApproval(approvalRequestId: string, approved: boolean): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id: approvalRequestId },
      data: {
        status: approved ? 'GRANTED' : 'DENIED',
        resolvedAt: new Date(),
      },
    });
  }
}
