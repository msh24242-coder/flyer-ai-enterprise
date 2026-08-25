import { CreativeAgent } from '../creative.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = { getCompanyKnowledge: jest.fn().mockResolvedValue([]), enqueueMemoryWrite: jest.fn() };
const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockMarketingRepo = {
  listGoals: jest.fn().mockResolvedValue([]),
  listCampaigns: jest.fn().mockResolvedValue([]),
  createCampaign: jest.fn().mockResolvedValue({ id: 'camp-1', title: 'Creative Brief' }),
};
const mockPrisma = {
  generatedContent: { create: jest.fn().mockResolvedValue({}) },
  knowledgeEntry: { findMany: jest.fn().mockResolvedValue([]) },
};
const mockEmbeddingProvider = {};
const mockAiProvider = {
  complete: jest.fn().mockResolvedValue({
    messages: [{ content: [{ type: 'text', text: 'Creative brief with brand voice and visual guidelines complete' }], role: 'assistant' }],
    stopReason: 'end_turn',
    usage: { inputTokens: 70, outputTokens: 50 },
  }),
};

function makeAgent() {
  return new CreativeAgent(
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
  userMessage: 'Create a brand identity brief for our new product line',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('CreativeAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns CREATIVE agent type', () => {
      expect(makeAgent().getIdentity().agentType).toBe(AgentType.CREATIVE);
    });

    it('returns a non-empty displayName', () => {
      expect(makeAgent().getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name when provided', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: { company: { name: 'BrandCo', industry: 'Consumer Goods' } },
      });
      expect(prompt).toContain('BrandCo');
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

    it('includes create_creative_brief tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('create_creative_brief');
    });

    it('includes develop_visual_concept tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('develop_visual_concept');
    });

    it('includes create_brand_guidelines tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('create_brand_guidelines');
    });

    it('includes generate_campaign_concept tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('generate_campaign_concept');
    });

    it('includes audit_brand_consistency tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('audit_brand_consistency');
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

  describe('execute with content persistence', () => {
    it('persists generated content after execution', async () => {
      await makeAgent().execute(baseCtx);
      expect(mockPrisma.generatedContent.create).toHaveBeenCalled();
    });

    it('swallows DB errors without failing execution', async () => {
      mockPrisma.generatedContent.create.mockRejectedValueOnce(new Error('DB down'));
      await expect(makeAgent().execute(baseCtx)).resolves.toBeDefined();
    });

    it('does not persist when response is too short', async () => {
      mockAiProvider.complete.mockResolvedValueOnce({
        messages: [{ content: [{ type: 'text', text: 'Ok' }], role: 'assistant' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 5, outputTokens: 2 },
      });
      await makeAgent().execute(baseCtx);
      expect(mockPrisma.generatedContent.create).not.toHaveBeenCalled();
    });
  });
});
