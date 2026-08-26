import { StrategyAgent } from '../strategy.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = {
  getCompanyKnowledge: jest.fn().mockResolvedValue([]),
  enqueueMemoryWrite: jest.fn(),
};
const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockMarketingRepo = {
  listGoals: jest.fn().mockResolvedValue([]),
  listCampaigns: jest.fn().mockResolvedValue([]),
  findCampaign: jest.fn().mockResolvedValue(null),
  createCampaign: jest.fn().mockResolvedValue({ id: 'camp-new', title: '[Strategy] Test' }),
  createTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
};
const mockPrisma = {};
const mockEmbeddingProvider = {};
const mockAiProvider = { stream: jest.fn() };

function makeAgent() {
  return new StrategyAgent(
    mockAiProvider as never,
    mockEmbeddingProvider as never,
    mockMemoryService as never,
    mockApprovalEngine as never,
    mockTracer as never,
    mockOrchestrator as never,
    mockConfig as never,
    mockMarketingRepo as never,
    mockPrisma as never,
  );
}

const baseCtx = {
  companyId: 'co-1',
  userMessage: 'Build a Q4 marketing strategy',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('StrategyAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns STRATEGY agent type', () => {
      expect(makeAgent().getIdentity().agentType).toBe(AgentType.STRATEGY);
    });

    it('returns a non-empty displayName', () => {
      expect(makeAgent().getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name and industry', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: { company: { name: 'Acme Corp', industry: 'B2B SaaS' } },
      });
      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('B2B SaaS');
    });

    it('falls back gracefully when context is absent', async () => {
      const prompt = await makeAgent().buildSystemPrompt(baseCtx);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('includes company knowledge in the prompt', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: {
          company: {
            knowledge: [{ category: 'positioning', key: 'usp', value: 'Fastest onboarding' }],
          },
        },
      });
      expect(prompt).toContain('positioning');
      expect(prompt).toContain('Fastest onboarding');
    });

    it('shows "No company knowledge available" when knowledge is empty', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: { company: { name: 'Acme', knowledge: [] } },
      });
      expect(prompt).toContain('No company knowledge available');
    });
  });

  describe('defineTools', () => {
    function agentWithCtx() {
      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
      return agent;
    }

    it('returns exactly 6 tools', () => {
      expect(agentWithCtx().defineTools()).toHaveLength(6);
    });

    it('includes all expected tool names', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('analyze_market_position');
      expect(names).toContain('create_strategy');
      expect(names).toContain('evaluate_campaign_performance');
      expect(names).toContain('identify_competitive_advantage');
      expect(names).toContain('define_target_segments');
      expect(names).toContain('create_marketing_plan');
    });

    it('all tools have valid inputSchema and handler', () => {
      for (const toolDef of agentWithCtx().defineTools()) {
        expect(toolDef.tool.inputSchema.type).toBe('object');
        expect(typeof toolDef.handler).toBe('function');
      }
    });

    it('no two tools share the same name', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('executeStream', () => {
    it('emits agent_start with the conversationId before any tokens', async () => {
      mockTracer.finalizeTrace = jest.fn().mockResolvedValue({ traceId: 'trace-1' });
      mockAiProvider.stream.mockImplementation(async (_req: unknown, onProviderEvent: (e: unknown) => void) => {
        onProviderEvent({ type: 'text_delta', delta: 'Hi' });
        return {
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Hi' }] }],
          stopReason: 'end_turn',
        };
      });

      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;

      const events: Array<{ type: string }> = [];
      await agent.executeStream(
        { ...baseCtx, conversationId: 'conv-42' },
        (event) => events.push(event),
      );

      expect(events[0]).toEqual({ type: 'agent_start', agentType: AgentType.STRATEGY, conversationId: 'conv-42' });
    });
  });

  describe('tool handlers', () => {
    function agentWithCtx() {
      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
      return agent;
    }

    function getHandler(name: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const def = agentWithCtx().defineTools().find((t: any) => t.tool.name === name);
      if (!def) throw new Error(`Tool ${name} not found`);
      return def.handler;
    }

    it('analyze_market_position returns knowledge and goals', async () => {
      mockMemoryService.getCompanyKnowledge.mockResolvedValueOnce([
        { category: 'brand', key: 'usp', value: 'Fast' },
      ]);
      mockMarketingRepo.listGoals.mockResolvedValueOnce([{ id: 'g-1', title: 'Grow MRR', status: 'ACTIVE' }]);
      mockMarketingRepo.listCampaigns.mockResolvedValueOnce([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getHandler('analyze_market_position')({ focus: 'brand' }) as any;

      expect(result.analysisScope).toBe('brand');
      expect(result.knowledgeEntries).toBe(1);
      expect(result.activeGoals).toBe(1);
    });

    it('create_strategy persists a campaign and enqueues memory', async () => {
      await getHandler('create_strategy')({
        title: 'Q4 Growth Strategy',
        summary: 'Grow revenue by 20% in Q4',
        channels: ['LinkedIn', 'Email'],
        goalId: 'g-1',
      });

      expect(mockMarketingRepo.createCampaign).toHaveBeenCalledWith(
        'co-1',
        expect.objectContaining({ title: '[Strategy] Q4 Growth Strategy' }),
      );
      expect(mockMemoryService.enqueueMemoryWrite).toHaveBeenCalledWith(
        expect.objectContaining({ memoryType: 'DECISION' }),
      );
    });

    it('create_marketing_plan persists a campaign and enqueues GOAL_UPDATE memory', async () => {
      await getHandler('create_marketing_plan')({
        planTitle: 'Annual Plan 2027',
        objectives: ['Increase brand awareness', 'Drive pipeline'],
        channels: ['SEO', 'Events'],
        budget: 50000,
      });

      expect(mockMarketingRepo.createCampaign).toHaveBeenCalledWith(
        'co-1',
        expect.objectContaining({ title: '[Plan] Annual Plan 2027' }),
      );
      expect(mockMemoryService.enqueueMemoryWrite).toHaveBeenCalledWith(
        expect.objectContaining({ memoryType: 'GOAL_UPDATE' }),
      );
    });

    it('identify_competitive_advantage filters knowledge by relevant categories', async () => {
      mockMemoryService.getCompanyKnowledge.mockResolvedValueOnce([
        { category: 'brand', key: 'usp', value: 'Fastest' },
        { category: 'financials', key: 'revenue', value: '1M' },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getHandler('identify_competitive_advantage')({}) as any;

      expect(result.advantages.some((a: { category: string }) => a.category === 'brand')).toBe(true);
    });
  });
});
