import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Company, UserRole, CompanyKnowledge } from '@prisma/client';
import { CompanyRepository, SafeMember } from './company.repository';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/company-knowledge.dto';
import { PrismaService } from '../../database/prisma.service';

const ADMIN_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];
const OWNER_ROLES: UserRole[] = [UserRole.OWNER];

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getCompany(companyId: string, requesterId: string): Promise<Company> {
    await this.assertMembership(companyId, requesterId);
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(
    companyId: string,
    dto: UpdateCompanyDto,
    requesterId: string,
  ): Promise<Company> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);

    const before = await this.companyRepo.findById(companyId);
    const updated = await this.companyRepo.update(companyId, dto);

    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'COMPANY_UPDATED',
      'company',
      companyId,
      before as never,
      updated as never,
    );

    return updated;
  }

  async getMembers(companyId: string, requesterId: string): Promise<SafeMember[]> {
    await this.assertMembership(companyId, requesterId);
    return this.companyRepo.getMembers(companyId);
  }

  async updateMemberRole(
    companyId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requesterId: string,
  ): Promise<SafeMember> {
    await this.assertRole(companyId, requesterId, OWNER_ROLES);

    if (targetUserId === requesterId) {
      throw new BadRequestException('Cannot change your own role');
    }

    const target = await this.companyRepo.findMemberInCompany(companyId, targetUserId);
    if (!target) throw new NotFoundException('Member not found in company');

    if (dto.role === UserRole.OWNER) {
      throw new ForbiddenException('Cannot assign OWNER role through this endpoint');
    }

    await this.companyRepo.updateMemberRole(targetUserId, companyId, dto.role);
    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'MEMBER_ROLE_UPDATED',
      'user',
      targetUserId,
      { role: target.role } as never,
      { role: dto.role } as never,
    );

    const members = await this.companyRepo.getMembers(companyId);
    return members.find((m) => m.id === targetUserId)!;
  }

  async removeMember(
    companyId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);

    if (targetUserId === requesterId) {
      throw new BadRequestException('Cannot remove yourself from the company');
    }

    const target = await this.companyRepo.findMemberInCompany(companyId, targetUserId);
    if (!target) throw new NotFoundException('Member not found in company');

    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('Cannot remove the company OWNER');
    }

    await this.companyRepo.deactivateMember(targetUserId, companyId);
    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'MEMBER_REMOVED',
      'user',
      targetUserId,
    );
  }

  // ─── Company Knowledge ────────────────────────────────────────────────────

  async listKnowledge(
    companyId: string,
    requesterId: string,
    category?: string,
  ): Promise<CompanyKnowledge[]> {
    await this.assertMembership(companyId, requesterId);
    return this.companyRepo.listKnowledge(companyId, category);
  }

  async upsertKnowledge(
    companyId: string,
    dto: CreateKnowledgeDto,
    requesterId: string,
  ): Promise<CompanyKnowledge> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);

    const result = await this.companyRepo.upsertKnowledge(
      companyId,
      dto.category,
      dto.key,
      dto.value as never,
    );

    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'KNOWLEDGE_UPSERTED',
      'company_knowledge',
      result.id,
    );

    return result;
  }

  async updateKnowledge(
    companyId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
    requesterId: string,
  ): Promise<CompanyKnowledge> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);

    const existing = await this.companyRepo.findKnowledge(companyId, knowledgeId);
    if (!existing) throw new NotFoundException('Knowledge entry not found');

    const updated = await this.companyRepo.upsertKnowledge(
      companyId,
      existing.category,
      existing.key,
      dto.value as never,
    );

    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'KNOWLEDGE_UPDATED',
      'company_knowledge',
      knowledgeId,
      existing.value as never,
      dto.value as never,
    );

    return updated;
  }

  async deleteKnowledge(
    companyId: string,
    knowledgeId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);

    const existing = await this.companyRepo.findKnowledge(companyId, knowledgeId);
    if (!existing) throw new NotFoundException('Knowledge entry not found');

    await this.companyRepo.deleteKnowledge(companyId, knowledgeId);
    await this.companyRepo.logAudit(
      companyId,
      requesterId,
      'KNOWLEDGE_DELETED',
      'company_knowledge',
      knowledgeId,
    );
  }

  // ─── AI Configuration ─────────────────────────────────────────────────────

  async getAiConfig(companyId: string, requesterId: string): Promise<Record<string, unknown>> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new NotFoundException('Company not found');
    return (company.aiConfig as Record<string, unknown>) ?? {};
  }

  async updateAiConfig(
    companyId: string,
    config: Record<string, unknown>,
    requesterId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertRole(companyId, requesterId, ADMIN_ROLES);
    const allowedKeys = ['defaultModel', 'monthlyBudgetUsd', 'maxExecutionCostUsd', 'approvalRequired'];
    const sanitized = Object.fromEntries(
      Object.entries(config).filter(([k]) => allowedKeys.includes(k)),
    );
    await this.companyRepo.update(companyId, { aiConfig: sanitized as never });
    await this.companyRepo.logAudit(companyId, requesterId, 'AI_CONFIG_UPDATED', 'company', companyId);
    return sanitized;
  }

  // ─── AI Usage Aggregation ─────────────────────────────────────────────────

  async getAiUsage(
    companyId: string,
    requesterId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    await this.assertMembership(companyId, requesterId);

    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const executions = await this.prisma.agentExecution.findMany({
      where: {
        companyId,
        createdAt: { gte: from, lte: to },
      },
      select: {
        agentType: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostUsd: true,
        status: true,
        createdAt: true,
      },
    });

    const totalInputTokens = executions.reduce((s, e) => s + (e.inputTokens ?? 0), 0);
    const totalOutputTokens = executions.reduce((s, e) => s + (e.outputTokens ?? 0), 0);
    const totalCostUsd = executions.reduce((s, e) => s + Number(e.estimatedCostUsd ?? 0), 0);

    const byAgent: Record<string, { executions: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    for (const e of executions) {
      const key = e.agentType;
      if (!byAgent[key]) byAgent[key] = { executions: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      byAgent[key].executions++;
      byAgent[key].inputTokens += e.inputTokens ?? 0;
      byAgent[key].outputTokens += e.outputTokens ?? 0;
      byAgent[key].costUsd += Number(e.estimatedCostUsd ?? 0);
    }

    const byAgentArray = Object.entries(byAgent).map(([agentType, stats]) => ({
      agentType,
      executions: stats.executions,
      totalCostUsd: Number(stats.costUsd.toFixed(6)),
      totalTokens: stats.inputTokens + stats.outputTokens,
    }));

    return {
      totalExecutions: executions.length,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      totalInputTokens,
      totalOutputTokens,
      byAgent: byAgentArray,
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
    };
  }

  // ─── Tenant isolation helpers ─────────────────────────────────────────────

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
  }

  private async assertRole(
    companyId: string,
    userId: string,
    allowedRoles: UserRole[],
  ): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
