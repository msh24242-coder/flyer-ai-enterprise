import { Injectable } from '@nestjs/common';
import { Product, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, search?: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { id, companyId } });
  }

  async findBySku(companyId: string, sku: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { companyId, sku } });
  }

  async create(
    companyId: string,
    createdBy: string,
    data: Omit<Prisma.ProductCreateWithoutCompanyInput, 'createdBy'>,
  ): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...data,
        createdBy,
        company: { connect: { id: companyId } },
      },
    });
  }

  async update(companyId: string, id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    const result = await this.prisma.product.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) return null as never;
    return this.findById(companyId, id) as never;
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const result = await this.prisma.product.deleteMany({ where: { id, companyId } });
    return result.count > 0;
  }
}
