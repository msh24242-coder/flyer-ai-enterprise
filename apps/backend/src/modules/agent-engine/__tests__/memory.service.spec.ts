import { MemoryService } from '../memory/memory.service';
import { MemoryType } from '@prisma/client';

const mockPrisma = {
  companyKnowledge: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockEmbeddingProvider = {
  name: 'voyage',
  dimensions: 1024,
  embed: jest.fn(),
};

const mockMemoryWriteQueue = {
  add: jest.fn(),
};

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemoryService(
      mockPrisma as never,
      mockEmbeddingProvider as never,
      mockMemoryWriteQueue as never,
    );
  });

  describe('getCompanyKnowledge', () => {
    it('returns company knowledge records', async () => {
      const mockData = [
        { id: '1', key: 'brand_voice', value: 'Professional', category: 'branding' },
      ];
      mockPrisma.companyKnowledge.findMany.mockResolvedValue(mockData);

      const result = await service.getCompanyKnowledge('company-1');

      expect(result).toEqual(mockData);
      expect(mockPrisma.companyKnowledge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-1' } }),
      );
    });
  });

  describe('enqueueMemoryWrite', () => {
    it('enqueues a memory write job with retry config', async () => {
      mockMemoryWriteQueue.add.mockResolvedValue({ id: 'job-1' });

      await service.enqueueMemoryWrite({
        companyId: 'company-1',
        agentType: 'DIRECTOR',
        memoryType: MemoryType.LESSON,
        content: 'User prefers formal tone',
      });

      expect(mockMemoryWriteQueue.add).toHaveBeenCalledWith(
        'write-memory',
        expect.objectContaining({
          companyId: 'company-1',
          memoryType: MemoryType.LESSON,
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('embedAndSearch', () => {
    it('embeds query and calls searchSemanticMemory', async () => {
      const mockEmbedding = new Array(1024).fill(0.1);
      mockEmbeddingProvider.embed.mockResolvedValue({
        embeddings: [mockEmbedding],
        model: 'voyage-3-lite',
        usage: { totalTokens: 10 },
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'mem-1',
          content: 'Campaign insight',
          memory_type: MemoryType.CAMPAIGN_INSIGHT,
          metadata: {},
          created_at: new Date(),
          similarity: 0.9,
        },
      ]);

      const results = await service.embedAndSearch('marketing strategy', {
        companyId: 'company-1',
        memoryTypes: [MemoryType.CAMPAIGN_INSIGHT],
      });

      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith({
        texts: ['marketing strategy'],
      });
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Campaign insight');
      expect(results[0].similarity).toBe(0.9);
    });
  });
});
