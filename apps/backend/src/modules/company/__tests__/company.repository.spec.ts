import { CompanyRepository } from '../company.repository';
import { UserRole } from '@prisma/client';

const mockCompany = { id: 'co-1', name: 'Acme', slug: 'acme', industry: null, website: null, aiConfig: {}, createdAt: new Date(), updatedAt: new Date() };
const mockMember = { id: 'user-1', email: 'u@acme.com', firstName: 'Alice', lastName: 'A', role: UserRole.OWNER, isActive: true, lastLoginAt: null, createdAt: new Date() };
const mockKnowledge = { id: 'kn-1', companyId: 'co-1', category: 'brand', key: 'voice', value: 'Friendly', createdAt: new Date(), updatedAt: new Date() };

const mockPrisma = {
  company: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  companyKnowledge: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

function makeRepo() {
  return new CompanyRepository(mockPrisma as never);
}

describe('CompanyRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('returns company when found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      const result = await makeRepo().findById('co-1');
      expect(result).toEqual(mockCompany);
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'co-1' } });
    });

    it('returns null when not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);
      expect(await makeRepo().findById('missing')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates company and returns the updated record', async () => {
      const updated = { ...mockCompany, name: 'Acme Corp' };
      mockPrisma.company.update.mockResolvedValue(updated);

      const result = await makeRepo().update('co-1', { name: 'Acme Corp' });

      expect(result.name).toBe('Acme Corp');
      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: 'co-1' },
        data: { name: 'Acme Corp' },
      });
    });
  });

  describe('getMembers', () => {
    it('returns active members for a company', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockMember]);

      const result = await makeRepo().getMembers('co-1');

      expect(result).toEqual([mockMember]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', isActive: true } }),
      );
    });
  });

  describe('findMemberInCompany', () => {
    it('returns user when member belongs to the company', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockMember);
      const result = await makeRepo().findMemberInCompany('co-1', 'user-1');
      expect(result).toEqual(mockMember);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({ where: { id: 'user-1', companyId: 'co-1' } });
    });

    it('returns null when user does not belong to company (tenant isolation)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      expect(await makeRepo().findMemberInCompany('co-attacker', 'user-1')).toBeNull();
    });
  });

  describe('updateMemberRole', () => {
    it('updates the user role', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockMember, role: UserRole.MEMBER });

      await makeRepo().updateMemberRole('user-1', 'co-1', UserRole.MEMBER);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.MEMBER },
      });
    });
  });

  describe('deactivateMember', () => {
    it('deactivates member only within the company (uses updateMany with companyId guard)', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      await makeRepo().deactivateMember('user-1', 'co-1');

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', companyId: 'co-1' },
        data: { isActive: false, refreshTokenHash: null },
      });
    });

    it('cannot deactivate user from a different company', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      await makeRepo().deactivateMember('user-1', 'co-attacker');

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1', companyId: 'co-attacker' } }),
      );
    });
  });

  describe('listKnowledge', () => {
    it('returns all knowledge for a company', async () => {
      mockPrisma.companyKnowledge.findMany.mockResolvedValue([mockKnowledge]);

      const result = await makeRepo().listKnowledge('co-1');

      expect(result).toEqual([mockKnowledge]);
      expect(mockPrisma.companyKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      );
    });

    it('filters by category when provided', async () => {
      mockPrisma.companyKnowledge.findMany.mockResolvedValue([mockKnowledge]);

      await makeRepo().listKnowledge('co-1', 'brand');

      expect(mockPrisma.companyKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', category: 'brand' } }),
      );
    });
  });

  describe('upsertKnowledge', () => {
    it('upserts a knowledge entry', async () => {
      mockPrisma.companyKnowledge.upsert.mockResolvedValue(mockKnowledge);

      const result = await makeRepo().upsertKnowledge('co-1', 'brand', 'voice', 'Friendly');

      expect(result).toEqual(mockKnowledge);
      expect(mockPrisma.companyKnowledge.upsert).toHaveBeenCalledWith({
        where: { companyId_category_key: { companyId: 'co-1', category: 'brand', key: 'voice' } },
        create: { companyId: 'co-1', category: 'brand', key: 'voice', value: 'Friendly' },
        update: { value: 'Friendly' },
      });
    });
  });

  describe('deleteKnowledge', () => {
    it('deletes when the record belongs to the company', async () => {
      mockPrisma.companyKnowledge.findFirst.mockResolvedValue(mockKnowledge);
      mockPrisma.companyKnowledge.delete.mockResolvedValue(mockKnowledge);

      await makeRepo().deleteKnowledge('co-1', 'kn-1');

      expect(mockPrisma.companyKnowledge.delete).toHaveBeenCalledWith({ where: { id: 'kn-1' } });
    });

    it('does not delete when record belongs to a different company (tenant isolation)', async () => {
      mockPrisma.companyKnowledge.findFirst.mockResolvedValue(null);

      await makeRepo().deleteKnowledge('co-attacker', 'kn-1');

      expect(mockPrisma.companyKnowledge.delete).not.toHaveBeenCalled();
    });
  });
});
