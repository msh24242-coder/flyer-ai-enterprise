/**
 * Cross-agent contract tests: every agent must satisfy the AgentEngine contract.
 * Tests identity, system prompt, and tool definitions for all 7 specialized agents.
 */
import { StrategyAgent } from '../strategy/strategy.agent';
import { ResearchAgent } from '../research/research.agent';
import { ContentAgent } from '../content/content.agent';
import { SocialMediaAgent } from '../social/social-media.agent';
import { PerformanceAgent } from '../performance/performance.agent';
import { AnalyticsAgent } from '../analytics/analytics.agent';
import { CreativeAgent } from '../creative/creative.agent';
import { AgentType } from '@prisma/client';

const mockMemoryService = {
  getCompanyKnowledge: jest.fn().mockResolvedValue([]),
  enqueueMemoryWrite: jest.fn(),
};
const mockApprovalEngine = { requestApproval: jest.fn() };
const mockTracer = { createTrace: jest.fn().mockReturnValue({ traceId: 't' }), finalizeTrace: jest.fn() };
const mockOrchestrator = { dispatch: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('claude-opus-5') };
const mockPrisma = {
  generatedContent: { create: jest.fn().mockResolvedValue({}) },
  knowledgeEntry: { findMany: jest.fn().mockResolvedValue([]) },
  campaign: { findMany: jest.fn().mockResolvedValue([]) },
  marketingGoal: { findMany: jest.fn().mockResolvedValue([]) },
  agentExecution: { findMany: jest.fn().mockResolvedValue([]) },
};
const mockMarketingRepo = {
  listGoals: jest.fn().mockResolvedValue([]),
  listCampaigns: jest.fn().mockResolvedValue([]),
  createCampaign: jest.fn().mockResolvedValue({ id: 'c-1' }),
  createTask: jest.fn().mockResolvedValue({ id: 't-1' }),
};
const mockEmbeddingProvider = {};
const mockAiProvider = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAgent = any;

const AGENTS: Array<{ name: string; factory: () => AnyAgent; expectedType: AgentType }> = [
  {
    name: 'StrategyAgent',
    factory: () => new StrategyAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockMarketingRepo as never, mockPrisma as never),
    expectedType: AgentType.STRATEGY,
  },
  {
    name: 'ResearchAgent',
    factory: () => new ResearchAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockPrisma as never),
    expectedType: AgentType.RESEARCH,
  },
  {
    name: 'ContentAgent',
    factory: () => new ContentAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockMarketingRepo as never, mockPrisma as never),
    expectedType: AgentType.CONTENT,
  },
  {
    name: 'SocialMediaAgent',
    factory: () => new SocialMediaAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockPrisma as never),
    expectedType: AgentType.SOCIAL,
  },
  {
    name: 'PerformanceAgent',
    factory: () => new PerformanceAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockMarketingRepo as never, mockPrisma as never),
    expectedType: AgentType.PERFORMANCE,
  },
  {
    name: 'AnalyticsAgent',
    factory: () => new AnalyticsAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockMarketingRepo as never, mockPrisma as never),
    expectedType: AgentType.ANALYTICS,
  },
  {
    name: 'CreativeAgent',
    factory: () => new CreativeAgent(mockAiProvider as never, mockEmbeddingProvider as never, mockMemoryService as never, mockApprovalEngine as never, mockTracer as never, mockOrchestrator as never, mockConfig as never, mockMarketingRepo as never, mockPrisma as never),
    expectedType: AgentType.CREATIVE,
  },
];

const baseCtx = {
  companyId: 'co-1',
  userMessage: 'Test',
  model: 'claude-opus-5',
  conversationHistory: [],
};

describe('Agent contract: all specialized agents', () => {
  beforeEach(() => jest.clearAllMocks());

  for (const { name, factory, expectedType } of AGENTS) {
    describe(name, () => {
      it(`getIdentity returns ${expectedType}`, () => {
        expect(factory().getIdentity().agentType).toBe(expectedType);
      });

      it('getIdentity returns a non-empty displayName', () => {
        expect(factory().getIdentity().displayName).toBeTruthy();
      });

      it('buildSystemPrompt returns a non-empty string', async () => {
        const agent = factory();
        const prompt = await agent.buildSystemPrompt(baseCtx);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(20);
      });

      it('defineTools returns at least 1 tool', () => {
        const agent = factory();
        (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
        const tools = agent.defineTools();
        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThanOrEqual(1);
      });

      it('every tool has name, description, handler, and object inputSchema', () => {
        const agent = factory();
        (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
        for (const toolDef of agent.defineTools()) {
          expect(typeof toolDef.tool.name).toBe('string');
          expect(toolDef.tool.name.length).toBeGreaterThan(0);
          expect(typeof toolDef.tool.description).toBe('string');
          expect(toolDef.tool.inputSchema.type).toBe('object');
          expect(typeof toolDef.handler).toBe('function');
        }
      });

      it('no two tools share the same name', () => {
        const agent = factory();
        (agent as unknown as { ctx: typeof baseCtx }).ctx = baseCtx;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const names = agent.defineTools().map((t: any) => t.tool.name);
        expect(new Set(names).size).toBe(names.length);
      });
    });
  }
});
