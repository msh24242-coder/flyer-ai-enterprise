import { ContentRepository, CreateGeneratedContentDto } from '../content.repository';
import { AgentType } from '@prisma/client';

const mockPrisma = {
  generatedContent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

function makeRepo() {
  return new ContentRepository(mockPrisma as never);
}

const baseContent = {
  id: 'cnt-1',
  companyId: 'co-1',
  agentType: AgentType.CONTENT,
  contentType: 'social_post',
  title: 'My Post',
  content: 'Hello world',
  metadata: {},
  campaignId: null,
  agentExecutionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ContentRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('returns all content for a company', async () => {
      mockPrisma.generatedContent.findMany.mockResolvedValue([baseContent]);

      const result = await makeRepo().list('co-1');

      expect(result).toEqual([baseContent]);
      expect(mockPrisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      );
    });

    it('filters by contentType when provided', async () => {
      mockPrisma.generatedContent.findMany.mockResolvedValue([]);

      await makeRepo().list('co-1', 'blog_post');

      expect(mockPrisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', contentType: 'blog_post' } }),
      );
    });

    it('filters by agentType when provided', async () => {
      mockPrisma.generatedContent.findMany.mockResolvedValue([]);

      await makeRepo().list('co-1', undefined, AgentType.CREATIVE);

      expect(mockPrisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', agentType: AgentType.CREATIVE } }),
      );
    });

    it('applies take limit of 100', async () => {
      mockPrisma.generatedContent.findMany.mockResolvedValue([]);

      await makeRepo().list('co-1');

      expect(mockPrisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('tenant isolation — only queries for the given companyId', async () => {
      mockPrisma.generatedContent.findMany.mockResolvedValue([]);

      await makeRepo().list('co-attacker');

      const call = mockPrisma.generatedContent.findMany.mock.calls[0][0] as { where: { companyId: string } };
      expect(call.where.companyId).toBe('co-attacker');
    });
  });

  describe('findOne', () => {
    it('returns the content item when found', async () => {
      mockPrisma.generatedContent.findFirst.mockResolvedValue(baseContent);

      const result = await makeRepo().findOne('co-1', 'cnt-1');

      expect(result).toEqual(baseContent);
      expect(mockPrisma.generatedContent.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'co-1', id: 'cnt-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.generatedContent.findFirst.mockResolvedValue(null);

      const result = await makeRepo().findOne('co-1', 'missing');

      expect(result).toBeNull();
    });

    it('enforces tenant isolation via companyId in where clause', async () => {
      mockPrisma.generatedContent.findFirst.mockResolvedValue(null);

      await makeRepo().findOne('co-attacker', 'cnt-1');

      expect(mockPrisma.generatedContent.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'co-attacker', id: 'cnt-1' },
      });
    });
  });

  describe('create', () => {
    it('creates content with all required fields', async () => {
      const dto: CreateGeneratedContentDto = {
        agentType: AgentType.CONTENT,
        contentType: 'blog_post',
        title: 'New Blog',
        content: 'Full body text here',
      };
      mockPrisma.generatedContent.create.mockResolvedValue({ id: 'cnt-new', ...dto, companyId: 'co-1' });

      const result = await makeRepo().create('co-1', dto);

      expect(result).toEqual(expect.objectContaining({ id: 'cnt-new', companyId: 'co-1' }));
      expect(mockPrisma.generatedContent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          agentType: AgentType.CONTENT,
          contentType: 'blog_post',
          title: 'New Blog',
          content: 'Full body text here',
        }),
      });
    });

    it('creates content with optional campaign and execution ids', async () => {
      const dto: CreateGeneratedContentDto = {
        agentType: AgentType.CREATIVE,
        contentType: 'ad_copy',
        content: 'Buy now!',
        campaignId: 'camp-1',
        agentExecutionId: 'exec-1',
      };
      mockPrisma.generatedContent.create.mockResolvedValue({ id: 'cnt-2', ...dto, companyId: 'co-1' });

      await makeRepo().create('co-1', dto);

      expect(mockPrisma.generatedContent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campaignId: 'camp-1',
          agentExecutionId: 'exec-1',
        }),
      });
    });
  });

  describe('delete', () => {
    it('returns true when content is deleted', async () => {
      mockPrisma.generatedContent.deleteMany.mockResolvedValue({ count: 1 });

      const result = await makeRepo().delete('co-1', 'cnt-1');

      expect(result).toBe(true);
      expect(mockPrisma.generatedContent.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'co-1', id: 'cnt-1' },
      });
    });

    it('returns false when content not found', async () => {
      mockPrisma.generatedContent.deleteMany.mockResolvedValue({ count: 0 });

      const result = await makeRepo().delete('co-1', 'missing');

      expect(result).toBe(false);
    });

    it('enforces tenant isolation — cannot delete another company content', async () => {
      mockPrisma.generatedContent.deleteMany.mockResolvedValue({ count: 0 });

      const result = await makeRepo().delete('co-attacker', 'cnt-1');

      expect(result).toBe(false);
      expect(mockPrisma.generatedContent.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'co-attacker', id: 'cnt-1' },
      });
    });
  });
});
