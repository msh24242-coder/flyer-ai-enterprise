import { AuthRepository, CreateUserAndCompanyData } from '../auth.repository';
import { UserRole } from '@prisma/client';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hash',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.OWNER,
  companyId: 'co-1',
  refreshTokenHash: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTxUser = { ...mockUser };
const mockTx = {
  company: { create: jest.fn().mockResolvedValue({ id: 'co-1', name: 'Acme', slug: 'acme' }) },
  user: { create: jest.fn().mockResolvedValue(mockTxUser) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

function makeRepo() {
  return new AuthRepository(mockPrisma as never);
}

describe('AuthRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  });

  describe('findUserByEmail', () => {
    it('returns the user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await makeRepo().findUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await makeRepo().findUserByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns the user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await makeRepo().findUserById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await makeRepo().findUserById('missing');

      expect(result).toBeNull();
    });
  });

  describe('createUserAndCompany', () => {
    const dto: CreateUserAndCompanyData = {
      email: 'new@example.com',
      passwordHash: 'hashedpw',
      firstName: 'New',
      lastName: 'User',
      companyName: 'Acme Corp',
      companySlug: 'acme-corp',
    };

    it('creates company and user in a transaction', async () => {
      const result = await makeRepo().createUserAndCompany(dto);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.company.create).toHaveBeenCalledWith({
        data: { name: 'Acme Corp', slug: 'acme-corp' },
      });
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          role: UserRole.OWNER,
          companyId: 'co-1',
        }),
      });
      expect(result).toEqual(mockTxUser);
    });

    it('writes a COMPANY_CREATED audit log entry', async () => {
      await makeRepo().createUserAndCompany(dto);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'COMPANY_CREATED',
          resource: 'company',
          companyId: 'co-1',
        }),
      });
    });
  });

  describe('updateRefreshTokenHash', () => {
    it('sets hash and lastLoginAt when hash is provided', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await makeRepo().updateRefreshTokenHash('user-1', 'new-hash');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: 'new-hash', lastLoginAt: expect.any(Date) },
      });
    });

    it('clears hash and does not set lastLoginAt when null', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await makeRepo().updateRefreshTokenHash('user-1', null);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: null, lastLoginAt: undefined },
      });
    });
  });

  describe('slugExists', () => {
    it('returns true when slug is taken', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'co-1' });

      const result = await makeRepo().slugExists('acme');

      expect(result).toBe(true);
    });

    it('returns false when slug is free', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      const result = await makeRepo().slugExists('new-slug');

      expect(result).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('returns true when email is registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await makeRepo().emailExists('test@example.com');

      expect(result).toBe(true);
    });

    it('returns false when email is not registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await makeRepo().emailExists('new@example.com');

      expect(result).toBe(false);
    });
  });
});
