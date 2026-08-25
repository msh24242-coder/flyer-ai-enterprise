import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { ApprovalsRepository } from './approvals.repository';

@Injectable()
export class ApprovalsService {
  constructor(private readonly repo: ApprovalsRepository) {}

  async listApprovals(companyId: string, status?: ApprovalStatus) {
    return this.repo.list(companyId, status);
  }

  async getApproval(companyId: string, id: string) {
    const approval = await this.repo.findOne(companyId, id);
    if (!approval) {
      throw new NotFoundException(`Approval request ${id} not found`);
    }
    return approval;
  }

  async approve(companyId: string, id: string, reviewedById: string, reviewNote?: string) {
    await this.getApproval(companyId, id);
    const result = await this.repo.resolve(companyId, id, reviewedById, true, reviewNote);
    if (result.count === 0) {
      throw new NotFoundException(`Approval request ${id} is not in PENDING state or does not exist`);
    }
    return this.repo.findOne(companyId, id);
  }

  async deny(companyId: string, id: string, reviewedById: string, reviewNote?: string) {
    await this.getApproval(companyId, id);
    const result = await this.repo.resolve(companyId, id, reviewedById, false, reviewNote);
    if (result.count === 0) {
      throw new NotFoundException(`Approval request ${id} is not in PENDING state or does not exist`);
    }
    return this.repo.findOne(companyId, id);
  }
}
