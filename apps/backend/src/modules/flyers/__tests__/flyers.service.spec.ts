import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FlyersService } from '../flyers.service';
import { FlyersRepository } from '../flyers.repository';
import { FlyerProductsRepository } from '../flyer-products.repository';
import { CompanyRepository } from '../../company/company.repository';
import { ProductsRepository } from '../../products/products.repository';
import { PrismaService } from '../../../database/prisma.service';
import { UserRole, FlyerStatus, Prisma } from '@prisma/client';

const COMPANY_ID = 'co-1';
const USER_ID = 'user-1';
const activeMember = { id: USER_ID, companyId: COMPANY_ID, isActive: true, role: UserRole.MEMBER };

const mockFlyer = {
  id: 'flyer-1',
  companyId: COMPANY_ID,
  createdBy: USER_ID,
  title: 'Weekly Offers',
  slug: 'weekly-offers',
  status: FlyerStatus.DRAFT,
  designData: {},
  thumbnail: null,
  campaignId: null,
};

const mockFlyersRepo: jest.Mocked<FlyersRepository> = {
  list: jest.fn(),
  findDetailById: jest.fn(),
  findById: jest.fn(),
  slugExists: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as never;

const mockFlyerProductsRepo: jest.Mocked<FlyerProductsRepository> = {
  listByFlyer: jest.fn(),
  findOne: jest.fn(),
  maxSortOrder: jest.fn(),
  add: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  reorder: jest.fn(),
} as never;

const mockCompanyRepo: Partial<jest.Mocked<CompanyRepository>> = {
  findMemberInCompany: jest.fn(),
};

const mockProductsRepo: Partial<jest.Mocked<ProductsRepository>> = {
  findById: jest.fn(),
};

const mockPrisma = {
  campaign: { findFirst: jest.fn() },
  flyerProduct: { createMany: jest.fn() },
};

function makeService() {
  return new FlyersService(
    mockFlyersRepo,
    mockFlyerProductsRepo,
    mockCompanyRepo as never,
    mockProductsRepo as never,
    mockPrisma as unknown as PrismaService,
  );
}

describe('FlyersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(activeMember as never);
  });

  describe('create', () => {
    it('creates a flyer with a slug derived from the title', async () => {
      mockFlyersRepo.slugExists.mockResolvedValue(false);
      mockFlyersRepo.create.mockResolvedValue(mockFlyer as never);

      const result = await makeService().create(COMPANY_ID, USER_ID, { title: 'Weekly Offers' });

      expect(result).toEqual(mockFlyer);
      expect(mockFlyersRepo.slugExists).toHaveBeenCalledWith(COMPANY_ID, 'weekly-offers');
      expect(mockFlyersRepo.create).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
        expect.objectContaining({ title: 'Weekly Offers', slug: 'weekly-offers' }),
      );
    });

    it('tries a suffixed slug variant when the base slug is taken', async () => {
      mockFlyersRepo.slugExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mockFlyersRepo.create.mockResolvedValue({ ...mockFlyer, slug: 'weekly-offers-2' } as never);

      const result = await makeService().create(COMPANY_ID, USER_ID, { title: 'Weekly Offers' });

      expect(result.slug).toBe('weekly-offers-2');
      expect(mockFlyersRepo.create).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
        expect.objectContaining({ slug: 'weekly-offers-2' }),
      );
    });

    it('retries past a race-lost unique constraint violation on insert', async () => {
      mockFlyersRepo.slugExists.mockResolvedValue(false);
      const p2002 = Object.assign(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['companyId', 'slug'] } }));
      mockFlyersRepo.create.mockRejectedValueOnce(p2002).mockResolvedValueOnce({ ...mockFlyer, slug: 'weekly-offers-2' } as never);

      const result = await makeService().create(COMPANY_ID, USER_ID, { title: 'Weekly Offers' });
      expect(result.slug).toBe('weekly-offers-2');
    });

    it('rejects a campaignId that does not belong to this company', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(
        makeService().create(COMPANY_ID, USER_ID, { title: 'X', campaignId: 'camp-other' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockFlyersRepo.create).not.toHaveBeenCalled();
    });

    it('rejects designData over the size limit', async () => {
      const bigDesignData = { blob: 'x'.repeat(300 * 1024) };
      await expect(
        makeService().create(COMPANY_ID, USER_ID, { title: 'X', designData: bigDesignData }),
      ).rejects.toThrow(BadRequestException);
      expect(mockFlyersRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('throws NotFoundException when the flyer does not exist in this company', async () => {
      mockFlyersRepo.findDetailById.mockResolvedValue(null);
      await expect(makeService().getById(COMPANY_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the flyer does not exist', async () => {
      mockFlyersRepo.findById.mockResolvedValue(null);
      await expect(makeService().update(COMPANY_ID, USER_ID, 'missing', { title: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('disconnects the campaign when campaignId is explicitly set to null', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyersRepo.update.mockResolvedValue(mockFlyer as never);

      await makeService().update(COMPANY_ID, USER_ID, 'flyer-1', { campaignId: null });

      expect(mockFlyersRepo.update).toHaveBeenCalledWith(
        COMPANY_ID,
        'flyer-1',
        expect.objectContaining({ campaign: { disconnect: true } }),
      );
    });

    it('validates a new campaignId belongs to the company', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(
        makeService().update(COMPANY_ID, USER_ID, 'flyer-1', { campaignId: 'camp-other' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockFlyersRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      mockFlyersRepo.delete.mockResolvedValue(false);
      await expect(makeService().delete(COMPANY_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicate', () => {
    it('copies title, designData, campaign, and attached products into a new flyer', async () => {
      const source = {
        ...mockFlyer,
        flyerProducts: [
          { productId: 'prod-1', displayPrice: 5, originalPrice: 8, sortOrder: 0 },
          { productId: 'prod-2', displayPrice: null, originalPrice: null, sortOrder: 1 },
        ],
      };
      mockFlyersRepo.findDetailById.mockResolvedValue(source as never);
      mockFlyersRepo.slugExists.mockResolvedValue(false);
      const duplicated = { ...mockFlyer, id: 'flyer-2', slug: 'weekly-offers-copy' };
      mockFlyersRepo.create.mockResolvedValue(duplicated as never);
      mockPrisma.flyerProduct.createMany.mockResolvedValue({ count: 2 });

      const result = await makeService().duplicate(COMPANY_ID, USER_ID, 'flyer-1');

      expect(result).toEqual(duplicated);
      expect(mockFlyersRepo.create).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
        expect.objectContaining({ title: 'Weekly Offers (Copy)' }),
      );
      expect(mockPrisma.flyerProduct.createMany).toHaveBeenCalledWith({
        data: [
          { flyerId: 'flyer-2', productId: 'prod-1', displayPrice: 5, originalPrice: 8, sortOrder: 0 },
          { flyerId: 'flyer-2', productId: 'prod-2', displayPrice: null, originalPrice: null, sortOrder: 1 },
        ],
      });
    });

    it('throws NotFoundException when the source flyer does not exist', async () => {
      mockFlyersRepo.findDetailById.mockResolvedValue(null);
      await expect(makeService().duplicate(COMPANY_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addProduct', () => {
    it('attaches an existing product from the same company', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockProductsRepo.findById!.mockResolvedValue({ id: 'prod-1' } as never);
      mockFlyerProductsRepo.findOne.mockResolvedValue(null);
      mockFlyerProductsRepo.maxSortOrder.mockResolvedValue(-1);
      mockFlyerProductsRepo.add.mockResolvedValue({ id: 'fp-1' } as never);

      await makeService().addProduct(COMPANY_ID, USER_ID, 'flyer-1', { productId: 'prod-1' });

      expect(mockFlyerProductsRepo.add).toHaveBeenCalledWith(
        expect.objectContaining({ flyerId: 'flyer-1', productId: 'prod-1', sortOrder: 0 }),
      );
    });

    it('rejects a product that does not belong to this company', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockProductsRepo.findById!.mockResolvedValue(null);

      await expect(
        makeService().addProduct(COMPANY_ID, USER_ID, 'flyer-1', { productId: 'prod-other-co' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockFlyerProductsRepo.add).not.toHaveBeenCalled();
    });

    it('rejects attaching a flyer that does not exist in this company', async () => {
      mockFlyersRepo.findById.mockResolvedValue(null);
      await expect(
        makeService().addProduct(COMPANY_ID, USER_ID, 'missing-flyer', { productId: 'prod-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a product already attached to the flyer', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockProductsRepo.findById!.mockResolvedValue({ id: 'prod-1' } as never);
      mockFlyerProductsRepo.findOne.mockResolvedValue({ id: 'fp-1' } as never);

      await expect(
        makeService().addProduct(COMPANY_ID, USER_ID, 'flyer-1', { productId: 'prod-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProduct', () => {
    it('throws NotFoundException when the product is not attached to this flyer', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyerProductsRepo.update.mockResolvedValue(null);

      await expect(
        makeService().updateProduct(COMPANY_ID, USER_ID, 'flyer-1', 'prod-missing', { displayPrice: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeProduct', () => {
    it('throws NotFoundException when nothing was removed', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyerProductsRepo.remove.mockResolvedValue(false);
      await expect(makeService().removeProduct(COMPANY_ID, USER_ID, 'flyer-1', 'prod-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderProducts', () => {
    it('reorders when the given order exactly matches attached products', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyerProductsRepo.listByFlyer.mockResolvedValue([
        { productId: 'prod-a' },
        { productId: 'prod-b' },
      ] as never);

      await makeService().reorderProducts(COMPANY_ID, USER_ID, 'flyer-1', ['prod-b', 'prod-a']);

      expect(mockFlyerProductsRepo.reorder).toHaveBeenCalledWith('flyer-1', ['prod-b', 'prod-a']);
    });

    it('rejects an order missing one of the attached products', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyerProductsRepo.listByFlyer.mockResolvedValue([
        { productId: 'prod-a' },
        { productId: 'prod-b' },
      ] as never);

      await expect(
        makeService().reorderProducts(COMPANY_ID, USER_ID, 'flyer-1', ['prod-a']),
      ).rejects.toThrow(BadRequestException);
      expect(mockFlyerProductsRepo.reorder).not.toHaveBeenCalled();
    });

    it('rejects an order containing a productId not attached to this flyer', async () => {
      mockFlyersRepo.findById.mockResolvedValue(mockFlyer as never);
      mockFlyerProductsRepo.listByFlyer.mockResolvedValue([{ productId: 'prod-a' }] as never);

      await expect(
        makeService().reorderProducts(COMPANY_ID, USER_ID, 'flyer-1', ['prod-a', 'prod-not-attached']),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
