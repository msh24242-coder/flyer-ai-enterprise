import { FlyerProductsRepository } from '../flyer-products.repository';

const FLYER_ID = 'flyer-1';

const mockFlyerProduct = {
  id: 'fp-1',
  flyerId: FLYER_ID,
  productId: 'prod-1',
  displayPrice: 9.99,
  originalPrice: 12.99,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  flyerProduct: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

function makeRepo() {
  return new FlyerProductsRepository(mockPrisma as never);
}

describe('FlyerProductsRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listByFlyer orders by sortOrder', async () => {
    mockPrisma.flyerProduct.findMany.mockResolvedValue([mockFlyerProduct]);
    await makeRepo().listByFlyer(FLYER_ID);
    expect(mockPrisma.flyerProduct.findMany).toHaveBeenCalledWith({
      where: { flyerId: FLYER_ID },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('findOne scopes by flyerId and productId', async () => {
    mockPrisma.flyerProduct.findFirst.mockResolvedValue(mockFlyerProduct);
    const result = await makeRepo().findOne(FLYER_ID, 'prod-1');
    expect(result).toEqual(mockFlyerProduct);
    expect(mockPrisma.flyerProduct.findFirst).toHaveBeenCalledWith({ where: { flyerId: FLYER_ID, productId: 'prod-1' } });
  });

  describe('maxSortOrder', () => {
    it('returns the highest sortOrder for the flyer', async () => {
      mockPrisma.flyerProduct.findFirst.mockResolvedValue({ sortOrder: 4 });
      expect(await makeRepo().maxSortOrder(FLYER_ID)).toBe(4);
    });

    it('returns -1 when the flyer has no products yet', async () => {
      mockPrisma.flyerProduct.findFirst.mockResolvedValue(null);
      expect(await makeRepo().maxSortOrder(FLYER_ID)).toBe(-1);
    });
  });

  describe('update', () => {
    it('scopes the update to flyerId+productId and returns the fresh row', async () => {
      mockPrisma.flyerProduct.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.flyerProduct.findFirst.mockResolvedValue({ ...mockFlyerProduct, displayPrice: 5 });

      const result = await makeRepo().update(FLYER_ID, 'prod-1', { displayPrice: 5 });

      expect(mockPrisma.flyerProduct.updateMany).toHaveBeenCalledWith({
        where: { flyerId: FLYER_ID, productId: 'prod-1' },
        data: { displayPrice: 5 },
      });
      expect(result?.displayPrice).toBe(5);
    });

    it('returns null when nothing matched', async () => {
      mockPrisma.flyerProduct.updateMany.mockResolvedValue({ count: 0 });
      expect(await makeRepo().update(FLYER_ID, 'prod-1', { displayPrice: 5 })).toBeNull();
    });
  });

  describe('remove', () => {
    it('returns true when a row was removed', async () => {
      mockPrisma.flyerProduct.deleteMany.mockResolvedValue({ count: 1 });
      expect(await makeRepo().remove(FLYER_ID, 'prod-1')).toBe(true);
    });

    it('returns false when nothing matched', async () => {
      mockPrisma.flyerProduct.deleteMany.mockResolvedValue({ count: 0 });
      expect(await makeRepo().remove(FLYER_ID, 'prod-1')).toBe(false);
    });
  });

  describe('reorder', () => {
    it('runs one scoped updateMany per product inside a transaction, assigning sortOrder from array index', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);
      await makeRepo().reorder(FLYER_ID, ['prod-b', 'prod-a']);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = mockPrisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(2);
      expect(mockPrisma.flyerProduct.updateMany).toHaveBeenNthCalledWith(1, {
        where: { flyerId: FLYER_ID, productId: 'prod-b' },
        data: { sortOrder: 0 },
      });
      expect(mockPrisma.flyerProduct.updateMany).toHaveBeenNthCalledWith(2, {
        where: { flyerId: FLYER_ID, productId: 'prod-a' },
        data: { sortOrder: 1 },
      });
    });
  });
});
