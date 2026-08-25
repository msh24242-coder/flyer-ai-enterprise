import { UserRole } from '@prisma/client';

export class SafeUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SafeUserDto;
}
