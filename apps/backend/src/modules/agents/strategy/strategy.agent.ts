import { Injectable, Inject, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel } from '@prisma/client';
import { AgentEngine } from '../../agent-engine/base/agent-engine.abstract';
import {
  AgentToolDefinition,
  AgentExecutionContext,
  AgentIdentity,
  AgentExecutionResult,
  AgentStreamEventType,
} from '../../agent-engine/base/agent-engine.types';
import { IAIProvider } from '../../agent-engine/providers/ai/ai-provider.interface';
import { IEmbeddingProvider } from '../../agent-engine/providers/embedding/embedding-provider.interface';
import { MemoryService } from '../../agent-engine/memory/memory.service';
import { ApprovalEngineService } from '../../agent-engine/approval/approval-engine.service';
import { ObservabilityTracerService } from '../../agent-engine/observability/observability-tracer.service';
import { AgentOrchestratorService } from '../../agent-engine/orchestration/agent-orchestrator.service';
import { AI_PROVIDER, EMBEDDING_PROVIDER } from '../../agent-engine/agent-engine.constants';
import { MarketingRepository } from '../../marketing-director/repositories/marketing.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class StrategyAgent extends AgentEngine {
  private ctx: AgentExecutionContext | null = null;

  constructor(
    @Inject(AI_PROVIDER) aiProvider: IAIProvider,
    @Inject(EMBEDDING_PROVIDER) embeddingProvider: IEmbeddingProvider,
    memoryService: MemoryService,
    approvalEngine: ApprovalEngineService,
    tracer: ObservabilityTracerService,
    orchestrator: AgentOrchestratorService,
    config: ConfigService,
    private readonly marketingRepo: MarketingRepository,
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
    return {
      agentType: AgentType.STRATEGY,
      displayName: 'Strategy Agent',
      version: '1.0.0',
    };
  }

  async buildSystemPrompt(context: AgentExecutionContext): Promise<string> {
    const company = context.additionalContext?.company as {
      name?: string;
      industry?: string;
      knowledge?: Array<{ category: string; key: string; value: unknown }>;
    } | undefined;

    const companyName = company?.name ?? 'your company';
    const industry = company?.industry ?? 'unspecified';
    const knowledge = company?.knowledge ?? [];

    const knowledgeStr = knowledge.length
      ? knowledge
          .map((k) => `- [${k.category}/${k.key}]: ${JSON.stringify(k.value)}`)
          .join('\n')
      : 'No company knowledge available.';

    return `You are the Strategy Agent for ${companyName}, operating in the ${industry} industry. You are a senior marketing strategist with expertise in market positioning, competitive analysis, and marketing planning.

## Company: ${companyName}
## Industry: ${industry}

## Company Knowledge
${knowledgeStr}

## Your Mission
Analyze market positions, define strategies, evaluate campaign performance, and create comprehensive marketing plans. Your outputs are actionable, measurable, and grounded in the company's actual goals and knowledge.

## Available Tools
- **analyze_market_position**: Assess current market standing and competitive position
- **create_strategy**: Define a comprehensive marketing strategy
- **evaluate_campaign_performance**: Analyze campaign results against targets
- **identify_competitive_advantage**: Surface unique differentiators
- **define_target_segments**: Profile customer segments for targeting
- **create_marketing_plan**: Produce a full marketing plan with timeline and KPIs

## Rules
- Only access data for ${companyName}. Never reference or simulate data for other companies.
- Base all analysis on the knowledge provided, not external assumptions.
- Be specific: include metrics, timelines, and owners in all plans.
- Flag when external data (competitor pricing, market share stats) is unavailable — do not fabricate it.`;
  }

  defineTools(): AgentToolDefinition[] {
    const companyId = this.ctx!.companyId;

    return [
      {
        tool: {
          name: 'analyze_market_position',
          description:
            'Analyze the company\'s current market position based on available knowledge. Returns a structured assessment of strengths, weaknesses, opportunities, and threats.',
          inputSchema: {
            type: 'object',
            properties: {
              focus: {
                type: 'string',
                description: 'Optional focus area (e.g. "brand awareness", "product positioning", "digital presence")',
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeCampaigns = await this.marketingRepo.listCampaigns(companyId, undefined, 'ACTIVE' as never);

          const focus = typeof input.focus === 'string' ? input.focus : 'overall';
          return {
            analysisScope: focus,
            companyId,
            knowledgeEntries: knowledge.length,
            activeGoals: goals.filter((g) => g.status === 'ACTIVE').length,
            activeCampaigns: activeCampaigns.length,
            knowledge: knowledge.map((k) => ({ category: k.category, key: k.key, value: k.value })),
            goals: goals.map((g) => ({ id: g.id, title: g.title, status: g.status })),
            note: 'Use this data to formulate SWOT analysis. External market data unavailable — base analysis on company knowledge.',
          };
        },
      },

      {
        tool: {
          name: 'create_strategy',
          description:
            'Create and persist a marketing strategy document. Links to an existing goal.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Strategy title' },
              summary: { type: 'string', description: 'One-paragraph executive summary' },
              targetAudience: { type: 'string', description: 'Primary target audience description' },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Marketing channels to use (e.g. ["LinkedIn", "Email", "SEO"])',
              },
              keyMessages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Core messages to communicate',
              },
              kpis: {
                type: 'object',
                description: 'Key performance indicators and targets',
              },
              goalId: { type: 'string', description: 'Optional marketing goal ID this strategy supports' },
              timelineWeeks: { type: 'number', description: 'Strategy duration in weeks' },
            },
            required: ['title', 'summary'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const strategyContent = {
            title: String(input.title),
            summary: typeof input.summary === 'string' ? input.summary : '',
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : undefined,
            channels: Array.isArray(input.channels) ? input.channels : [],
            keyMessages: Array.isArray(input.keyMessages) ? input.keyMessages : [],
            kpis: typeof input.kpis === 'object' && input.kpis !== null ? input.kpis : {},
            timelineWeeks: typeof input.timelineWeeks === 'number' ? input.timelineWeeks : 12,
            createdAt: new Date().toISOString(),
          };

          // Persist strategy as a campaign with rich metadata
          const campaign = await this.marketingRepo.createCampaign(companyId, {
            title: `[Strategy] ${String(input.title)}`,
            description: typeof input.summary === 'string' ? input.summary : undefined,
            goalId: typeof input.goalId === 'string' ? input.goalId : undefined,
            metadata: strategyContent as Record<string, unknown>,
          });

          // Store as memory insight
          await this.memoryService.enqueueMemoryWrite({
            companyId,
            agentType: AgentType.STRATEGY,
            memoryType: 'DECISION',
            content: `Strategy created: ${String(input.title)}. Summary: ${String(input.summary)}`,
            conversationId: this.ctx?.conversationId,
          });

          return {
            strategyId: campaign.id,
            title: campaign.title,
            status: 'created',
            strategy: strategyContent,
          };
        },
      },

      {
        tool: {
          name: 'evaluate_campaign_performance',
          description: 'Evaluate the performance of one or all campaigns against their goals.',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: {
                type: 'string',
                description: 'Specific campaign ID to evaluate, or omit for all campaigns',
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
          const campaigns = campaignId
            ? [await this.marketingRepo.findCampaign(companyId, campaignId)].filter(Boolean)
            : await this.marketingRepo.listCampaigns(companyId);

          return campaigns.map((c) => ({
            id: c!.id,
            title: c!.title,
            status: c!.status,
            budget: c!.budget,
            startDate: c!.startDate,
            endDate: c!.endDate,
            taskCount: 0,
            note: 'Performance metrics (impressions, conversions) require integration with ad platforms.',
          }));
        },
      },

      {
        tool: {
          name: 'identify_competitive_advantage',
          description:
            'Surface the company\'s unique competitive advantages from the knowledge base.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Knowledge category to search (default: all categories)',
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const category = typeof input.category === 'string' ? input.category : undefined;
          const filtered = category ? knowledge.filter((k) => k.category === category) : knowledge;
          const relevant = filtered.filter((k) =>
            ['products', 'positioning', 'brand', 'usp', 'competitive'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ),
          );
          return {
            advantages: relevant.map((k) => ({ category: k.category, key: k.key, value: k.value })),
            note: 'Identify the top 3-5 differentiators and map them to customer pain points.',
          };
        },
      },

      {
        tool: {
          name: 'define_target_segments',
          description: 'Define or retrieve target customer segments from the knowledge base.',
          inputSchema: {
            type: 'object',
            properties: {
              segmentType: {
                type: 'string',
                description: 'Type of segmentation (e.g. "demographic", "firmographic", "behavioral")',
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const audienceKnowledge = knowledge.filter((k) =>
            ['audience', 'customer', 'segment', 'persona'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ),
          );
          return {
            segments: audienceKnowledge.map((k) => ({ category: k.category, key: k.key, value: k.value })),
            segmentType: typeof input.segmentType === 'string' ? input.segmentType : 'all',
            note: 'Enrich with demographic and firmographic data from your CRM when available.',
          };
        },
      },

      {
        tool: {
          name: 'create_marketing_plan',
          description:
            'Create a comprehensive marketing plan with timeline, channels, KPIs, and tasks.',
          inputSchema: {
            type: 'object',
            properties: {
              planTitle: { type: 'string', description: 'Plan name' },
              duration: { type: 'string', description: 'Plan duration (e.g. "Q4 2026", "6 months")' },
              objectives: {
                type: 'array',
                items: { type: 'string' },
                description: 'Top 3-5 marketing objectives',
              },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Marketing channels',
              },
              budget: { type: 'number', description: 'Total budget in USD' },
              goalId: { type: 'string', description: 'Associated marketing goal ID' },
            },
            required: ['planTitle', 'objectives'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const plan = {
            planTitle: String(input.planTitle),
            duration: typeof input.duration === 'string' ? input.duration : 'TBD',
            objectives: Array.isArray(input.objectives) ? input.objectives : [],
            channels: Array.isArray(input.channels) ? input.channels : [],
            budget: typeof input.budget === 'number' ? input.budget : 0,
            createdAt: new Date().toISOString(),
          };

          const campaign = await this.marketingRepo.createCampaign(companyId, {
            title: `[Plan] ${String(input.planTitle)}`,
            description: plan.objectives.join('; '),
            goalId: typeof input.goalId === 'string' ? input.goalId : undefined,
            budget: plan.budget || undefined,
            metadata: plan as Record<string, unknown>,
          });

          await this.memoryService.enqueueMemoryWrite({
            companyId,
            agentType: AgentType.STRATEGY,
            memoryType: 'GOAL_UPDATE',
            content: `Marketing plan created: ${String(input.planTitle)} with ${plan.objectives.length} objectives.`,
            conversationId: this.ctx?.conversationId,
          });

          return { planId: campaign.id, plan };
        },
      },
    ];
  }
}
