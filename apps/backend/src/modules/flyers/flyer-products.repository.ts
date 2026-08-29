import { Injectable } from '@nestjs/common';
import { FlyerProduct, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FlyerProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByFlyer(flyerId: string): Promise<FlyerProduct[]> {
    return this.prisma.flyerProduct.findMany({ where: { flyerId }, orderBy: { sortOrder: 'asc' } });
  }

  async findOne(flyerId: string, productId: string): Promise<FlyerProduct | null> {
    return this.prisma.flyerProduct.findFirst({ where: { flyerId, productId } });
  }

  async maxSortOrder(flyerId: string): Promise<number> {
    const top = await this.prisma.flyerProduct.findFirst({
      where: { flyerId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return top?.sortOrder ?? -1;
  }

  async add(data: Prisma.FlyerProductUncheckedCreateInput): Promise<FlyerProduct> {
    return this.prisma.flyerProduct.create({ data });
  }

  async update(flyerId: string, productId: string, data: Prisma.FlyerProductUpdateInput): Promise<FlyerProduct | null> {
    const result = await this.prisma.flyerProduct.updateMany({ where: { flyerId, productId }, data });
    if (result.count === 0) return null;
    return this.findOne(flyerId, productId);
  }

  async remove(flyerId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.flyerProduct.deleteMany({ where: { flyerId, productId } });
    return result.count > 0;
  }

  async reorder(flyerId: string, orderedProductIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedProductIds.map((productId, index) =>
        this.prisma.flyerProduct.updateMany({
          where: { flyerId, productId },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}
