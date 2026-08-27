import { AssetsRepository } from '../assets.repository';

const COMPANY_ID = 'co-1';

const mockAsset = {
  id: 'asset-1',
  companyId: COMPANY_ID,
  uploadedBy: 'user-1',
  filename: 'a.png',
  mimeType: 'image/png',
  fileSizeBytes: 1024,
  storagePath: '/uploads/co-1/a.png',
  publicUrl: 'http://backend/uploads/co-1/a.png',
  tags: ['logo'],
  createdAt: new Date(),
};

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

function makeRepo() {
  return new AssetsRepository(mockPrisma as never);
}

describe('AssetsRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists assets scoped to the company', async () => {
    mockPrisma.asset.findMany.mockResolvedValue([mockAsset]);
    const result = await makeRepo().list(COMPANY_ID);
    expect(result).toEqual([mockAsset]);
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('filters by tag when provided', async () => {
    mockPrisma.asset.findMany.mockResolvedValue([]);
    await makeRepo().list(COMPANY_ID, 'logo');
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID, tags: { has: 'logo' } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findById scopes lookup by companyId', async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(mockAsset);
    const result = await makeRepo().findById(COMPANY_ID, 'asset-1');
    expect(result).toEqual(mockAsset);
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({ where: { id: 'asset-1', companyId: COMPANY_ID } });
  });

  it('create passes data straight through', async () => {
    mockPrisma.asset.create.mockResolvedValue(mockAsset);
    await makeRepo().create(mockAsset as never);
    expect(mockPrisma.asset.create).toHaveBeenCalledWith({ data: mockAsset });
  });

  describe('delete', () => {
    it('returns true when a row was deleted within scope', async () => {
      mockPrisma.asset.deleteMany.mockResolvedValue({ count: 1 });
      expect(await makeRepo().delete(COMPANY_ID, 'asset-1')).toBe(true);
      expect(mockPrisma.asset.deleteMany).toHaveBeenCalledWith({ where: { id: 'asset-1', companyId: COMPANY_ID } });
    });

    it('returns false when nothing matched the company scope', async () => {
      mockPrisma.asset.deleteMany.mockResolvedValue({ count: 0 });
      expect(await makeRepo().delete(COMPANY_ID, 'asset-1')).toBe(false);
    });
  });
});
