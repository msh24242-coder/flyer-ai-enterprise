import { Injectable } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApprovalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, status?: ApprovalStatus) {
    return this.prisma.approvalRequest.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        toolName: true,
        toolInput: true,
        permissionLevel: true,
        status: true,
        reviewNote: true,
        resolvedAt: true,
        createdAt: true,
        agentExecutionId: true,
        conversationId: true,
        requestedById: true,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        toolName: true,
        toolInput: true,
        permissionLevel: true,
        status: true,
        reviewNote: true,
        resolvedAt: true,
        createdAt: true,
        agentExecutionId: true,
        conversationId: true,
        requestedById: true,
        reviewedById: true,
      },
    });
  }

  async resolve(
    companyId: string,
    id: string,
    reviewedById: string,
    approved: boolean,
    reviewNote?: string,
  ) {
    return this.prisma.approvalRequest.updateMany({
      where: { id, companyId, status: 'PENDING' },
      data: {
        status: approved ? ApprovalStatus.GRANTED : ApprovalStatus.DENIED,
        reviewedById,
        reviewNote: reviewNote ?? null,
        resolvedAt: new Date(),
      },
    });
  }
}
