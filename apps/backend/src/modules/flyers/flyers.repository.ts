import { Injectable } from '@nestjs/common';
import { Flyer, FlyerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  thumbnail: true,
  campaignId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  campaign: { select: { id: true, title: true } },
} satisfies Prisma.FlyerSelect;

export type FlyerListItem = Prisma.FlyerGetPayload<{ select: typeof LIST_SELECT }>;

const DETAIL_INCLUDE = {
  campaign: { select: { id: true, title: true } },
  flyerProducts: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: {
        select: { id: true, sku: true, name: true, basePrice: true, currency: true, isActive: true },
      },
    },
  },
} satisfies Prisma.FlyerInclude;

export type FlyerDetail = Prisma.FlyerGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class FlyersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, filters: { status?: FlyerStatus; campaignId?: string } = {}): Promise<FlyerListItem[]> {
    return this.prisma.flyer.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findDetailById(companyId: string, id: string): Promise<FlyerDetail | null> {
    return this.prisma.flyer.findFirst({
      where: { id, companyId },
      include: DETAIL_INCLUDE,
    });
  }

  async findById(companyId: string, id: string): Promise<Flyer | null> {
    return this.prisma.flyer.findFirst({ where: { id, companyId } });
  }

  async slugExists(companyId: string, slug: string): Promise<boolean> {
    const existing = await this.prisma.flyer.findFirst({ where: { companyId, slug }, select: { id: true } });
    return !!existing;
  }

  async create(
    companyId: string,
    createdBy: string,
    data: Omit<Prisma.FlyerCreateWithoutCompanyInput, 'createdBy'>,
  ): Promise<Flyer> {
    return this.prisma.flyer.create({
      data: {
        ...data,
        createdBy,
        company: { connect: { id: companyId } },
      },
    });
  }

  async update(companyId: string, id: string, data: Prisma.FlyerUpdateInput): Promise<Flyer | null> {
    const result = await this.prisma.flyer.updateMany({ where: { id, companyId }, data });
    if (result.count === 0) return null;
    return this.findById(companyId, id);
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const result = await this.prisma.flyer.deleteMany({ where: { id, companyId } });
    return result.count > 0;
  }
}
