import { Injectable } from '@nestjs/common';
import { Company, User, CompanyKnowledge, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface SafeMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(companyId: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id: companyId } });
  }

  async update(companyId: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({ where: { id: companyId }, data });
  }

  async getMembers(companyId: string): Promise<SafeMember[]> {
    const users = await this.prisma.user.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return users;
  }

  async findMemberInCompany(companyId: string, userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id: userId, companyId } });
  }

  async updateMemberRole(userId: string, companyId: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async deactivateMember(userId: string, companyId: string): Promise<void> {
    // Only deactivate if the user actually belongs to this company
    await this.prisma.user.updateMany({
      where: { id: userId, companyId },
      data: { isActive: false, refreshTokenHash: null },
    });
  }

  // ─── CompanyKnowledge ─────────────────────────────────────────────────────

  async listKnowledge(companyId: string, category?: string): Promise<CompanyKnowledge[]> {
    return this.prisma.companyKnowledge.findMany({
      where: { companyId, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findKnowledge(companyId: string, id: string): Promise<CompanyKnowledge | null> {
    return this.prisma.companyKnowledge.findFirst({ where: { id, companyId } });
  }

  async upsertKnowledge(
    companyId: string,
    category: string,
    key: string,
    value: Prisma.InputJsonValue,
  ): Promise<CompanyKnowledge> {
    return this.prisma.companyKnowledge.upsert({
      where: { companyId_category_key: { companyId, category, key } },
      create: { companyId, category, key, value },
      update: { value },
    });
  }

  async deleteKnowledge(companyId: string, id: string): Promise<void> {
    // findFirst to validate ownership before deletion
    const record = await this.prisma.companyKnowledge.findFirst({ where: { id, companyId } });
    if (!record) return;
    await this.prisma.companyKnowledge.delete({ where: { id } });
  }

  async logAudit(
    companyId: string,
    userId: string | undefined,
    action: string,
    resource: string,
    resourceId?: string,
    before?: Prisma.InputJsonValue,
    after?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action,
        resource,
        resourceId,
        before,
        after,
      },
    });
  }
}
