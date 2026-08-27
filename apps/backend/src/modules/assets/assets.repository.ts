import { Injectable } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, tag?: string): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { companyId, ...(tag ? { tags: { has: tag } } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({ where: { id, companyId } });
  }

  async create(data: Prisma.AssetUncheckedCreateInput): Promise<Asset> {
    return this.prisma.asset.create({ data });
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const result = await this.prisma.asset.deleteMany({ where: { id, companyId } });
    return result.count > 0;
  }
}
