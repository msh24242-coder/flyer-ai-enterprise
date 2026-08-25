import { ContentAgent } from '../content.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = {
  getCompanyKnowledge: jest.fn().mockResolvedValue([]),
  enqueueMemoryWrite: jest.fn(),
};

const mockMarketingRepo = {
  listGoals: jest.fn().mockResolvedValue([]),
  createCampaign: jest.fn().mockResolvedValue({ id: 'camp-new', title: 'Content Calendar' }),
};

const mockPrisma = {
  generatedContent: { create: jest.fn().mockResolvedValue({}) },
};

const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = {
  createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }),
  finalizeTrace: jest.fn(),
};
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockEmbeddingProvider = {};
const mockAiProvider = {
  complete: jest.fn().mockResolvedValue({
    messages: [{ content: [{ type: 'text', text: 'Generated content output' }], role: 'assistant' }],
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 50 },
  }),
};

function makeAgent() {
  return new ContentAgent(
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

const baseContext = {
  companyId: 'co-1',
  userMessage: 'Write a LinkedIn post about our new product launch',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('ContentAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns CONTENT agent type', () => {
      const agent = makeAgent();
      expect(agent.getIdentity().agentType).toBe(AgentType.CONTENT);
    });

    it('returns a display name', () => {
      expect(makeAgent().getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name when provided', async () => {
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        ...baseContext,
        additionalContext: { company: { name: 'Acme Co', industry: 'B2B SaaS' } },
      });
      expect(prompt).toContain('Acme Co');
      expect(prompt).toContain('B2B SaaS');
    });

    it('falls back gracefully when company context is missing', async () => {
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt(baseContext);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('includes brand guidelines from knowledge when available', async () => {
      mockMemoryService.getCompanyKnowledge.mockResolvedValueOnce([
        { category: 'brand', key: 'voice', value: 'Friendly but authoritative' },
      ]);
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        ...baseContext,
        additionalContext: {
          company: {
            knowledge: [{ category: 'brand', key: 'voice', value: 'Friendly but authoritative' }],
          },
        },
      });
      expect(prompt).toContain('brand');
    });
  });

  describe('defineTools', () => {
    it('returns 8 tools', () => {
      const agent = makeAgent();
      // Need ctx set for defineTools (it uses this.ctx!.companyId)
      (agent as unknown as { ctx: typeof baseContext }).ctx = baseContext;
      expect(agent.defineTools()).toHaveLength(8);
    });

    it('includes all expected tool names', () => {
      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseContext }).ctx = baseContext;
      const names = agent.defineTools().map((t) => t.tool.name);

      expect(names).toContain('generate_copy');
      expect(names).toContain('create_social_post');
      expect(names).toContain('create_email_brief');
      expect(names).toContain('create_blog_outline');
      expect(names).toContain('create_ad_copy');
      expect(names).toContain('create_content_calendar');
      expect(names).toContain('rewrite_content');
      expect(names).toContain('translate_content');
    });

    it('all tools have valid inputSchema and handler', () => {
      const agent = makeAgent();
      (agent as unknown as { ctx: typeof baseContext }).ctx = baseContext;
      for (const toolDef of agent.defineTools()) {
        expect(toolDef.tool.inputSchema.type).toBe('object');
        expect(toolDef.tool.inputSchema.properties).toBeDefined();
        expect(typeof toolDef.handler).toBe('function');
      }
    });
  });

  describe('execute with content persistence', () => {
    it('persists generated content after execution', async () => {
      const agent = makeAgent();
      await agent.execute(baseContext);

      expect(mockPrisma.generatedContent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'co-1',
            agentType: AgentType.CONTENT,
            content: 'Generated content output',
          }),
        }),
      );
    });

    it('does not persist when response is too short', async () => {
      mockAiProvider.complete.mockResolvedValueOnce({
        messages: [{ content: [{ type: 'text', text: 'Short' }], role: 'assistant' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 5 },
      });
      const agent = makeAgent();
      await agent.execute(baseContext);

      expect(mockPrisma.generatedContent.create).not.toHaveBeenCalled();
    });

    it('swallows DB errors without failing the agent execution', async () => {
      mockPrisma.generatedContent.create.mockRejectedValueOnce(new Error('DB down'));
      const agent = makeAgent();

      await expect(agent.execute(baseContext)).resolves.toBeDefined();
    });

    it('uses userMessage as content title (truncated to 100 chars)', async () => {
      const longMessage = 'A'.repeat(150);
      const agent = makeAgent();
      await agent.execute({ ...baseContext, userMessage: longMessage });

      expect(mockPrisma.generatedContent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'A'.repeat(100),
          }),
        }),
      );
    });
  });
});
