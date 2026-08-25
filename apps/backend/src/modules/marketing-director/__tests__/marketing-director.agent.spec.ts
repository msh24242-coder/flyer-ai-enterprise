import { AgentType, PermissionLevel } from '@prisma/client';
import { MarketingDirectorAgent } from '../marketing-director.agent';
import { AgentExecutionContext } from '../../agent-engine/base/agent-engine.types';
import { IAIProvider, AIProviderResponse } from '../../agent-engine/providers/ai/ai-provider.interface';
import { IEmbeddingProvider } from '../../agent-engine/providers/embedding/embedding-provider.interface';
import { MemoryService } from '../../agent-engine/memory/memory.service';
import { ApprovalEngineService } from '../../agent-engine/approval/approval-engine.service';
import { ObservabilityTracerService } from '../../agent-engine/observability/observability-tracer.service';
import { AgentOrchestratorService } from '../../agent-engine/orchestration/agent-orchestrator.service';
import { ConfigService } from '@nestjs/config';
import { MarketingRepository } from '../repositories/marketing.repository';

const COMPANY_ID = 'company-abc';
const USER_ID = 'user-1';

const makeEndTurnResponse = (text: string): AIProviderResponse => ({
  stopReason: 'end_turn',
  usage: { inputTokens: 100, outputTokens: 50 },
  model: 'claude-opus-5',
  messages: [{ role: 'assistant', content: [{ type: 'text', text }] }],
});

const makeToolUseResponse = (
  toolName: string,
  toolInput: Record<string, unknown>,
): AIProviderResponse => ({
  stopReason: 'tool_use',
  usage: { inputTokens: 200, outputTokens: 100 },
  model: 'claude-opus-5',
  messages: [
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu-1', name: toolName, input: toolInput }],
    },
  ],
});

const makeContext = (overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext => ({
  companyId: COMPANY_ID,
  userId: USER_ID,
  conversationHistory: [],
  userMessage: 'What should we focus on this week?',
  model: 'claude-opus-5',
  additionalContext: {
    company: {
      id: COMPANY_ID,
      name: 'Acme Corp',
      industry: 'Tech',
      knowledge: [
        { category: 'brand', key: 'voice', value: { tone: 'professional' } },
      ],
    },
  },
  ...overrides,
});

const mockAI: jest.Mocked<IAIProvider> = {
  name: 'mock',
  complete: jest.fn(),
  stream: jest.fn(),
};

const mockEmbedding: jest.Mocked<IEmbeddingProvider> = {
  name: 'mock-embedding',
  embed: jest.fn(),
  dimensions: 1024,
};

const mockMemory = {
  getCompanyKnowledge: jest.fn(),
  searchSemanticMemory: jest.fn(),
  enqueueMemoryWrite: jest.fn(),
} as unknown as jest.Mocked<MemoryService>;

const mockApproval = {
  check: jest.fn(),
} as unknown as jest.Mocked<ApprovalEngineService>;

const mockTracer = {
  createTrace: jest.fn(),
  finalizeTrace: jest.fn(),
} as unknown as jest.Mocked<ObservabilityTracerService>;

const mockOrchestrator = {} as jest.Mocked<AgentOrchestratorService>;

const mockConfig = {
  get: jest.fn((key: string, def: unknown) => def),
  getOrThrow: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockMarketingRepo = {
  listGoals: jest.fn(),
  createGoal: jest.fn(),
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  listTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  findCampaign: jest.fn(),
  findTask: jest.fn(),
} as unknown as jest.Mocked<MarketingRepository>;

function makeAgent(): MarketingDirectorAgent {
  return new MarketingDirectorAgent(
    mockAI,
    mockEmbedding,
    mockMemory,
    mockApproval,
    mockTracer,
    mockOrchestrator,
    mockConfig,
    mockMarketingRepo,
  );
}

describe('MarketingDirectorAgent', () => {
  let agent: MarketingDirectorAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = makeAgent();

    // Default tracer behavior — reflects the status passed to it
    mockTracer.createTrace.mockReturnValue({
      traceId: 'trace-1',
      agentType: AgentType.DIRECTOR,
      companyId: COMPANY_ID,
      startedAt: new Date(),
      model: 'claude-opus-5',
    });
    mockTracer.finalizeTrace.mockImplementation(async (_ctx, data) => ({
      traceId: 'trace-1',
      agentExecutionId: 'exec-1',
      totalInputTokens: data.totalInputTokens,
      totalOutputTokens: data.totalOutputTokens,
      estimatedCostUsd: 0.001,
      totalLatencyMs: 500,
      iterations: data.iterations,
      toolCalls: data.toolCalls,
      finalStatus: data.finalStatus,
    }));

    // Default memory behavior
    mockMemory.getCompanyKnowledge.mockResolvedValue([]);
    mockMemory.enqueueMemoryWrite.mockResolvedValue(undefined);
    mockMemory.searchSemanticMemory.mockResolvedValue([]);
  });

  // ── Identity ─────────────────────────────────────────────────────────────

  it('returns DIRECTOR agent type', () => {
    const identity = agent.getIdentity();
    expect(identity.agentType).toBe(AgentType.DIRECTOR);
    expect(identity.displayName).toBe('Marketing Director');
  });

  // ── Tools ─────────────────────────────────────────────────────────────────

  it('defines exactly 10 tools', async () => {
    // set context so defineTools can run
    (agent as unknown as { ctx: AgentExecutionContext }).ctx = makeContext();
    const tools = agent.defineTools();
    expect(tools).toHaveLength(10);
  });

  it('read tools use PermissionLevel.READ', async () => {
    (agent as unknown as { ctx: AgentExecutionContext }).ctx = makeContext();
    const tools = agent.defineTools();
    const readTools = ['get_company_knowledge', 'list_marketing_goals', 'list_campaigns', 'search_memory'];
    for (const name of readTools) {
      const t = tools.find((t) => t.tool.name === name);
      expect(t?.permissionLevel).toBe(PermissionLevel.READ);
    }
  });

  it('write tools use PermissionLevel.WRITE', async () => {
    (agent as unknown as { ctx: AgentExecutionContext }).ctx = makeContext();
    const tools = agent.defineTools();
    const writeTools = [
      'create_marketing_goal',
      'create_campaign',
      'update_campaign',
      'create_task',
      'update_task',
      'store_insight',
    ];
    for (const name of writeTools) {
      const t = tools.find((t) => t.tool.name === name);
      expect(t?.permissionLevel).toBe(PermissionLevel.WRITE);
    }
  });

  // ── System prompt ─────────────────────────────────────────────────────────

  it('builds system prompt that includes company name', async () => {
    const ctx = makeContext();
    const prompt = await agent.buildSystemPrompt(ctx);
    expect(prompt).toContain('Acme Corp');
  });

  it('includes knowledge categories in system prompt', async () => {
    const ctx = makeContext();
    const prompt = await agent.buildSystemPrompt(ctx);
    expect(prompt).toContain('Brand');
    expect(prompt).toContain('voice');
  });

  // ── Simple execution ──────────────────────────────────────────────────────

  it('returns agent response on end_turn', async () => {
    mockAI.complete.mockResolvedValue(makeEndTurnResponse('Here is my recommendation.'));
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    const result = await agent.execute(makeContext());
    expect(result.response).toBe('Here is my recommendation.');
    expect(result.traceResult.finalStatus).toBe('COMPLETED');
  });

  // ── Tool call flow ────────────────────────────────────────────────────────

  it('executes get_company_knowledge tool and returns result', async () => {
    mockMemory.getCompanyKnowledge.mockResolvedValue([
      { id: 'k1', category: 'brand', key: 'voice', value: { tone: 'formal' } },
    ] as never);

    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    // First call returns tool_use, second call returns end_turn
    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('get_company_knowledge', { category: 'brand' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('Brand knowledge retrieved.'));

    const result = await agent.execute(makeContext());
    expect(result.response).toBe('Brand knowledge retrieved.');
    expect(mockMemory.getCompanyKnowledge).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('executes create_marketing_goal tool', async () => {
    const mockGoal = { id: 'g1', title: 'Q3 Lead Gen', status: 'DRAFT', createdAt: new Date() };
    mockMarketingRepo.createGoal.mockResolvedValue(mockGoal as never);
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('create_marketing_goal', { title: 'Q3 Lead Gen', description: 'Grow leads by 30%' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('Goal created.'));

    const result = await agent.execute(makeContext());
    expect(result.response).toBe('Goal created.');
    expect(mockMarketingRepo.createGoal).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ title: 'Q3 Lead Gen' }),
    );
  });

  // ── Tenant isolation ──────────────────────────────────────────────────────

  it('tool handlers always use context companyId, not tool input', async () => {
    mockMemory.getCompanyKnowledge.mockResolvedValue([]);
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    // Even if input contains a different companyId-like field, the handler uses context
    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('get_company_knowledge', { category: 'brand', companyId: 'evil-company' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('OK'));

    await agent.execute(makeContext());
    // getCompanyKnowledge is called with the CONTEXT companyId, not 'evil-company'
    expect(mockMemory.getCompanyKnowledge).toHaveBeenCalledWith(COMPANY_ID);
    expect(mockMemory.getCompanyKnowledge).not.toHaveBeenCalledWith('evil-company');
  });

  it('list_marketing_goals uses context companyId not input', async () => {
    mockMarketingRepo.listGoals.mockResolvedValue([]);
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('list_marketing_goals', { companyId: 'other-company' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('No goals'));

    await agent.execute(makeContext());
    expect(mockMarketingRepo.listGoals).toHaveBeenCalledWith(COMPANY_ID, undefined);
    expect(mockMarketingRepo.listGoals).not.toHaveBeenCalledWith('other-company', expect.anything());
  });

  // ── Approval enforcement ─────────────────────────────────────────────────

  it('returns PENDING_APPROVAL when approval engine blocks a tool', async () => {
    mockApproval.check.mockResolvedValue({
      outcome: 'PENDING',
      approvalRequestId: 'approval-1',
      reason: 'Approval required',
    });

    mockAI.complete.mockResolvedValueOnce(
      makeToolUseResponse('create_campaign', { title: 'Big Campaign' }),
    );

    const result = await agent.execute(makeContext());
    expect(result.traceResult.finalStatus).toBe('PENDING_APPROVAL');
    expect(result.pendingApprovalId).toBe('approval-1');
  });

  it('continues loop with error result when tool is DENIED', async () => {
    mockApproval.check.mockResolvedValue({ outcome: 'DENIED', reason: 'Insufficient permissions' });

    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('create_campaign', { title: 'X' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('Permission denied, cannot help.'));

    const result = await agent.execute(makeContext());
    expect(result.response).toBe('Permission denied, cannot help.');
    expect(result.traceResult.finalStatus).toBe('COMPLETED');
  });

  // ── Iteration limit ───────────────────────────────────────────────────────

  it('stops at MAX_AGENT_ITERATIONS', async () => {
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });
    // Always return tool_use — should stop at 10 iterations
    mockAI.complete.mockResolvedValue(
      makeToolUseResponse('get_company_knowledge', {}),
    );
    mockMemory.getCompanyKnowledge.mockResolvedValue([]);

    const result = await agent.execute(makeContext());
    expect(result.response).toContain('maximum iteration limit');
    // AI was called at most MAX_AGENT_ITERATIONS times
    expect(mockAI.complete.mock.calls.length).toBeLessThanOrEqual(10);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('handles tool execution errors gracefully', async () => {
    mockMarketingRepo.createGoal.mockRejectedValue(new Error('DB error'));
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    mockAI.complete
      .mockResolvedValueOnce(
        makeToolUseResponse('create_marketing_goal', { title: 'Fail' }),
      )
      .mockResolvedValueOnce(makeEndTurnResponse('An error occurred while creating the goal.'));

    const result = await agent.execute(makeContext());
    // Agent should continue and produce a response despite tool error
    expect(result.response).toBeDefined();
  });

  // ── Cost tracking ─────────────────────────────────────────────────────────

  it('traces token usage and cost', async () => {
    mockAI.complete.mockResolvedValue({
      ...makeEndTurnResponse('Done.'),
      usage: { inputTokens: 500, outputTokens: 200 },
    });
    mockApproval.check.mockResolvedValue({ outcome: 'ALLOWED', reason: 'WRITE allowed' });

    const result = await agent.execute(makeContext());
    expect(result.traceResult.totalInputTokens).toBe(500);
    expect(result.traceResult.totalOutputTokens).toBe(200);
    expect(result.traceResult.finalStatus).toBe('COMPLETED');
  });
});
