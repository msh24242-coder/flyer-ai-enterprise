import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FlyersService } from '../flyers.service';
import { FlyersRepository } from '../flyers.repository';
import { FlyerProductsRepository } from '../flyer-products.repository';
import { CompanyRepository } from '../../company/company.repository';
import { ProductsRepository } from '../../products/products.repository';
import { PrismaService } from '../../../database/prisma.service';

const COMPANY_A = 'company-aaa';
const COMPANY_B = 'company-bbb';
const USER_IN_A = 'user-in-a';

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
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Flyers tenant isolation', () => {
  let service: FlyersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  it('user from company A cannot list flyers of company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.list(COMPANY_B, USER_IN_A, {})).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.list).not.toHaveBeenCalled();
  });

  it('user from company A cannot create a flyer in company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.create(COMPANY_B, USER_IN_A, { title: 'X' })).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.create).not.toHaveBeenCalled();
  });

  it('user from company A cannot read company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.getById(COMPANY_B, USER_IN_A, 'flyer-1')).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.findDetailById).not.toHaveBeenCalled();
  });

  it('user from company A cannot update company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.update(COMPANY_B, USER_IN_A, 'flyer-1', { title: 'Hacked' })).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.update).not.toHaveBeenCalled();
  });

  it('user from company A cannot delete company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.delete(COMPANY_B, USER_IN_A, 'flyer-1')).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.delete).not.toHaveBeenCalled();
  });

  it('user from company A cannot duplicate company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.duplicate(COMPANY_B, USER_IN_A, 'flyer-1')).rejects.toThrow(ForbiddenException);
    expect(mockFlyersRepo.findDetailById).not.toHaveBeenCalled();
  });

  it('user from company A cannot add a product to company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(
      service.addProduct(COMPANY_B, USER_IN_A, 'flyer-1', { productId: 'prod-1' }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockFlyerProductsRepo.add).not.toHaveBeenCalled();
  });

  it('user from company A cannot reorder products on company B\'s flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(
      service.reorderProducts(COMPANY_B, USER_IN_A, 'flyer-1', ['prod-1']),
    ).rejects.toThrow(ForbiddenException);
    expect(mockFlyerProductsRepo.reorder).not.toHaveBeenCalled();
  });

  it('inactive member of company A is denied even for their own company', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: false,
    } as never);
    await expect(service.list(COMPANY_A, USER_IN_A, {})).rejects.toThrow(ForbiddenException);
  });

  it('a member of company A cannot attach a product that belongs to company B, even within their own flyer', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue({ id: USER_IN_A, companyId: COMPANY_A, isActive: true } as never);
    mockFlyersRepo.findById.mockResolvedValue({ id: 'flyer-own', companyId: COMPANY_A } as never);
    // ProductsRepository.findById is itself company-scoped — a product from
    // company B never resolves when queried under COMPANY_A, regardless of
    // the raw productId supplied.
    mockProductsRepo.findById!.mockResolvedValue(null);

    await expect(
      service.addProduct(COMPANY_A, USER_IN_A, 'flyer-own', { productId: 'prod-in-company-b' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockFlyerProductsRepo.add).not.toHaveBeenCalled();
  });
});
