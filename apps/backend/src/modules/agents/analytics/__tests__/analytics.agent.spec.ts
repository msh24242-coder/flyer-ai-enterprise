import { AnalyticsAgent } from '../analytics.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = { getCompanyKnowledge: jest.fn().mockResolvedValue([]), enqueueMemoryWrite: jest.fn() };
const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockMarketingRepo = {
  listGoals: jest.fn().mockResolvedValue([]),
  listCampaigns: jest.fn().mockResolvedValue([]),
};
const mockPrisma = {
  generatedContent: { create: jest.fn().mockResolvedValue({}) },
  agentExecution: { findMany: jest.fn().mockResolvedValue([]) },
  task: { findMany: jest.fn().mockResolvedValue([]) },
};
const mockEmbeddingProvider = {};
const mockAiProvider = {
  complete: jest.fn().mockResolvedValue({
    messages: [{ content: [{ type: 'text', text: 'Analytics report with comprehensive data insights' }], role: 'assistant' }],
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 80 },
  }),
};

function makeAgent() {
  return new AnalyticsAgent(
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
  userMessage: 'Generate a Q3 marketing analytics report',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('AnalyticsAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns ANALYTICS agent type', () => {
      expect(makeAgent().getIdentity().agentType).toBe(AgentType.ANALYTICS);
    });

    it('returns a non-empty displayName', () => {
      expect(makeAgent().getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name when provided', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: { company: { name: 'DataCo', industry: 'Analytics SaaS' } },
      });
      expect(prompt).toContain('DataCo');
    });

    it('returns a non-empty string without context', async () => {
      const prompt = await makeAgent().buildSystemPrompt(baseCtx);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(20);
    });
  });

  describe('defineTools', () => {
    function agentWithCtx() {
      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
      return agent;
    }

    it('returns at least 5 tools', () => {
      expect(agentWithCtx().defineTools().length).toBeGreaterThanOrEqual(5);
    });

    it('includes generate_marketing_report tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('generate_marketing_report');
    });

    it('includes run_attribution_analysis tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('run_attribution_analysis');
    });

    it('includes forecast_performance tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('forecast_performance');
    });

    it('includes build_executive_dashboard tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('build_executive_dashboard');
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

  describe('execute', () => {
    it('resolves without error', async () => {
      await expect(makeAgent().execute(baseCtx)).resolves.toBeDefined();
    });

    it('returns an object with a response string', async () => {
      const result = await makeAgent().execute(baseCtx);
      expect(typeof result.response).toBe('string');
    });
  });
});
