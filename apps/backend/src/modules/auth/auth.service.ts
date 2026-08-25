import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, SafeUserDto } from './dto/auth-response.dto';
import { JwtPayload, AuthenticatedUser } from './auth.types';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.jwtExpiresIn = config.get<string>('JWT_EXPIRES_IN', '15m');
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const emailTaken = await this.authRepo.emailExists(dto.email.toLowerCase());
    if (emailTaken) throw new ConflictException('Email already in use');

    const slugTaken = await this.authRepo.slugExists(dto.companySlug);
    if (slugTaken) throw new ConflictException('Company slug already taken');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.authRepo.createUserAndCompany({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      companyName: dto.companyName,
      companySlug: dto.companySlug,
    });

    return this.issueTokens(user);
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.authRepo.findUserByEmail(email.toLowerCase());
    if (!user || !user.isActive) return null;

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) return null;

    return user;
  }

  async login(user: User): Promise<AuthResponseDto> {
    return this.issueTokens(user);
  }

  async refresh(incomingToken: string): Promise<AuthResponseDto> {
    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(incomingToken, {
        secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      });
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.authRepo.findUserById(userId);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokenMatches = await bcrypt.compare(incomingToken, user.refreshTokenHash);
    if (!tokenMatches) {
      // Possible token reuse attack — revoke all tokens
      await this.authRepo.updateRefreshTokenHash(userId, null);
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.authRepo.updateRefreshTokenHash(userId, null);
  }

  toSafeUser(user: User): SafeUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Refresh token: signed JWT with separate secret, longer expiry
    const refreshTokenRaw = uuidv4() + '.' + uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: refreshTokenRaw },
      {
        secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: (this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d')) as never,
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS);
    await this.authRepo.updateRefreshTokenHash(user.id, refreshTokenHash);

    const expiresIn = this.parseTtlSeconds(this.jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: this.toSafeUser(user),
    };
  }

  getCurrentUserFromPayload(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }

  private parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
