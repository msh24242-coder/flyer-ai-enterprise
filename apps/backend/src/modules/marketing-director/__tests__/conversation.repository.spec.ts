import { ConversationRepository } from '../repositories/conversation.repository';
import { PrismaService } from '../../../database/prisma.service';
import { AgentType, ConversationStatus } from '@prisma/client';

const makeConversation = (id: string, companyId = 'co-1') => ({
  id,
  companyId,
  userId: 'user-1',
  agentType: AgentType.DIRECTOR,
  title: null,
  status: ConversationStatus.ACTIVE,
  totalCostUsd: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeMessage = (id: string, conversationId: string, role: 'user' | 'assistant') => ({
  id,
  conversationId,
  role,
  content: [{ type: 'text', text: `${role} message` }],
  tokenCount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockPrisma = {
  conversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaService;

describe('ConversationRepository', () => {
  let repo: ConversationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ConversationRepository(mockPrisma);
  });

  describe('findById', () => {
    it('finds conversation by id scoped to company', async () => {
      const conv = makeConversation('conv-1');
      (mockPrisma.conversation.findFirst as jest.Mock).mockResolvedValue(conv);

      const result = await repo.findById('co-1', 'conv-1');

      expect(result).toEqual(conv);
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'co-1' },
      });
    });

    it('returns null when not found', async () => {
      (mockPrisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.findById('co-1', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates conversation with correct fields', async () => {
      const conv = makeConversation('conv-new');
      (mockPrisma.conversation.create as jest.Mock).mockResolvedValue(conv);

      const result = await repo.create('co-1', 'user-1', AgentType.DIRECTOR, 'My Chat');

      expect(result).toEqual(conv);
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { companyId: 'co-1', userId: 'user-1', agentType: AgentType.DIRECTOR, title: 'My Chat' },
      });
    });
  });

  describe('getHistory', () => {
    it('returns messages mapped to canonical format', async () => {
      const messages = [
        makeMessage('m-1', 'conv-1', 'user'),
        makeMessage('m-2', 'conv-1', 'assistant'),
      ];
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue(messages);

      const result = await repo.getHistory('conv-1', 20);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ role: 'user', content: [{ type: 'text', text: 'user message' }] });
      expect(result[1]).toMatchObject({ role: 'assistant', content: [{ type: 'text', text: 'assistant message' }] });
    });

    it('orders messages ascending by createdAt', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue([]);

      await repo.getHistory('conv-1', 10);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });
  });

  describe('addMessage', () => {
    it('creates message with content block format', async () => {
      const msg = makeMessage('m-new', 'conv-1', 'user');
      (mockPrisma.message.create as jest.Mock).mockResolvedValue(msg);

      await repo.addMessage('conv-1', 'user', 'Hello');

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
          tokenCount: undefined,
        },
      });
    });
  });

  describe('incrementCost', () => {
    it('increments totalCostUsd', async () => {
      (mockPrisma.conversation.update as jest.Mock).mockResolvedValue({});

      await repo.incrementCost('conv-1', 0.05);

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { totalCostUsd: { increment: 0.05 } },
      });
    });
  });

  describe('listByCompany', () => {
    it('lists active conversations for company', async () => {
      const convs = [makeConversation('c-1'), makeConversation('c-2')];
      (mockPrisma.conversation.findMany as jest.Mock).mockResolvedValue(convs);

      const result = await repo.listByCompany('co-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'co-1', status: ConversationStatus.ACTIVE },
        }),
      );
    });

    it('filters by userId when provided', async () => {
      (mockPrisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

      await repo.listByCompany('co-1', 'user-42');

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'co-1', userId: 'user-42', status: ConversationStatus.ACTIVE },
        }),
      );
    });
  });

  describe('rename', () => {
    it('updates the conversation title scoped to company', async () => {
      const conv = makeConversation('conv-1');
      (mockPrisma.conversation.update as jest.Mock).mockResolvedValue({ ...conv, title: 'New Title' });

      const result = await repo.rename('co-1', 'conv-1', 'New Title');

      expect(result.title).toBe('New Title');
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'co-1' },
        data: { title: 'New Title' },
      });
    });
  });

  describe('archive', () => {
    it('sets status to ARCHIVED', async () => {
      const conv = makeConversation('conv-1');
      (mockPrisma.conversation.update as jest.Mock).mockResolvedValue({
        ...conv,
        status: ConversationStatus.ARCHIVED,
      });

      const result = await repo.archive('co-1', 'conv-1');

      expect(result.status).toBe(ConversationStatus.ARCHIVED);
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'co-1' },
        data: { status: ConversationStatus.ARCHIVED },
      });
    });
  });

  describe('delete', () => {
    it('deletes conversation scoped to company', async () => {
      (mockPrisma.conversation.delete as jest.Mock).mockResolvedValue({});

      await repo.delete('co-1', 'conv-1');

      expect(mockPrisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'co-1' },
      });
    });
  });

  describe('updateTitle', () => {
    it('updates title only when currently null (no overwrite)', async () => {
      (mockPrisma.conversation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await repo.updateTitle('co-1', 'conv-1', 'Auto Title');

      expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'co-1', title: null },
        data: { title: 'Auto Title' },
      });
    });
  });
});
