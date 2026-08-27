import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from '../products.service';
import { ProductsRepository } from '../products.repository';
import { CompanyRepository } from '../../company/company.repository';
import { UserRole } from '@prisma/client';

const COMPANY_ID = 'co-1';
const USER_ID = 'user-1';

const activeMember = { id: USER_ID, companyId: COMPANY_ID, isActive: true, role: UserRole.MEMBER };

const mockProduct = {
  id: 'prod-1',
  companyId: COMPANY_ID,
  createdBy: USER_ID,
  sku: 'SKU-1',
  name: 'Widget',
  basePrice: 10,
  tags: [],
  isActive: true,
};

const mockProductsRepo: jest.Mocked<ProductsRepository> = {
  list: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as never;

const mockCompanyRepo: Partial<jest.Mocked<CompanyRepository>> = {
  findMemberInCompany: jest.fn(),
};

function makeService() {
  return new ProductsService(mockProductsRepo, mockCompanyRepo as never);
}

describe('ProductsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(activeMember as never);
  });

  describe('create', () => {
    it('creates a product when the SKU is free', async () => {
      mockProductsRepo.findBySku.mockResolvedValue(null);
      mockProductsRepo.create.mockResolvedValue(mockProduct as never);

      const result = await makeService().create(COMPANY_ID, USER_ID, {
        sku: 'SKU-1',
        name: 'Widget',
        basePrice: 10,
      });

      expect(result).toEqual(mockProduct);
      expect(mockProductsRepo.create).toHaveBeenCalled();
    });

    it('rejects a duplicate SKU within the same company', async () => {
      mockProductsRepo.findBySku.mockResolvedValue(mockProduct as never);

      await expect(
        makeService().create(COMPANY_ID, USER_ID, { sku: 'SKU-1', name: 'Widget', basePrice: 10 }),
      ).rejects.toThrow(ConflictException);
      expect(mockProductsRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the product does not exist in this company', async () => {
      mockProductsRepo.findById.mockResolvedValue(null);

      await expect(
        makeService().update(COMPANY_ID, USER_ID, 'missing', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      mockProductsRepo.delete.mockResolvedValue(false);
      await expect(makeService().delete(COMPANY_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
