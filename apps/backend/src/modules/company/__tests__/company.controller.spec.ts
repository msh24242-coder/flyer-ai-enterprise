import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CompanyController } from '../company.controller';
import { CompanyService } from '../company.service';
import { AuditService } from '../../audit/audit.service';
import { UserRole } from '@prisma/client';

const COMPANY_ID = 'company-abc';
const USER = { id: 'user-1', email: 'owner@example.com', companyId: COMPANY_ID };

const mockCompanyService = {
  getCompany: jest.fn(),
  updateCompany: jest.fn(),
  getMembers: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  listKnowledge: jest.fn(),
  upsertKnowledge: jest.fn(),
  updateKnowledge: jest.fn(),
  deleteKnowledge: jest.fn(),
  getAiConfig: jest.fn(),
  updateAiConfig: jest.fn(),
  getAiUsage: jest.fn(),
} as unknown as jest.Mocked<CompanyService>;

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
  list: jest.fn(),
} as unknown as jest.Mocked<AuditService>;

describe('CompanyController', () => {
  let controller: CompanyController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CompanyController(mockCompanyService, mockAuditService);
  });

  // ─── Company ───────────────────────────────────────────────────────────────

  describe('getCompany', () => {
    it('returns company for a member', async () => {
      const company = { id: COMPANY_ID, name: 'Acme' };
      mockCompanyService.getCompany.mockResolvedValue(company as never);

      const result = await controller.getCompany(COMPANY_ID, USER as never);
      expect(result).toEqual(company);
      expect(mockCompanyService.getCompany).toHaveBeenCalledWith(COMPANY_ID, USER.id);
    });

    it('propagates ForbiddenException from service', async () => {
      mockCompanyService.getCompany.mockRejectedValue(new ForbiddenException());
      await expect(controller.getCompany(COMPANY_ID, USER as never)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateCompany', () => {
    it('updates and returns the company', async () => {
      const updated = { id: COMPANY_ID, name: 'New Name' };
      mockCompanyService.updateCompany.mockResolvedValue(updated as never);

      const result = await controller.updateCompany(COMPANY_ID, { name: 'New Name' }, USER as never);
      expect(result).toEqual(updated);
      expect(mockCompanyService.updateCompany).toHaveBeenCalledWith(COMPANY_ID, { name: 'New Name' }, USER.id);
    });
  });

  // ─── Members ──────────────────────────────────────────────────────────────

  describe('getMembers', () => {
    it('returns member list', async () => {
      const members = [{ id: 'u1', email: 'a@b.com', role: UserRole.MEMBER, isActive: true }];
      mockCompanyService.getMembers.mockResolvedValue(members as never);

      const result = await controller.getMembers(COMPANY_ID, USER as never);
      expect(result).toEqual(members);
    });
  });

  describe('updateMemberRole', () => {
    it('updates member role', async () => {
      const updated = { id: 'u2', role: UserRole.ADMIN };
      mockCompanyService.updateMemberRole.mockResolvedValue(updated as never);

      const result = await controller.updateMemberRole(COMPANY_ID, 'u2', { role: UserRole.ADMIN }, USER as never);
      expect(result).toEqual(updated);
    });
  });

  describe('removeMember', () => {
    it('removes a member successfully', async () => {
      mockCompanyService.removeMember.mockResolvedValue(undefined);
      await expect(
        controller.removeMember(COMPANY_ID, 'u2', USER as never),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Knowledge ───────────────────────────────────────────────────────────

  describe('listKnowledge', () => {
    it('returns knowledge entries', async () => {
      const entries = [{ id: 'k1', category: 'brand', key: 'voice', value: {} }];
      mockCompanyService.listKnowledge.mockResolvedValue(entries as never);

      const result = await controller.listKnowledge(COMPANY_ID, USER as never, 'brand');
      expect(result).toEqual(entries);
      expect(mockCompanyService.listKnowledge).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'brand');
    });
  });

  describe('upsertKnowledge', () => {
    it('creates a knowledge entry', async () => {
      const dto = { category: 'brand', key: 'tone', value: { style: 'formal' } };
      const created = { id: 'k2', ...dto };
      mockCompanyService.upsertKnowledge.mockResolvedValue(created as never);

      const result = await controller.upsertKnowledge(COMPANY_ID, dto as never, USER as never);
      expect(result).toEqual(created);
    });
  });

  describe('deleteKnowledge', () => {
    it('deletes a knowledge entry', async () => {
      mockCompanyService.deleteKnowledge.mockResolvedValue(undefined);
      await expect(
        controller.deleteKnowledge(COMPANY_ID, 'k1', USER as never),
      ).resolves.toBeUndefined();
    });
  });

  // ─── AI Config ────────────────────────────────────────────────────────────

  describe('getAiConfig', () => {
    it('returns the AI configuration', async () => {
      const config = { monthlyBudgetUsd: 100, defaultModel: 'claude-opus-5' };
      mockCompanyService.getAiConfig.mockResolvedValue(config);

      const result = await controller.getAiConfig(COMPANY_ID, USER as never);
      expect(result).toEqual(config);
      expect(mockCompanyService.getAiConfig).toHaveBeenCalledWith(COMPANY_ID, USER.id);
    });
  });

  describe('updateAiConfig', () => {
    it('updates and returns the AI configuration', async () => {
      const config = { monthlyBudgetUsd: 200 };
      mockCompanyService.updateAiConfig.mockResolvedValue(config);

      const result = await controller.updateAiConfig(COMPANY_ID, config, USER as never);
      expect(result).toEqual(config);
      expect(mockCompanyService.updateAiConfig).toHaveBeenCalledWith(COMPANY_ID, config, USER.id);
    });
  });

  // ─── AI Usage ─────────────────────────────────────────────────────────────

  describe('getAiUsage', () => {
    it('returns usage aggregation for default date range', async () => {
      const usage = { totalExecutions: 42, totalCostUsd: 0.5, totalInputTokens: 10000, totalOutputTokens: 5000, byAgent: [] };
      mockCompanyService.getAiUsage.mockResolvedValue(usage as never);

      const result = await controller.getAiUsage(COMPANY_ID, USER as never, undefined, undefined);
      expect(result).toEqual(usage);
      expect(mockCompanyService.getAiUsage).toHaveBeenCalledWith(COMPANY_ID, USER.id, undefined, undefined);
    });

    it('passes date range parameters through', async () => {
      mockCompanyService.getAiUsage.mockResolvedValue({ totalExecutions: 0, totalCostUsd: 0, totalInputTokens: 0, totalOutputTokens: 0, byAgent: [] } as never);

      await controller.getAiUsage(COMPANY_ID, USER as never, '2026-01-01', '2026-01-31');
      expect(mockCompanyService.getAiUsage).toHaveBeenCalledWith(COMPANY_ID, USER.id, '2026-01-01', '2026-01-31');
    });
  });

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  describe('getAuditLogs', () => {
    it('returns audit logs for a company member', async () => {
      const logs = [{ id: 'a1', action: 'COMPANY_UPDATED', resource: 'company', resourceId: COMPANY_ID, userId: USER.id, createdAt: new Date().toISOString() }];
      mockCompanyService.getCompany.mockResolvedValue({ id: COMPANY_ID } as never);
      mockAuditService.list.mockResolvedValue(logs as never);

      const result = await controller.getAuditLogs(COMPANY_ID, USER as never, undefined, undefined);
      expect(result).toEqual(logs);
      expect(mockAuditService.list).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ userId: USER.id }),
      );
    });

    it('passes resource filter and limit through', async () => {
      mockCompanyService.getCompany.mockResolvedValue({ id: COMPANY_ID } as never);
      mockAuditService.list.mockResolvedValue([]);

      await controller.getAuditLogs(COMPANY_ID, USER as never, 'company', '20');
      expect(mockAuditService.list).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ resource: 'company', limit: 20 }),
      );
    });
  });
});
