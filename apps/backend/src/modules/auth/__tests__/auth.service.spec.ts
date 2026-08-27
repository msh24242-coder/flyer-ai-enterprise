import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { Prisma, UserRole } from '@prisma/client';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  firstName: 'Alice',
  lastName: 'Smith',
  role: UserRole.OWNER,
  companyId: 'company-1',
  refreshTokenHash: null,
  lastLoginAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuthRepo = {
  emailExists: jest.fn(),
  slugExists: jest.fn(),
  createUserAndCompany: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  updateRefreshTokenHash: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, def?: string) => def ?? '15m'),
  getOrThrow: jest.fn().mockReturnValue('test-secret-key'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUser.passwordHash = await bcrypt.hash('Password1', 10);
    service = new AuthService(
      mockAuthRepo as unknown as AuthRepository,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'Password1',
      firstName: 'Bob',
      lastName: 'Jones',
      companyName: 'Acme Corp',
      companySlug: 'acme-corp',
    };

    it('creates user and company and returns tokens', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(false);
      mockAuthRepo.createUserAndCompany.mockResolvedValue({ ...mockUser, email: dto.email });
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.register(dto);

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe(dto.email);
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException if email is taken', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(true);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockAuthRepo.createUserAndCompany).not.toHaveBeenCalled();
    });

    it('throws ConflictException if slug is taken', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(true);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('normalizes email to lowercase', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(false);
      mockAuthRepo.createUserAndCompany.mockResolvedValue(mockUser);
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register({ ...dto, email: 'NEW@Example.COM' });

      expect(mockAuthRepo.emailExists).toHaveBeenCalledWith('new@example.com');
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
    });

    it('hashes password before storing', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(false);
      mockAuthRepo.createUserAndCompany.mockResolvedValue(mockUser);
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register(dto);

      const call = mockAuthRepo.createUserAndCompany.mock.calls[0][0];
      expect(call.passwordHash).not.toBe(dto.password);
      const isHashed = await bcrypt.compare(dto.password, call.passwordHash);
      expect(isHashed).toBe(true);
    });

    it('retries with a suffixed variant when the requested slug is already taken', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      // 'acme-corp' taken, 'acme-corp-2' free
      mockAuthRepo.slugExists.mockImplementation(async (slug: string) => slug === 'acme-corp');
      mockAuthRepo.createUserAndCompany.mockResolvedValue({ ...mockUser, companyId: 'company-2' });
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledTimes(1);
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledWith(
        expect.objectContaining({ companySlug: 'acme-corp-2' }),
      );
    });

    it('keeps trying variants past -2 until it finds a free one', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      const taken = new Set(['acme-corp', 'acme-corp-2', 'acme-corp-3']);
      mockAuthRepo.slugExists.mockImplementation(async (slug: string) => taken.has(slug));
      mockAuthRepo.createUserAndCompany.mockResolvedValue(mockUser);
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledWith(
        expect.objectContaining({ companySlug: 'acme-corp-4' }),
      );
    });

    it('retries when the DB rejects the slug with a unique-constraint error despite the pre-check passing (race)', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(false); // pre-check always says "free"
      const raceError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      });
      mockAuthRepo.createUserAndCompany
        .mockRejectedValueOnce(raceError)
        .mockResolvedValueOnce(mockUser);
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledTimes(2);
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ companySlug: 'acme-corp' }),
      );
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ companySlug: 'acme-corp-2' }),
      );
    });

    it('surfaces a clear error after exhausting all slug variant attempts', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(true); // every candidate is taken

      await expect(service.register(dto)).rejects.toThrow(
        'Unable to generate a unique company workspace slug',
      );
      expect(mockAuthRepo.createUserAndCompany).not.toHaveBeenCalled();
    });

    it('propagates non-slug database errors instead of retrying', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockResolvedValue(false);
      mockAuthRepo.createUserAndCompany.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.register(dto)).rejects.toThrow('DB connection lost');
      expect(mockAuthRepo.createUserAndCompany).toHaveBeenCalledTimes(1);
    });

    it('preserves the correct company context on the issued tokens after a slug retry', async () => {
      mockAuthRepo.emailExists.mockResolvedValue(false);
      mockAuthRepo.slugExists.mockImplementation(async (slug: string) => slug === 'acme-corp');
      mockAuthRepo.createUserAndCompany.mockResolvedValue({ ...mockUser, companyId: 'company-99' });
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'company-99' }),
      );
    });
  });

  describe('validateCredentials', () => {
    it('returns user when credentials are valid', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      const result = await service.validateCredentials('test@example.com', 'Password1');
      expect(result).toBeTruthy();
      expect(result!.id).toBe('user-1');
    });

    it('returns null when user not found', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      const result = await service.validateCredentials('nobody@example.com', 'any');
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(mockUser);
      const result = await service.validateCredentials('test@example.com', 'WrongPass1');
      expect(result).toBeNull();
    });

    it('returns null when user is inactive', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ ...mockUser, isActive: false });
      const result = await service.validateCredentials('test@example.com', 'Password1');
      expect(result).toBeNull();
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException on invalid JWT', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refresh('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no refresh token stored', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockAuthRepo.findUserById.mockResolvedValue({ ...mockUser, refreshTokenHash: null });
      await expect(service.refresh('valid.token')).rejects.toThrow(UnauthorizedException);
    });

    it('detects token reuse and revokes all tokens', async () => {
      const storedToken = 'different-token-content';
      const storedHash = await bcrypt.hash(storedToken, 10);
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockAuthRepo.findUserById.mockResolvedValue({
        ...mockUser,
        refreshTokenHash: storedHash,
      });

      // Provide a different token that does NOT match the hash
      await expect(service.refresh('forged.token.value')).rejects.toThrow(UnauthorizedException);
      expect(mockAuthRepo.updateRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });
  });

  describe('logout', () => {
    it('clears the refresh token hash', async () => {
      mockAuthRepo.updateRefreshTokenHash.mockResolvedValue(undefined);
      await service.logout('user-1');
      expect(mockAuthRepo.updateRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });
  });

  describe('toSafeUser', () => {
    it('never includes passwordHash or refreshTokenHash', () => {
      const safeUser = service.toSafeUser(mockUser);
      expect((safeUser as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((safeUser as unknown as Record<string, unknown>).refreshTokenHash).toBeUndefined();
    });
  });
});
