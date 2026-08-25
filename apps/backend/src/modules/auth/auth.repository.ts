import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateUserAndCompanyData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companySlug: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUserAndCompany(data: CreateUserAndCompanyData): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug: data.companySlug,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: UserRole.OWNER,
          companyId: company.id,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          action: 'COMPANY_CREATED',
          resource: 'company',
          resourceId: company.id,
        },
      });

      return user;
    });
  }

  async updateRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash, lastLoginAt: hash ? new Date() : undefined },
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    return company !== null;
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user !== null;
  }
}
