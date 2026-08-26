/**
 * Tenant isolation tests for the Marketing Director.
 *
 * These tests verify that a user from Company A cannot access
 * Company B's conversations, campaigns, goals, knowledge, or agent executions.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketingAgentService } from '../marketing-agent.service';
import { CompanyRepository } from '../../company/company.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MarketingDirectorAgent } from '../marketing-director.agent';
import { MemoryService } from '../../agent-engine/memory/memory.service';
import { BudgetGuardService } from '../../agent-engine/budget/budget-guard.service';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '@prisma/client';

const COMPANY_A = 'aaa-aaa-aaa';
const COMPANY_B = 'bbb-bbb-bbb';
const USER_IN_A = 'user-in-a';

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
} as unknown as jest.Mocked<MarketingDirectorAgent>;

const mockMemory = {
  getCompanyKnowledge: jest.fn(),
} as unknown as jest.Mocked<MemoryService>;

const mockConfig = {
  get: jest.fn((_: string, def: unknown) => def),
} as unknown as jest.Mocked<ConfigService>;

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
} as unknown as jest.Mocked<AuditService>;

const mockPrisma = {
  agentExecution: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { estimatedCostUsd: 0 } }),
  },
};

const mockBudgetGuard = {
  assertWithinBudget: jest.fn().mockResolvedValue(undefined),
} as unknown as jest.Mocked<BudgetGuardService>;

function makeService(): MarketingAgentService {
  return new MarketingAgentService(
    mockCompanyRepo,
    mockConvRepo,
    mockMemory,
    mockAgent,
    mockConfig,
    mockAuditService,
    mockPrisma as never,
    mockBudgetGuard,
  );
}

describe('Marketing Director — Tenant Isolation', () => {
  let service: MarketingAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
    mockMemory.getCompanyKnowledge.mockResolvedValue([]);
    mockCompanyRepo.findById.mockResolvedValue({ id: COMPANY_B, name: 'Other Co' } as never);
  });

  it('user from Company A cannot run agent against Company B', async () => {
    // User A is NOT a member of Company B
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.run({
        companyId: COMPANY_B,
        userId: USER_IN_A,
        message: 'Give me Company B strategy',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAgent.execute).not.toHaveBeenCalled();
    expect(mockConvRepo.create).not.toHaveBeenCalled();
    expect(mockMemory.getCompanyKnowledge).not.toHaveBeenCalled();
  });

  it('user from Company A cannot continue a Company B conversation', async () => {
    // User A is NOT a member of Company B
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.run({
        companyId: COMPANY_B,
        userId: USER_IN_A,
        conversationId: 'conv-b-123',
        message: 'Continue Company B chat',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockConvRepo.findById).not.toHaveBeenCalled();
  });

  it('user from Company A cannot list Company B conversations', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(service.listConversations(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockConvRepo.listByCompany).not.toHaveBeenCalled();
  });

  it('conversation lookup is tenant-scoped (companyId + conversationId)', async () => {
    // User A IS a member of Company A
    mockCompanyRepo.findMemberInCompany.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: true,
      role: 'MEMBER',
    } as never);

    // Company A's conversation repo returns null for a Company B conversation ID
    // (because findById filters by companyId)
    mockConvRepo.findById.mockResolvedValue(null);

    await expect(
      service.run({
        companyId: COMPANY_A,
        userId: USER_IN_A,
        conversationId: 'conv-from-company-b',
        message: 'Access cross-company conv',
      }),
    ).rejects.toThrow(NotFoundException);

    // Confirm findById was called with Company A's companyId, not Company B
    expect(mockConvRepo.findById).toHaveBeenCalledWith(COMPANY_A, 'conv-from-company-b');
    expect(mockAgent.execute).not.toHaveBeenCalled();
  });

  it('agent receives only Company A context, never Company B context', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: true,
      role: 'MEMBER',
    } as never);
    mockConvRepo.create.mockResolvedValue({ id: 'conv-a', agentType: AgentType.DIRECTOR } as never);
    mockConvRepo.getHistory.mockResolvedValue([]);
    mockConvRepo.addMessage.mockResolvedValue({} as never);
    mockConvRepo.incrementCost.mockResolvedValue(undefined);
    mockCompanyRepo.findById.mockResolvedValue({ id: COMPANY_A, name: 'Acme' } as never);
    mockMemory.getCompanyKnowledge.mockResolvedValue([]);
    mockAgent.execute.mockResolvedValue({
      response: 'ok',
      traceResult: {
        traceId: 't',
        agentExecutionId: 'e',
        estimatedCostUsd: 0,
        totalLatencyMs: 100,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        iterations: 1,
        toolCalls: [],
        finalStatus: 'COMPLETED',
      },
    });

    await service.run({
      companyId: COMPANY_A,
      userId: USER_IN_A,
      message: 'What should we do?',
    });

    // Agent.execute is called with COMPANY_A's companyId
    const callCtx = mockAgent.execute.mock.calls[0][0];
    expect(callCtx.companyId).toBe(COMPANY_A);
    expect(callCtx.companyId).not.toBe(COMPANY_B);

    // Company knowledge was loaded for COMPANY_A only
    expect(mockMemory.getCompanyKnowledge).toHaveBeenCalledWith(COMPANY_A);
    expect(mockMemory.getCompanyKnowledge).not.toHaveBeenCalledWith(COMPANY_B);
  });

  it('inactive user from Company A is also blocked', async () => {
    mockCompanyRepo.findMemberInCompany.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: false, // inactive
      role: 'MEMBER',
    } as never);

    await expect(
      service.run({ companyId: COMPANY_A, userId: USER_IN_A, message: 'Hello' }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockAgent.execute).not.toHaveBeenCalled();
  });
});
