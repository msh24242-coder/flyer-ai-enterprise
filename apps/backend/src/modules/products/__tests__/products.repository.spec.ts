import { ProductsRepository } from '../products.repository';

const COMPANY_ID = 'co-1';

const mockProduct = {
  id: 'prod-1',
  companyId: COMPANY_ID,
  createdBy: 'user-1',
  sku: 'SKU-1',
  name: 'Widget',
  description: null,
  basePrice: 10,
  costPrice: null,
  currency: 'QAR',
  stockQuantity: null,
  category: null,
  tags: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

function makeRepo() {
  return new ProductsRepository(mockPrisma as never);
}

describe('ProductsRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('lists products scoped to the company', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      const result = await makeRepo().list(COMPANY_ID);
      expect(result).toEqual([mockProduct]);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies a search filter across name and sku', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await makeRepo().list(COMPANY_ID, 'widget');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_ID,
          OR: [
            { name: { contains: 'widget', mode: 'insensitive' } },
            { sku: { contains: 'widget', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes lookup by companyId', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      const result = await makeRepo().findById(COMPANY_ID, 'prod-1');
      expect(result).toEqual(mockProduct);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', companyId: COMPANY_ID },
      });
    });
  });

  describe('create', () => {
    it('connects the company and sets createdBy', async () => {
      mockPrisma.product.create.mockResolvedValue(mockProduct);
      await makeRepo().create(COMPANY_ID, 'user-1', { sku: 'SKU-1', name: 'Widget', basePrice: 10, tags: [], isActive: true });
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          sku: 'SKU-1',
          name: 'Widget',
          basePrice: 10,
          tags: [],
          isActive: true,
          createdBy: 'user-1',
          company: { connect: { id: COMPANY_ID } },
        },
      });
    });
  });

  describe('update', () => {
    it('scopes the update to the company and returns the fresh record', async () => {
      mockPrisma.product.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.product.findFirst.mockResolvedValue({ ...mockProduct, name: 'Updated' });

      const result = await makeRepo().update(COMPANY_ID, 'prod-1', { name: 'Updated' });

      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod-1', companyId: COMPANY_ID },
        data: { name: 'Updated' },
      });
      expect(result?.name).toBe('Updated');
    });

    it('returns null when no row matches the company scope (cross-tenant no-op)', async () => {
      mockPrisma.product.updateMany.mockResolvedValue({ count: 0 });
      const result = await makeRepo().update(COMPANY_ID, 'prod-1', { name: 'Updated' });
      expect(result).toBeNull();
      expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted within scope', async () => {
      mockPrisma.product.deleteMany.mockResolvedValue({ count: 1 });
      expect(await makeRepo().delete(COMPANY_ID, 'prod-1')).toBe(true);
      expect(mockPrisma.product.deleteMany).toHaveBeenCalledWith({
        where: { id: 'prod-1', companyId: COMPANY_ID },
      });
    });

    it('returns false when nothing matched the company scope', async () => {
      mockPrisma.product.deleteMany.mockResolvedValue({ count: 0 });
      expect(await makeRepo().delete(COMPANY_ID, 'prod-1')).toBe(false);
    });
  });
});
