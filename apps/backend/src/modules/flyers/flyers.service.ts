import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Flyer, FlyerStatus, Prisma } from '@prisma/client';
import { FlyersRepository, FlyerListItem, FlyerDetail } from './flyers.repository';
import { FlyerProductsRepository } from './flyer-products.repository';
import { CompanyRepository } from '../company/company.repository';
import { ProductsRepository } from '../products/products.repository';
import { PrismaService } from '../../database/prisma.service';
import { slugify, buildSlugVariant } from '../../common/utils/slug';
import { CreateFlyerDto } from './dto/create-flyer.dto';
import { UpdateFlyerDto } from './dto/update-flyer.dto';
import { AddFlyerProductDto } from './dto/add-flyer-product.dto';
import { UpdateFlyerProductDto } from './dto/update-flyer-product.dto';
import { MAX_DESIGN_DATA_BYTES, FlyerDesignData } from './flyers.types';
import { FlyersImportService, ImportResult } from './flyers-import.service';
import { FlyersImagesService, ImageMatchFile, ImageMatchResult } from './flyers-images.service';
import { FlyersExportService } from './flyers-export.service';
import { buildFlyerHtml, FlyerHtmlItem } from './flyer-html.builder';

const MAX_SLUG_ATTEMPTS = 50;

function isUniqueConstraintViolation(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    String(err.meta?.target ?? '').includes(field)
  );
}

@Injectable()
export class FlyersService {
  constructor(
    private readonly flyersRepo: FlyersRepository,
    private readonly flyerProductsRepo: FlyerProductsRepository,
    private readonly companyRepo: CompanyRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly prisma: PrismaService,
    private readonly importService: FlyersImportService,
    private readonly imagesService: FlyersImagesService,
    private readonly exportService: FlyersExportService,
  ) {}

  async list(companyId: string, requesterId: string, filters: { status?: FlyerStatus; campaignId?: string }): Promise<FlyerListItem[]> {
    await this.assertMembership(companyId, requesterId);
    return this.flyersRepo.list(companyId, filters);
  }

  async getById(companyId: string, requesterId: string, id: string): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);
    const flyer = await this.flyersRepo.findDetailById(companyId, id);
    if (!flyer) throw new NotFoundException('Flyer not found');
    return flyer;
  }

  async create(companyId: string, requesterId: string, dto: CreateFlyerDto): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);

    if (dto.campaignId) await this.assertCampaignInCompany(companyId, dto.campaignId);
    this.assertDesignDataSize(dto.designData);

    const baseSlug = slugify(dto.title) || 'flyer';
    const created = await this.createWithUniqueSlug(companyId, requesterId, baseSlug, {
      title: dto.title,
      designData: (dto.designData as Prisma.InputJsonValue) ?? {},
      thumbnail: dto.thumbnail,
      ...(dto.campaignId ? { campaign: { connect: { id: dto.campaignId } } } : {}),
    });
    return this.getDetailOrThrow(companyId, created.id);
  }

  /**
   * Mirrors AuthService.createCompanyWithUniqueSlug: the slug is derived
   * from the title, but that exact slug may already be taken within this
   * company. Try deterministic suffixed variants, and catch the unique
   * constraint on insert (not just a pre-check) to close the race window
   * between two concurrent creates picking the same slug.
   */
  private async createWithUniqueSlug(
    companyId: string,
    createdBy: string,
    baseSlug: string,
    data: Omit<Prisma.FlyerCreateWithoutCompanyInput, 'slug' | 'createdBy'>,
  ): Promise<Flyer> {
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const candidateSlug = buildSlugVariant(baseSlug, attempt);
      const taken = await this.flyersRepo.slugExists(companyId, candidateSlug);
      if (taken) continue;

      try {
        return await this.flyersRepo.create(companyId, createdBy, { ...data, slug: candidateSlug });
      } catch (err) {
        if (isUniqueConstraintViolation(err, 'slug')) continue;
        throw err;
      }
    }
    throw new ConflictException('Unable to generate a unique flyer slug. Please try a different title.');
  }

  async update(companyId: string, requesterId: string, id: string, dto: UpdateFlyerDto): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);

    const existing = await this.flyersRepo.findById(companyId, id);
    if (!existing) throw new NotFoundException('Flyer not found');

    if (dto.campaignId) await this.assertCampaignInCompany(companyId, dto.campaignId);
    this.assertDesignDataSize(dto.designData);

    const data: Prisma.FlyerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.designData !== undefined) data.designData = dto.designData as Prisma.InputJsonValue;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.campaignId !== undefined) {
      data.campaign = dto.campaignId ? { connect: { id: dto.campaignId } } : { disconnect: true };
    }

    const updated = await this.flyersRepo.update(companyId, id, data);
    if (!updated) throw new NotFoundException('Flyer not found');
    return this.getDetailOrThrow(companyId, id);
  }

  async delete(companyId: string, requesterId: string, id: string): Promise<void> {
    await this.assertMembership(companyId, requesterId);
    const deleted = await this.flyersRepo.delete(companyId, id);
    if (!deleted) throw new NotFoundException('Flyer not found');
  }

  /**
   * Archive/unarchive are deliberately separate from the approval lifecycle
   * (DRAFT -> IN_REVIEW -> APPROVED/REJECTED, which UpdateFlyerDto excludes
   * on purpose — those transitions belong behind the real ApprovalEngine).
   * Archiving is an administrative "get this out of my active list" action,
   * available from any status, and never itself submits anything for review.
   */
  async archive(companyId: string, requesterId: string, id: string): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);
    const updated = await this.flyersRepo.update(companyId, id, { status: FlyerStatus.ARCHIVED });
    if (!updated) throw new NotFoundException('Flyer not found');
    return this.getDetailOrThrow(companyId, id);
  }

  async unarchive(companyId: string, requesterId: string, id: string): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);
    const updated = await this.flyersRepo.update(companyId, id, { status: FlyerStatus.DRAFT });
    if (!updated) throw new NotFoundException('Flyer not found');
    return this.getDetailOrThrow(companyId, id);
  }

  async duplicate(companyId: string, requesterId: string, id: string): Promise<FlyerDetail> {
    await this.assertMembership(companyId, requesterId);

    const source = await this.flyersRepo.findDetailById(companyId, id);
    if (!source) throw new NotFoundException('Flyer not found');

    const baseSlug = slugify(`${source.title} copy`) || 'flyer-copy';
    const duplicated = await this.createWithUniqueSlug(companyId, requesterId, baseSlug, {
      title: `${source.title} (Copy)`,
      designData: source.designData as Prisma.InputJsonValue,
      thumbnail: source.thumbnail,
      ...(source.campaignId ? { campaign: { connect: { id: source.campaignId } } } : {}),
    });

    if (source.flyerProducts.length > 0) {
      await this.prisma.flyerProduct.createMany({
        data: source.flyerProducts.map((fp) => ({
          flyerId: duplicated.id,
          productId: fp.productId,
          displayPrice: fp.displayPrice,
          originalPrice: fp.originalPrice,
          sortOrder: fp.sortOrder,
        })),
      });
    }

    return this.getDetailOrThrow(companyId, duplicated.id);
  }

  private async getDetailOrThrow(companyId: string, id: string): Promise<FlyerDetail> {
    const detail = await this.flyersRepo.findDetailById(companyId, id);
    if (!detail) throw new NotFoundException('Flyer not found');
    return detail;
  }

  // ─── Flyer Products ───────────────────────────────────────────────────────

  async addProduct(companyId: string, requesterId: string, flyerId: string, dto: AddFlyerProductDto) {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);

    const product = await this.productsRepo.findById(companyId, dto.productId);
    if (!product) throw new NotFoundException('Product not found in this company');

    const existing = await this.flyerProductsRepo.findOne(flyerId, dto.productId);
    if (existing) throw new ConflictException('This product is already attached to the flyer');

    const sortOrder = dto.sortOrder ?? (await this.flyerProductsRepo.maxSortOrder(flyerId)) + 1;

    return this.flyerProductsRepo.add({
      flyerId,
      productId: dto.productId,
      displayPrice: dto.displayPrice,
      originalPrice: dto.originalPrice,
      sortOrder,
    });
  }

  async updateProduct(
    companyId: string,
    requesterId: string,
    flyerId: string,
    productId: string,
    dto: UpdateFlyerProductDto,
  ) {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);

    const data: Prisma.FlyerProductUpdateInput = {};
    if (dto.displayPrice !== undefined) data.displayPrice = dto.displayPrice;
    if (dto.originalPrice !== undefined) data.originalPrice = dto.originalPrice;

    const updated = await this.flyerProductsRepo.update(flyerId, productId, data);
    if (!updated) throw new NotFoundException('Product is not attached to this flyer');
    return updated;
  }

  async removeProduct(companyId: string, requesterId: string, flyerId: string, productId: string): Promise<void> {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);

    const removed = await this.flyerProductsRepo.remove(flyerId, productId);
    if (!removed) throw new NotFoundException('Product is not attached to this flyer');
  }

  async reorderProducts(companyId: string, requesterId: string, flyerId: string, order: string[]): Promise<void> {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);

    const attached = await this.flyerProductsRepo.listByFlyer(flyerId);
    const attachedIds = new Set(attached.map((fp) => fp.productId));

    if (order.length !== attachedIds.size || !order.every((id) => attachedIds.has(id))) {
      throw new BadRequestException('order must contain exactly the product IDs currently attached to this flyer');
    }

    await this.flyerProductsRepo.reorder(flyerId, order);
  }

  // ─── Excel import, image matching, preview & PDF export ──────────────────

  async importExcel(companyId: string, requesterId: string, flyerId: string, buffer: Buffer): Promise<ImportResult> {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);
    return this.importService.importFromBuffer(companyId, requesterId, flyerId, buffer);
  }

  async uploadImages(companyId: string, requesterId: string, flyerId: string, files: ImageMatchFile[]): Promise<ImageMatchResult> {
    await this.assertMembership(companyId, requesterId);
    await this.assertFlyerInCompany(companyId, flyerId);
    return this.imagesService.matchAndStore(companyId, files);
  }

  async renderHtml(companyId: string, requesterId: string, id: string): Promise<string> {
    const flyer = await this.getById(companyId, requesterId, id);
    return buildFlyerHtml({
      title: flyer.title,
      grid: (flyer.designData as FlyerDesignData | null)?.layout?.grid,
      branding: (flyer.designData as FlyerDesignData | null)?.branding,
      items: this.toHtmlItems(flyer),
    }).html;
  }

  async exportPdf(companyId: string, requesterId: string, id: string): Promise<Buffer> {
    const flyer = await this.getById(companyId, requesterId, id);
    const { html } = buildFlyerHtml({
      title: flyer.title,
      grid: (flyer.designData as FlyerDesignData | null)?.layout?.grid,
      branding: (flyer.designData as FlyerDesignData | null)?.branding,
      items: this.toHtmlItems(flyer),
    });
    return this.exportService.renderPdf(html);
  }

  private toHtmlItems(flyer: FlyerDetail): FlyerHtmlItem[] {
    return flyer.flyerProducts
      .filter((fp) => fp.product.isActive)
      .map((fp) => ({
        sku: fp.product.sku,
        name: fp.product.name,
        nameAr: fp.product.nameAr,
        imageUrl: fp.product.imageUrl,
        displayPrice: fp.displayPrice ?? fp.product.basePrice,
        originalPrice: fp.originalPrice,
        currency: fp.product.currency,
      }));
  }

  // ─── Tenant isolation helpers ─────────────────────────────────────────────

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
  }

  private async assertFlyerInCompany(companyId: string, flyerId: string): Promise<void> {
    const flyer = await this.flyersRepo.findById(companyId, flyerId);
    if (!flyer) throw new NotFoundException('Flyer not found');
  }

  private async assertCampaignInCompany(companyId: string, campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found in this company');
  }

  private assertDesignDataSize(designData: FlyerDesignData | undefined): void {
    if (designData === undefined) return;
    const size = Buffer.byteLength(JSON.stringify(designData), 'utf8');
    if (size > MAX_DESIGN_DATA_BYTES) {
      throw new BadRequestException(`designData exceeds the ${MAX_DESIGN_DATA_BYTES / 1024}KB limit`);
    }
  }
}
