import { ResearchAgent } from '../research.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = {
  getCompanyKnowledge: jest.fn().mockResolvedValue([]),
  enqueueMemoryWrite: jest.fn(),
};

const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 'trace-1' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockPrisma = { knowledgeEntry: { findMany: jest.fn().mockResolvedValue([]) }, campaign: { findMany: jest.fn().mockResolvedValue([]) }, marketingGoal: { findMany: jest.fn().mockResolvedValue([]) } };
const mockEmbeddingProvider = {};
const mockAiProvider = {};

function makeAgent() {
  return new ResearchAgent(
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

describe('ResearchAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getIdentity', () => {
    it('returns RESEARCH agent type', () => {
      const agent = makeAgent();
      const identity = agent.getIdentity();
      expect(identity.agentType).toBe(AgentType.RESEARCH);
    });

    it('returns a display name', () => {
      const agent = makeAgent();
      expect(agent.getIdentity().displayName).toBeTruthy();
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes company name from context', async () => {
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        companyId: 'co-1',
        userMessage: 'Research the market',
        model: 'claude-opus-5',
        conversationHistory: [],
        additionalContext: { company: { name: 'Acme Corp', industry: 'SaaS' } },
      });

      expect(prompt).toContain('Acme Corp');
    });

    it('includes industry from context', async () => {
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        companyId: 'co-1',
        userMessage: 'Research the market',
        model: 'claude-opus-5',
        conversationHistory: [],
        additionalContext: { company: { name: 'Test', industry: 'FinTech' } },
      });

      expect(prompt).toContain('FinTech');
    });

    it('handles missing company context gracefully', async () => {
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        companyId: 'co-1',
        userMessage: 'Research the market',
        model: 'claude-opus-5',
        conversationHistory: [],
      });

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('includes knowledge entry count from memory service', async () => {
      mockMemoryService.getCompanyKnowledge.mockResolvedValueOnce([
        { key: 'brand', value: 'Acme' },
        { key: 'audience', value: 'SMBs' },
      ]);
      const agent = makeAgent();
      const prompt = await agent.buildSystemPrompt({
        companyId: 'co-1',
        userMessage: 'Research',
        model: 'claude-opus-5',
        conversationHistory: [],
      });

      expect(prompt).toContain('2');
    });
  });

  describe('defineTools', () => {
    it('returns at least 3 tools', () => {
      const agent = makeAgent();
      const tools = agent.defineTools();
      expect(tools.length).toBeGreaterThanOrEqual(3);
    });

    it('all tools have a name, description, and handler', () => {
      const agent = makeAgent();
      for (const toolDef of agent.defineTools()) {
        expect(toolDef.tool.name).toBeTruthy();
        expect(toolDef.tool.description).toBeTruthy();
        expect(typeof toolDef.handler).toBe('function');
      }
    });

    it('all tools have valid inputSchema', () => {
      const agent = makeAgent();
      for (const toolDef of agent.defineTools()) {
        expect(toolDef.tool.inputSchema.type).toBe('object');
        expect(toolDef.tool.inputSchema.properties).toBeDefined();
      }
    });

    it('includes analyze_competitors tool', () => {
      const agent = makeAgent();
      const names = agent.defineTools().map((t) => t.tool.name);
      expect(names).toContain('analyze_competitors');
    });
  });
});
