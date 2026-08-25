import { SocialMediaAgent } from '../social-media.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = { getCompanyKnowledge: jest.fn().mockResolvedValue([]), enqueueMemoryWrite: jest.fn() };
const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockPrisma = {
  generatedContent: { create: jest.fn().mockResolvedValue({}) },
  campaign: { findMany: jest.fn().mockResolvedValue([]) },
  marketingGoal: { findMany: jest.fn().mockResolvedValue([]) },
};
const mockEmbeddingProvider = {};
const mockAiProvider = {
  complete: jest.fn().mockResolvedValue({
    messages: [{ content: [{ type: 'text', text: 'Generated social content for your brand' }], role: 'assistant' }],
    stopReason: 'end_turn',
    usage: { inputTokens: 50, outputTokens: 30 },
  }),
};

function makeAgent() {
  return new SocialMediaAgent(
    mockAiProvider as never,
    mockEmbeddingProvider as never,
    mockMemoryService as never,
    mockApprovalEngine as never,
    mockTracer as never,
    mockOrchestrator as never,
    mockConfig as never,
    mockPrisma as never,
  );
}

const baseCtx = {
  companyId: 'co-1',
  userMessage: 'Create a LinkedIn post for our product launch',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('SocialMediaAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns SOCIAL agent type', () => {
      expect(makeAgent().getIdentity().agentType).toBe(AgentType.SOCIAL);
    });

    it('returns a non-empty displayName', () => {
      expect(makeAgent().getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name when provided', async () => {
      const prompt = await makeAgent().buildSystemPrompt({
        ...baseCtx,
        additionalContext: { company: { name: 'Acme Corp', industry: 'SaaS' } },
      });
      expect(prompt).toContain('Acme Corp');
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

    it('returns at least 4 tools', () => {
      expect(agentWithCtx().defineTools().length).toBeGreaterThanOrEqual(4);
    });

    it('includes create_social_post tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('create_social_post');
    });

    it('includes create_content_calendar tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('create_content_calendar');
    });

    it('includes analyze_social_performance tool', () => {
      const names = agentWithCtx().defineTools().map((t) => t.tool.name);
      expect(names).toContain('analyze_social_performance');
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
    it('persists generated content after a successful execution', async () => {
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
