import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from '../products.service';
import { ProductsRepository } from '../products.repository';
import { CompanyRepository } from '../../company/company.repository';

const COMPANY_A = 'company-aaa';
const COMPANY_B = 'company-bbb';
const USER_IN_A = 'user-in-a';

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

describe('Products tenant isolation', () => {
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(mockProductsRepo, mockCompanyRepo as never);
  });

  it('user from company A cannot list products of company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);

    await expect(service.list(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockProductsRepo.list).not.toHaveBeenCalled();
  });

  it('user from company A cannot create a product in company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);

    await expect(
      service.create(COMPANY_B, USER_IN_A, { sku: 'X', name: 'Y', basePrice: 1 }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockProductsRepo.create).not.toHaveBeenCalled();
  });

  it('user from company A cannot read a product belonging to company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);

    await expect(service.getById(COMPANY_B, USER_IN_A, 'prod-1')).rejects.toThrow(ForbiddenException);
    expect(mockProductsRepo.findById).not.toHaveBeenCalled();
  });

  it('user from company A cannot update a product in company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);

    await expect(
      service.update(COMPANY_B, USER_IN_A, 'prod-1', { name: 'Hacked' }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockProductsRepo.update).not.toHaveBeenCalled();
  });

  it('user from company A cannot delete a product in company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);

    await expect(service.delete(COMPANY_B, USER_IN_A, 'prod-1')).rejects.toThrow(ForbiddenException);
    expect(mockProductsRepo.delete).not.toHaveBeenCalled();
  });

  it('inactive member of company A is denied even for their own company', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: false,
    } as never);

    await expect(service.list(COMPANY_A, USER_IN_A)).rejects.toThrow(ForbiddenException);
  });
});
