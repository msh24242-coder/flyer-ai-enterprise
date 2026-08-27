import { ForbiddenException } from '@nestjs/common';
import { AssetsService } from '../assets.service';
import { AssetsRepository } from '../assets.repository';
import { AssetsStorageService } from '../assets.storage.service';
import { CompanyRepository } from '../../company/company.repository';

const COMPANY_B = 'company-bbb';
const USER_IN_A = 'user-in-a';

const mockAssetsRepo: jest.Mocked<AssetsRepository> = {
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
} as never;

const mockStorage: jest.Mocked<AssetsStorageService> = {
  validate: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  resolveForServing: jest.fn(),
} as never;

const mockCompanyRepo: Partial<jest.Mocked<CompanyRepository>> = {
  findMemberInCompany: jest.fn(),
};

describe('Assets tenant isolation', () => {
  let service: AssetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssetsService(mockAssetsRepo, mockStorage, mockCompanyRepo as never);
  });

  it('user from company A cannot list assets of company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.list(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockAssetsRepo.list).not.toHaveBeenCalled();
  });

  it('user from company A cannot upload an asset into company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    const file = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 10, originalname: 'a.png' };
    await expect(service.upload(COMPANY_B, USER_IN_A, file)).rejects.toThrow(ForbiddenException);
    expect(mockStorage.save).not.toHaveBeenCalled();
  });

  it('user from company A cannot delete an asset in company B', async () => {
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(null);
    await expect(service.delete(COMPANY_B, USER_IN_A, 'asset-1')).rejects.toThrow(ForbiddenException);
    expect(mockAssetsRepo.delete).not.toHaveBeenCalled();
  });
});
