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
});
