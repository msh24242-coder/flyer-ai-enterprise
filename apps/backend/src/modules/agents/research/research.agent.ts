import { Injectable, Inject, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel } from '@prisma/client';
import { AgentEngine } from '../../agent-engine/base/agent-engine.abstract';
import {
  AgentToolDefinition,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentIdentity,
  AgentStreamEventType,
} from '../../agent-engine/base/agent-engine.types';
import { IAIProvider } from '../../agent-engine/providers/ai/ai-provider.interface';
import { IEmbeddingProvider } from '../../agent-engine/providers/embedding/embedding-provider.interface';
import { MemoryService } from '../../agent-engine/memory/memory.service';
import { ApprovalEngineService } from '../../agent-engine/approval/approval-engine.service';
import { ObservabilityTracerService } from '../../agent-engine/observability/observability-tracer.service';
import { AgentOrchestratorService } from '../../agent-engine/orchestration/agent-orchestrator.service';
import { AI_PROVIDER, EMBEDDING_PROVIDER } from '../../agent-engine/agent-engine.constants';
import { PrismaService } from '../../../database/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class ResearchAgent extends AgentEngine {
  private ctx: AgentExecutionContext | null = null;

  constructor(
    @Inject(AI_PROVIDER) aiProvider: IAIProvider,
    @Inject(EMBEDDING_PROVIDER) embeddingProvider: IEmbeddingProvider,
    memoryService: MemoryService,
    approvalEngine: ApprovalEngineService,
    tracer: ObservabilityTracerService,
    orchestrator: AgentOrchestratorService,
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super(aiProvider, embeddingProvider, memoryService, approvalEngine, tracer, orchestrator, config);
  }

  override async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    this.ctx = context;
    return super.execute(context);
  }

  override async executeStream(
    context: AgentExecutionContext,
    onEvent: (event: AgentStreamEventType) => void,
  ): Promise<AgentExecutionResult> {
    this.ctx = context;
    return super.executeStream(context, onEvent);
  }

  getIdentity(): AgentIdentity {
    return { agentType: AgentType.RESEARCH, displayName: 'Research Agent', version: '1.0.0' };
  }

  async buildSystemPrompt(context: AgentExecutionContext): Promise<string> {
    const knowledge = await this.memoryService.getCompanyKnowledge(context.companyId);
    const companyCtx = (context.additionalContext?.company as Record<string, unknown>) ?? {};

    return `You are a Market Research Agent for ${companyCtx.name ?? 'the company'}.
Your role is to research markets, competitors, audiences, and trends to support marketing strategy.

Company context:
- Industry: ${companyCtx.industry ?? 'Not specified'}
- Website: ${companyCtx.website ?? 'Not specified'}
- Knowledge entries: ${knowledge.length}

You can analyze data from company records to provide research insights.
Always base findings on the available company data and structured analysis.
Present findings clearly with supporting evidence.`;
  }

  defineTools(): AgentToolDefinition[] {
    return [
      {
        tool: {
          name: 'analyze_competitors',
          description: 'Analyze competitor landscape based on company knowledge and campaigns',
          inputSchema: {
            type: 'object',
            properties: {
              focus_area: { type: 'string', description: 'Specific area to analyze (pricing, features, messaging, etc.)' },
            },
            required: [],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const competitorKnowledge = knowledge.filter(
            (k) => k.category === 'competitors' || k.category === 'market',
          );
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            select: { title: true, description: true, status: true },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
          return {
            focusArea: input.focus_area ?? 'general',
            competitorKnowledge: competitorKnowledge.map((k) => ({ key: k.key, value: k.value })),
            ownCampaigns: campaigns,
            instruction: 'Use the above data to analyze the competitive landscape and identify opportunities.',
          };
        },
      },
      {
        tool: {
          name: 'research_target_audience',
          description: 'Research and profile the target audience based on company knowledge',
          inputSchema: {
            type: 'object',
            properties: {
              segment: { type: 'string', description: 'Specific audience segment to research' },
            },
            required: [],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const audienceKnowledge = knowledge.filter(
            (k) => k.category === 'audience' || k.category === 'customers' || k.category === 'personas',
          );
          return {
            segment: input.segment ?? 'all',
            audienceData: audienceKnowledge.map((k) => ({ key: k.key, value: k.value })),
            instruction: 'Build a detailed audience profile based on the available data.',
          };
        },
      },
      {
        tool: {
          name: 'analyze_market_trends',
          description: 'Analyze relevant market trends for the company industry',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string', enum: ['current', 'emerging', 'historical'], description: 'Trend timeframe' },
            },
            required: [],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const trendKnowledge = knowledge.filter(
            (k) => k.category === 'trends' || k.category === 'market' || k.category === 'industry',
          );
          return {
            timeframe: input.timeframe ?? 'current',
            trendData: trendKnowledge.map((k) => ({ key: k.key, value: k.value })),
            instruction: 'Analyze and present relevant market trends based on available data.',
          };
        },
      },
      {
        tool: {
          name: 'performance_benchmark',
          description: 'Benchmark company marketing performance against goals',
          inputSchema: {
            type: 'object',
            properties: {
              metric: { type: 'string', description: 'Specific metric to benchmark (e.g., conversion, reach, ROI)' },
            },
            required: [],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const [goals, campaigns, tasks] = await Promise.all([
            this.prisma.marketingGoal.findMany({ where: { companyId }, take: 20, orderBy: { createdAt: 'desc' } }),
            this.prisma.campaign.findMany({ where: { companyId }, take: 20, orderBy: { createdAt: 'desc' } }),
            this.prisma.task.findMany({
              where: { companyId },
              select: { status: true },
            }),
          ]);
          const taskStats = tasks.reduce<Record<string, number>>((acc: Record<string, number>, t: { status: string }) => {
            acc[t.status] = (acc[t.status] ?? 0) + 1;
            return acc;
          }, {});
          return {
            metric: input.metric ?? 'overall',
            goals: goals.map((g: { title: string; status: string; targetDate: Date | null }) => ({ title: g.title, status: g.status, targetDate: g.targetDate })),
            campaignCount: campaigns.length,
            campaignStatuses: campaigns.reduce<Record<string, number>>((acc: Record<string, number>, c: { status: string }) => {
              acc[c.status] = (acc[c.status] ?? 0) + 1;
              return acc;
            }, {}),
            taskStats,
            instruction: 'Analyze these metrics and provide benchmark insights with recommendations.',
          };
        },
      },
    ];
  }
}
