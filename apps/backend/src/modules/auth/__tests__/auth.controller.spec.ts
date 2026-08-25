import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UserRole } from '@prisma/client';

const mockUser = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: UserRole.OWNER,
  companyId: 'company-1',
  passwordHash: 'hash',
  refreshTokenHash: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTokenResponse = {
  accessToken: 'access.jwt',
  refreshToken: 'refresh.jwt',
  user: {
    id: mockUser.id,
    email: mockUser.email,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    companyId: mockUser.companyId,
  },
};

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getCurrentUserFromPayload: jest.fn(),
  toSafeUser: jest.fn(),
} as unknown as jest.Mocked<AuthService>;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService);
  });

  describe('register', () => {
    it('registers a new user and returns tokens', async () => {
      mockAuthService.register.mockResolvedValue(mockTokenResponse as never);

      const dto = {
        email: 'owner@example.com',
        password: 'Password1!',
        firstName: 'Alice',
        lastName: 'Smith',
        companyName: 'Acme Corp',
      };
      const result = await controller.register(dto as never);

      expect(result).toEqual(mockTokenResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('returns tokens for a valid user', async () => {
      mockAuthService.login.mockResolvedValue(mockTokenResponse as never);

      const result = await controller.login(mockUser as never);

      expect(result).toEqual(mockTokenResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('refresh', () => {
    it('returns new token pair on valid refresh token', async () => {
      mockAuthService.refresh.mockResolvedValue(mockTokenResponse as never);

      const result = await controller.refresh({ refreshToken: 'refresh.jwt' });

      expect(result).toEqual(mockTokenResponse);
      expect(mockAuthService.refresh).toHaveBeenCalledWith('refresh.jwt');
    });
  });

  describe('logout', () => {
    it('calls authService.logout with the user id', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout({ id: 'user-1' } as never);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1');
    });

    it('returns undefined (204 No Content)', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout({ id: 'user-1' } as never);

      expect(result).toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('returns the safe user from the JWT payload', async () => {
      const safeUser = { id: 'user-1', email: 'owner@example.com', firstName: 'Alice', lastName: 'Smith' };
      mockAuthService.getCurrentUserFromPayload.mockResolvedValue(safeUser as never);

      const result = await controller.getMe({ id: 'user-1' } as never);

      expect(result).toEqual(safeUser);
      expect(mockAuthService.getCurrentUserFromPayload).toHaveBeenCalledWith({ id: 'user-1' });
    });
  });
});
