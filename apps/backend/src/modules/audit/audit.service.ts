import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditLogEntry {
  companyId: string;
  userId?: string;
  traceId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: entry.companyId,
          userId: entry.userId,
          traceId: entry.traceId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          before: entry.before as Prisma.InputJsonValue,
          after: entry.after as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${String(err)}`);
    }
  }

  async list(companyId: string, options?: { resource?: string; userId?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...(options?.resource ? { resource: options.resource } : {}),
        ...(options?.userId ? { userId: options.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        userId: true,
        traceId: true,
        createdAt: true,
      },
    });
  }
}
