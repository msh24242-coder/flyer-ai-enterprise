import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketingAgentService } from '../marketing-agent.service';
import { CompanyRepository } from '../../company/company.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MarketingDirectorAgent } from '../marketing-director.agent';
import { MemoryService } from '../../agent-engine/memory/memory.service';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '@prisma/client';

const COMPANY_A = 'company-aaa';
const COMPANY_B = 'company-bbb';
const USER_A = 'user-a';

const makeActiveMember = (companyId: string, userId: string) => ({
  id: userId,
  companyId,
  isActive: true,
  role: 'MEMBER',
});

const mockCompanyRepo = {
  findMemberInCompany: jest.fn(),
  findById: jest.fn(),
} as unknown as jest.Mocked<CompanyRepository>;

const mockConvRepo = {
  findById: jest.fn(),
  create: jest.fn(),
  getHistory: jest.fn(),
  addMessage: jest.fn(),
  incrementCost: jest.fn(),
  listByCompany: jest.fn(),
  updateTitle: jest.fn(),
  rename: jest.fn(),
  archive: jest.fn(),
  delete: jest.fn(),
} as unknown as jest.Mocked<ConversationRepository>;

const mockAgent = {
  execute: jest.fn(),
  executeStream: jest.fn(),
} as unknown as jest.Mocked<MarketingDirectorAgent>;

const mockMemory = {
  getCompanyKnowledge: jest.fn(),
} as unknown as jest.Mocked<MemoryService>;

const mockConfig = {
  get: jest.fn((key: string, def: unknown) => def),
} as unknown as jest.Mocked<ConfigService>;

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
} as unknown as jest.Mocked<AuditService>;

const mockPrisma = {
  agentExecution: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { estimatedCostUsd: 0 } }),
  },
};

function makeService(): MarketingAgentService {
  return new MarketingAgentService(
    mockCompanyRepo,
    mockConvRepo,
    mockMemory,
    mockAgent,
    mockConfig,
    mockAuditService,
    mockPrisma as never,
  );
}

const defaultAgentResult = {
  response: 'Here is my recommendation.',
  traceResult: {
    traceId: 'trace-1',
    agentExecutionId: 'exec-1',
    estimatedCostUsd: 0.002,
    totalLatencyMs: 800,
    totalInputTokens: 300,
    totalOutputTokens: 120,
    iterations: 1,
    toolCalls: [],
    finalStatus: 'COMPLETED' as const,
  },
};

describe('MarketingAgentService', () => {
  let service: MarketingAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();

    mockMemory.getCompanyKnowledge.mockResolvedValue([]);
    mockCompanyRepo.findById.mockResolvedValue({ id: COMPANY_A, name: 'Acme' } as never);
    mockConvRepo.getHistory.mockResolvedValue([]);
    mockConvRepo.addMessage.mockResolvedValue({} as never);
    mockConvRepo.incrementCost.mockResolvedValue(undefined);
    mockAgent.execute.mockResolvedValue(defaultAgentResult);
    mockAgent.executeStream.mockResolvedValue(defaultAgentResult);
  });

  // ── Authentication & Membership ────────────────────────────────────────────

  it('throws ForbiddenException when user is not a member of the company', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAgent.execute).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for inactive member', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue({
      ...makeActiveMember(COMPANY_A, USER_A),
      isActive: false,
    } as never);

    await expect(
      service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Cross-company tenant isolation ────────────────────────────────────────

  it('blocks user A from accessing company B', async () => {
    // User A is not a member of Company B
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.run({ companyId: COMPANY_B, userId: USER_A, message: 'Give me Company B data' }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAgent.execute).not.toHaveBeenCalled();
    expect(mockConvRepo.create).not.toHaveBeenCalled();
  });

  it('blocks company B user from listing company A conversations', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(service.listConversations(COMPANY_A, 'user-b')).rejects.toThrow(ForbiddenException);
    expect(mockConvRepo.listByCompany).not.toHaveBeenCalled();
  });

  // ── Conversation management ───────────────────────────────────────────────

  describe('listConversations', () => {
    it('returns conversations for an active member', async () => {
      const convs = [{ id: 'conv-1', title: 'Q4 Planning', status: 'ACTIVE' }];
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.listByCompany.mockResolvedValue(convs as never);

      const result = await service.listConversations(COMPANY_A, USER_A);

      expect(result).toEqual(convs);
      expect(mockConvRepo.listByCompany).toHaveBeenCalledWith(COMPANY_A, USER_A);
    });
  });

  describe('renameConversation', () => {
    it('renames a conversation the user owns', async () => {
      const updated = { id: 'conv-1', title: 'New Title' };
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue({ id: 'conv-1', companyId: COMPANY_A, userId: USER_A } as never);
      mockConvRepo.rename.mockResolvedValue(updated as never);

      const result = await service.renameConversation(COMPANY_A, 'conv-1', USER_A, 'New Title');

      expect(result).toEqual(updated);
      expect(mockConvRepo.rename).toHaveBeenCalledWith(COMPANY_A, 'conv-1', 'New Title');
    });

    it('throws ForbiddenException when user does not own the conversation', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue({ id: 'conv-1', companyId: COMPANY_A, userId: 'other-user' } as never);

      await expect(
        service.renameConversation(COMPANY_A, 'conv-1', USER_A, 'Stolen Title'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archiveConversation', () => {
    it('archives a conversation the user owns', async () => {
      const archived = { id: 'conv-1', status: 'ARCHIVED' };
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue({ id: 'conv-1', companyId: COMPANY_A, userId: USER_A } as never);
      mockConvRepo.archive.mockResolvedValue(archived as never);

      const result = await service.archiveConversation(COMPANY_A, 'conv-1', USER_A);

      expect(result).toEqual(archived);
      expect(mockConvRepo.archive).toHaveBeenCalledWith(COMPANY_A, 'conv-1');
    });
  });

  describe('deleteConversation', () => {
    it('deletes a conversation the user owns', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue({ id: 'conv-1', companyId: COMPANY_A, userId: USER_A } as never);
      mockConvRepo.delete.mockResolvedValue(undefined);

      await expect(service.deleteConversation(COMPANY_A, 'conv-1', USER_A)).resolves.toBeUndefined();
      expect(mockConvRepo.delete).toHaveBeenCalledWith(COMPANY_A, 'conv-1');
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue(null);

      await expect(
        service.deleteConversation(COMPANY_A, 'no-such-conv', USER_A),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Conversation creation ─────────────────────────────────────────────────

  it('creates a new conversation when none provided', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-new', agentType: AgentType.DIRECTOR } as never);

    const result = await service.run({
      companyId: COMPANY_A,
      userId: USER_A,
      message: 'Start a new conversation',
    });

    expect(mockConvRepo.create).toHaveBeenCalledWith(
      COMPANY_A,
      USER_A,
      AgentType.DIRECTOR,
      expect.any(String),
    );
    expect(result.conversationId).toBe('conv-new');
  });

  it('uses existing conversation when conversationId provided', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.findById.mockResolvedValue({ id: 'conv-123', companyId: COMPANY_A } as never);

    await service.run({
      companyId: COMPANY_A,
      userId: USER_A,
      conversationId: 'conv-123',
      message: 'Continue the conversation',
    });

    expect(mockConvRepo.findById).toHaveBeenCalledWith(COMPANY_A, 'conv-123');
    expect(mockConvRepo.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for invalid conversationId', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.findById.mockResolvedValue(null);

    await expect(
      service.run({
        companyId: COMPANY_A,
        userId: USER_A,
        conversationId: 'nonexistent-conv',
        message: 'Hello',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Message persistence ───────────────────────────────────────────────────

  it('persists user and assistant messages after execution', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-1' } as never);

    await service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Analyze our goals' });

    // User message persisted before execution
    expect(mockConvRepo.addMessage).toHaveBeenCalledWith('conv-1', 'user', 'Analyze our goals');
    // Assistant message persisted after execution
    expect(mockConvRepo.addMessage).toHaveBeenCalledWith(
      'conv-1',
      'assistant',
      'Here is my recommendation.',
      120,
    );
  });

  it('increments conversation cost after execution', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-1' } as never);

    await service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' });

    expect(mockConvRepo.incrementCost).toHaveBeenCalledWith('conv-1', 0.002);
  });

  // ── Company context loading ───────────────────────────────────────────────

  it('loads company knowledge and passes as additionalContext', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-1' } as never);
    mockMemory.getCompanyKnowledge.mockResolvedValue([
      { id: 'k1', category: 'brand', key: 'voice', value: { tone: 'formal' } },
    ] as never);

    await service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' });

    const callArgs = mockAgent.execute.mock.calls[0][0];
    expect(callArgs.additionalContext?.company).toMatchObject({
      id: COMPANY_A,
      knowledge: expect.arrayContaining([
        expect.objectContaining({ category: 'brand', key: 'voice' }),
      ]),
    });
  });

  // ── Budget enforcement ────────────────────────────────────────────────────

  it('throws BadRequestException when monthly budget is exceeded', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockCompanyRepo.findById.mockResolvedValue({ id: COMPANY_A, name: 'Acme', aiConfig: { monthlyBudgetUsd: 10 } } as never);
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 10.5 } });

    await expect(
      service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockAgent.execute).not.toHaveBeenCalled();
  });

  it('proceeds when spend is below budget', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockCompanyRepo.findById.mockResolvedValue({ id: COMPANY_A, name: 'Acme', aiConfig: { monthlyBudgetUsd: 100 } } as never);
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 5 } });
    mockConvRepo.create.mockResolvedValue({ id: 'conv-1' } as never);

    await service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' });

    expect(mockAgent.execute).toHaveBeenCalled();
  });

  // ── Output ────────────────────────────────────────────────────────────────

  it('returns full result including traceId and cost', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-1' } as never);

    const result = await service.run({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' });

    expect(result).toMatchObject({
      conversationId: 'conv-1',
      response: 'Here is my recommendation.',
      traceId: 'trace-1',
      agentExecutionId: 'exec-1',
      estimatedCostUsd: 0.002,
      iterations: 1,
    });
  });

  // ── runStream ─────────────────────────────────────────────────────────────

  describe('runStream', () => {
    it('throws ForbiddenException when user is not a member', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);
      const onEvent = jest.fn();

      await expect(
        service.runStream({ companyId: COMPANY_A, userId: USER_A, message: 'Hello' }, onEvent),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAgent.executeStream).not.toHaveBeenCalled();
    });

    it('creates a conversation and delegates to agent.executeStream', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.create.mockResolvedValue({ id: 'conv-stream-1' } as never);
      const onEvent = jest.fn();

      const result = await service.runStream(
        { companyId: COMPANY_A, userId: USER_A, message: 'Stream me a plan' },
        onEvent,
      );

      expect(mockAgent.executeStream).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_A, userMessage: 'Stream me a plan' }),
        onEvent,
      );
      expect(result.conversationId).toBe('conv-stream-1');
    });

    it('passes onEvent callback to agent.executeStream', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.create.mockResolvedValue({ id: 'conv-stream-2' } as never);

      const events: unknown[] = [];
      const onEvent = (e: unknown) => events.push(e);

      // Simulate the agent emitting events through the callback
      mockAgent.executeStream.mockImplementation(async (_ctx, cb) => {
        cb({ type: 'agent_start', agentType: 'DIRECTOR' });
        cb({ type: 'token', delta: 'Hello' });
        cb({ type: 'token', delta: ' world' });
        return defaultAgentResult;
      });

      await service.runStream({ companyId: COMPANY_A, userId: USER_A, message: 'Stream' }, onEvent);

      expect(events).toEqual([
        { type: 'agent_start', agentType: 'DIRECTOR' },
        { type: 'token', delta: 'Hello' },
        { type: 'token', delta: ' world' },
      ]);
    });

    it('persists user and assistant messages after streaming completes', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.create.mockResolvedValue({ id: 'conv-stream-3' } as never);

      await service.runStream(
        { companyId: COMPANY_A, userId: USER_A, message: 'Stream message' },
        jest.fn(),
      );

      expect(mockConvRepo.addMessage).toHaveBeenCalledWith('conv-stream-3', 'user', 'Stream message');
      expect(mockConvRepo.addMessage).toHaveBeenCalledWith(
        'conv-stream-3',
        'assistant',
        'Here is my recommendation.',
        120,
      );
    });

    it('uses existing conversationId when provided', async () => {
      mockCompanyRepo.findMemberInCompany.mockResolvedValue(makeActiveMember(COMPANY_A, USER_A) as never);
      mockConvRepo.findById.mockResolvedValue({ id: 'conv-existing' } as never);

      await service.runStream(
        { companyId: COMPANY_A, userId: USER_A, conversationId: 'conv-existing', message: 'Continue' },
        jest.fn(),
      );

      expect(mockConvRepo.findById).toHaveBeenCalledWith(COMPANY_A, 'conv-existing');
      expect(mockConvRepo.create).not.toHaveBeenCalled();
    });
  });
});
