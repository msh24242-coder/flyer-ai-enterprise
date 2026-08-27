import { NotFoundException } from '@nestjs/common';
import { AssetsService } from '../assets.service';
import { AssetsRepository } from '../assets.repository';
import { AssetsStorageService } from '../assets.storage.service';
import { CompanyRepository } from '../../company/company.repository';
import { UserRole } from '@prisma/client';

const COMPANY_ID = 'co-1';
const USER_ID = 'user-1';
const activeMember = { id: USER_ID, companyId: COMPANY_ID, isActive: true, role: UserRole.MEMBER };

const mockAsset = {
  id: 'asset-1',
  companyId: COMPANY_ID,
  uploadedBy: USER_ID,
  filename: 'a.png',
  mimeType: 'image/png',
  fileSizeBytes: 10,
  storagePath: '/uploads/co-1/a.png',
  publicUrl: 'http://backend/uploads/co-1/a.png',
  tags: [],
};

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

function makeService() {
  return new AssetsService(mockAssetsRepo, mockStorage, mockCompanyRepo as never);
}

describe('AssetsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanyRepo.findMemberInCompany!.mockResolvedValue(activeMember as never);
  });

  describe('upload', () => {
    it('validates, saves to disk, and persists the DB row', async () => {
      mockStorage.save.mockResolvedValue({
        filename: 'a.png',
        storagePath: '/uploads/co-1/a.png',
        publicUrl: 'http://backend/uploads/co-1/a.png',
      });
      mockAssetsRepo.create.mockResolvedValue(mockAsset as never);

      const file = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 10, originalname: 'a.png' };
      const result = await makeService().upload(COMPANY_ID, USER_ID, file, ['logo']);

      expect(mockStorage.validate).toHaveBeenCalledWith(file);
      expect(mockStorage.save).toHaveBeenCalledWith(COMPANY_ID, file);
      expect(mockAssetsRepo.create).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        uploadedBy: USER_ID,
        filename: 'a.png',
        mimeType: 'image/png',
        fileSizeBytes: 10,
        storagePath: '/uploads/co-1/a.png',
        publicUrl: 'http://backend/uploads/co-1/a.png',
        tags: ['logo'],
      });
      expect(result).toEqual(mockAsset);
    });

    it('propagates a validation failure without writing to disk', async () => {
      mockStorage.validate.mockImplementation(() => {
        throw new Error('bad mime type');
      });
      const file = { buffer: Buffer.from('x'), mimetype: 'text/html', size: 10, originalname: 'a.html' };

      await expect(makeService().upload(COMPANY_ID, USER_ID, file)).rejects.toThrow('bad mime type');
      expect(mockStorage.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the DB row then unlinks the file', async () => {
      mockAssetsRepo.findById.mockResolvedValue(mockAsset as never);
      mockAssetsRepo.delete.mockResolvedValue(true);

      await makeService().delete(COMPANY_ID, USER_ID, 'asset-1');

      expect(mockAssetsRepo.delete).toHaveBeenCalledWith(COMPANY_ID, 'asset-1');
      expect(mockStorage.delete).toHaveBeenCalledWith(mockAsset.storagePath);
    });

    it('throws NotFoundException when the asset does not exist in this company', async () => {
      mockAssetsRepo.findById.mockResolvedValue(null);
      await expect(makeService().delete(COMPANY_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });
});
