import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CompanyService } from '../company.service';
import { CompanyRepository } from '../company.repository';
import { UserRole } from '@prisma/client';

const makeUser = (overrides: Partial<{ id: string; role: UserRole; isActive: boolean }> = {}) => ({
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: UserRole.OWNER,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  ...overrides,
});

const mockPrisma = { agentExecution: { findMany: jest.fn() } };

const mockRepo: jest.Mocked<CompanyRepository> = {
  findById: jest.fn(),
  update: jest.fn(),
  getMembers: jest.fn(),
  findMemberInCompany: jest.fn(),
  updateMemberRole: jest.fn(),
  deactivateMember: jest.fn(),
  listKnowledge: jest.fn(),
  findKnowledge: jest.fn(),
  upsertKnowledge: jest.fn(),
  deleteKnowledge: jest.fn(),
  logAudit: jest.fn(),
} as never;

const COMPANY_ID = 'company-abc';
const REQUESTER_ID = 'user-1';

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompanyService(mockRepo, mockPrisma as never);
  });

  // ── getCompany ─────────────────────────────────────────────────────────────

  describe('getCompany', () => {
    it('returns company when user is a member', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      mockRepo.findById.mockResolvedValue({ id: COMPANY_ID, name: 'Acme' } as never);

      const result = await service.getCompany(COMPANY_ID, REQUESTER_ID);
      expect(result.id).toBe(COMPANY_ID);
    });

    it('throws ForbiddenException for non-member', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(null);
      await expect(service.getCompany(COMPANY_ID, REQUESTER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for inactive member', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ isActive: false }) as never);
      await expect(service.getCompany(COMPANY_ID, REQUESTER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── updateCompany ──────────────────────────────────────────────────────────

  describe('updateCompany', () => {
    it('allows OWNER to update company', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.OWNER }) as never);
      mockRepo.findById.mockResolvedValue({ id: COMPANY_ID } as never);
      mockRepo.update.mockResolvedValue({ id: COMPANY_ID, name: 'New Name' } as never);
      mockRepo.logAudit.mockResolvedValue(undefined);

      const result = await service.updateCompany(COMPANY_ID, { name: 'New Name' }, REQUESTER_ID);
      expect(result.name).toBe('New Name');
    });

    it('allows ADMIN to update company', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.ADMIN }) as never);
      mockRepo.findById.mockResolvedValue({ id: COMPANY_ID } as never);
      mockRepo.update.mockResolvedValue({ id: COMPANY_ID } as never);
      mockRepo.logAudit.mockResolvedValue(undefined);

      await expect(
        service.updateCompany(COMPANY_ID, { name: 'X' }, REQUESTER_ID),
      ).resolves.toBeDefined();
    });

    it('denies MEMBER from updating company', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.MEMBER }) as never);
      await expect(
        service.updateCompany(COMPANY_ID, { name: 'X' }, REQUESTER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Member management ──────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    const TARGET_ID = 'user-2';

    it('allows OWNER to change member role', async () => {
      mockRepo.findMemberInCompany
        .mockResolvedValueOnce(makeUser({ role: UserRole.OWNER }) as never) // requester
        .mockResolvedValueOnce(makeUser({ id: TARGET_ID, role: UserRole.MEMBER }) as never); // target
      mockRepo.updateMemberRole.mockResolvedValue({} as never);
      mockRepo.logAudit.mockResolvedValue(undefined);
      mockRepo.getMembers.mockResolvedValue([
        makeUser({ id: TARGET_ID, role: UserRole.ADMIN }) as never,
      ]);

      const result = await service.updateMemberRole(
        COMPANY_ID, TARGET_ID, { role: UserRole.ADMIN }, REQUESTER_ID,
      );
      expect(result.id).toBe(TARGET_ID);
    });

    it('prevents assigning OWNER role', async () => {
      mockRepo.findMemberInCompany
        .mockResolvedValueOnce(makeUser({ role: UserRole.OWNER }) as never)
        .mockResolvedValueOnce(makeUser({ id: TARGET_ID }) as never);

      await expect(
        service.updateMemberRole(COMPANY_ID, TARGET_ID, { role: UserRole.OWNER }, REQUESTER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents user from changing their own role', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      await expect(
        service.updateMemberRole(COMPANY_ID, REQUESTER_ID, { role: UserRole.MEMBER }, REQUESTER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    const TARGET_ID = 'user-2';

    it('allows ADMIN to remove a MEMBER', async () => {
      mockRepo.findMemberInCompany
        .mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }) as never)
        .mockResolvedValueOnce(makeUser({ id: TARGET_ID, role: UserRole.MEMBER }) as never);
      mockRepo.deactivateMember.mockResolvedValue(undefined);
      mockRepo.logAudit.mockResolvedValue(undefined);

      await expect(
        service.removeMember(COMPANY_ID, TARGET_ID, REQUESTER_ID),
      ).resolves.toBeUndefined();
    });

    it('prevents removing the OWNER', async () => {
      mockRepo.findMemberInCompany
        .mockResolvedValueOnce(makeUser({ role: UserRole.OWNER }) as never)
        .mockResolvedValueOnce(makeUser({ id: TARGET_ID, role: UserRole.OWNER }) as never);

      await expect(
        service.removeMember(COMPANY_ID, TARGET_ID, REQUESTER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents removing yourself', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      await expect(
        service.removeMember(COMPANY_ID, REQUESTER_ID, REQUESTER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Knowledge ─────────────────────────────────────────────────────────────

  describe('upsertKnowledge', () => {
    it('allows ADMIN to create knowledge entry', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.ADMIN }) as never);
      mockRepo.upsertKnowledge.mockResolvedValue({ id: 'k1' } as never);
      mockRepo.logAudit.mockResolvedValue(undefined);

      const result = await service.upsertKnowledge(
        COMPANY_ID,
        { category: 'brand', key: 'voice', value: { tone: 'formal' } },
        REQUESTER_ID,
      );
      expect(result.id).toBe('k1');
    });

    it('denies VIEWER from creating knowledge', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.VIEWER }) as never);
      await expect(
        service.upsertKnowledge(
          COMPANY_ID,
          { category: 'brand', key: 'voice', value: {} },
          REQUESTER_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteKnowledge', () => {
    it('throws NotFoundException for non-existent entry', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser({ role: UserRole.ADMIN }) as never);
      mockRepo.findKnowledge.mockResolvedValue(null);

      await expect(
        service.deleteKnowledge(COMPANY_ID, 'no-such-id', REQUESTER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAiUsage ─────────────────────────────────────────────────────────────

  describe('getAiUsage', () => {
    it('throws ForbiddenException for non-member', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(null);
      await expect(service.getAiUsage(COMPANY_ID, REQUESTER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('returns zeroed totals when no executions exist', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.getAiUsage(COMPANY_ID, REQUESTER_ID);

      expect(result.totalExecutions).toBe(0);
      expect(result.totalCostUsd).toBe(0);
      expect(result.totalInputTokens).toBe(0);
      expect(result.totalOutputTokens).toBe(0);
      expect(result.byAgent).toEqual([]);
      expect(result.fromDate).toBeDefined();
      expect(result.toDate).toBeDefined();
    });

    it('aggregates executions correctly across agent types', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { agentType: 'DIRECTOR', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001, status: 'COMPLETED', createdAt: new Date() },
        { agentType: 'DIRECTOR', inputTokens: 200, outputTokens: 80, estimatedCostUsd: 0.002, status: 'COMPLETED', createdAt: new Date() },
        { agentType: 'CONTENT',  inputTokens: 500, outputTokens: 200, estimatedCostUsd: 0.005, status: 'COMPLETED', createdAt: new Date() },
      ]);

      const result = await service.getAiUsage(COMPANY_ID, REQUESTER_ID);

      expect(result.totalExecutions).toBe(3);
      expect(result.totalInputTokens).toBe(800);
      expect(result.totalOutputTokens).toBe(330);
      expect(Number(result.totalCostUsd.toFixed(3))).toBeCloseTo(0.008, 3);
      expect(result.byAgent).toHaveLength(2);

      const directorEntry = result.byAgent.find((a) => a.agentType === 'DIRECTOR');
      expect(directorEntry?.executions).toBe(2);
      expect(directorEntry?.totalTokens).toBe(430);

      const contentEntry = result.byAgent.find((a) => a.agentType === 'CONTENT');
      expect(contentEntry?.executions).toBe(1);
      expect(contentEntry?.totalTokens).toBe(700);
    });

    it('respects custom date range', async () => {
      mockRepo.findMemberInCompany.mockResolvedValue(makeUser() as never);
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const from = '2026-01-01';
      const to = '2026-01-31';
      await service.getAiUsage(COMPANY_ID, REQUESTER_ID, from, to);

      const callArgs = mockPrisma.agentExecution.findMany.mock.calls[0][0];
      expect(callArgs.where.createdAt.gte).toEqual(new Date(from));
      expect(callArgs.where.createdAt.lte).toEqual(new Date(to));
    });
  });
});
