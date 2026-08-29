import { FlyersRepository } from '../flyers.repository';
import { FlyerStatus } from '@prisma/client';

const COMPANY_ID = 'co-1';

const mockFlyer = {
  id: 'flyer-1',
  companyId: COMPANY_ID,
  createdBy: 'user-1',
  title: 'Weekly Offers',
  slug: 'weekly-offers',
  status: FlyerStatus.DRAFT,
  designData: {},
  thumbnail: null,
  campaignId: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  flyer: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

function makeRepo() {
  return new FlyersRepository(mockPrisma as never);
}

describe('FlyersRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('lists flyers scoped to the company with a lean select (no designData)', async () => {
      mockPrisma.flyer.findMany.mockResolvedValue([mockFlyer]);
      await makeRepo().list(COMPANY_ID);

      const call = mockPrisma.flyer.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ companyId: COMPANY_ID });
      expect(call.select.designData).toBeUndefined();
      expect(call.select.title).toBe(true);
      expect(call.select.status).toBe(true);
    });

    it('applies status and campaignId filters', async () => {
      mockPrisma.flyer.findMany.mockResolvedValue([]);
      await makeRepo().list(COMPANY_ID, { status: FlyerStatus.DRAFT, campaignId: 'camp-1' });
      const call = mockPrisma.flyer.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ companyId: COMPANY_ID, status: FlyerStatus.DRAFT, campaignId: 'camp-1' });
    });
  });

  describe('findById', () => {
    it('scopes lookup by companyId', async () => {
      mockPrisma.flyer.findFirst.mockResolvedValue(mockFlyer);
      const result = await makeRepo().findById(COMPANY_ID, 'flyer-1');
      expect(result).toEqual(mockFlyer);
      expect(mockPrisma.flyer.findFirst).toHaveBeenCalledWith({ where: { id: 'flyer-1', companyId: COMPANY_ID } });
    });
  });

  describe('slugExists', () => {
    it('returns true when a flyer with that slug exists in the company', async () => {
      mockPrisma.flyer.findFirst.mockResolvedValue({ id: 'flyer-1' });
      expect(await makeRepo().slugExists(COMPANY_ID, 'weekly-offers')).toBe(true);
    });

    it('returns false when no flyer matches', async () => {
      mockPrisma.flyer.findFirst.mockResolvedValue(null);
      expect(await makeRepo().slugExists(COMPANY_ID, 'missing')).toBe(false);
    });
  });

  describe('create', () => {
    it('connects the company and sets createdBy', async () => {
      mockPrisma.flyer.create.mockResolvedValue(mockFlyer);
      await makeRepo().create(COMPANY_ID, 'user-1', { title: 'Weekly Offers', slug: 'weekly-offers' });
      expect(mockPrisma.flyer.create).toHaveBeenCalledWith({
        data: {
          title: 'Weekly Offers',
          slug: 'weekly-offers',
          createdBy: 'user-1',
          company: { connect: { id: COMPANY_ID } },
        },
      });
    });
  });

  describe('update', () => {
    it('scopes the update to the company and returns the fresh record', async () => {
      mockPrisma.flyer.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.flyer.findFirst.mockResolvedValue({ ...mockFlyer, title: 'Updated' });

      const result = await makeRepo().update(COMPANY_ID, 'flyer-1', { title: 'Updated' });

      expect(mockPrisma.flyer.updateMany).toHaveBeenCalledWith({
        where: { id: 'flyer-1', companyId: COMPANY_ID },
        data: { title: 'Updated' },
      });
      expect(result?.title).toBe('Updated');
    });

    it('returns null when no row matches the company scope', async () => {
      mockPrisma.flyer.updateMany.mockResolvedValue({ count: 0 });
      const result = await makeRepo().update(COMPANY_ID, 'flyer-1', { title: 'Updated' });
      expect(result).toBeNull();
      expect(mockPrisma.flyer.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted within scope', async () => {
      mockPrisma.flyer.deleteMany.mockResolvedValue({ count: 1 });
      expect(await makeRepo().delete(COMPANY_ID, 'flyer-1')).toBe(true);
      expect(mockPrisma.flyer.deleteMany).toHaveBeenCalledWith({ where: { id: 'flyer-1', companyId: COMPANY_ID } });
    });

    it('returns false when nothing matched the company scope', async () => {
      mockPrisma.flyer.deleteMany.mockResolvedValue({ count: 0 });
      expect(await makeRepo().delete(COMPANY_ID, 'flyer-1')).toBe(false);
    });
  });
});
