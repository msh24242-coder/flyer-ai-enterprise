import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { ProductsRepository } from './products.repository';
import { CompanyRepository } from '../company/company.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly companyRepo: CompanyRepository,
  ) {}

  async list(companyId: string, requesterId: string, search?: string): Promise<Product[]> {
    await this.assertMembership(companyId, requesterId);
    return this.productsRepo.list(companyId, search);
  }

  async getById(companyId: string, requesterId: string, id: string): Promise<Product> {
    await this.assertMembership(companyId, requesterId);
    const product = await this.productsRepo.findById(companyId, id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(companyId: string, requesterId: string, dto: CreateProductDto): Promise<Product> {
    await this.assertMembership(companyId, requesterId);

    const existing = await this.productsRepo.findBySku(companyId, dto.sku);
    if (existing) throw new ConflictException('A product with this SKU already exists');

    return this.productsRepo.create(companyId, requesterId, {
      sku: dto.sku,
      name: dto.name,
      nameAr: dto.nameAr,
      imageUrl: dto.imageUrl,
      description: dto.description,
      basePrice: dto.basePrice,
      costPrice: dto.costPrice,
      currency: dto.currency,
      stockQuantity: dto.stockQuantity,
      category: dto.category,
      tags: dto.tags ?? [],
      isActive: dto.isActive ?? true,
    });
  }

  async update(
    companyId: string,
    requesterId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    await this.assertMembership(companyId, requesterId);

    const existing = await this.productsRepo.findById(companyId, id);
    if (!existing) throw new NotFoundException('Product not found');

    const updated = await this.productsRepo.update(companyId, id, dto);
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async delete(companyId: string, requesterId: string, id: string): Promise<void> {
    await this.assertMembership(companyId, requesterId);

    const deleted = await this.productsRepo.delete(companyId, id);
    if (!deleted) throw new NotFoundException('Product not found');
  }

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
  }
}
