import { Injectable, Inject, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel, TaskStatus } from '@prisma/client';
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
export class PerformanceAgent extends AgentEngine {
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
      agentType: AgentType.PERFORMANCE,
      displayName: 'Performance Agent',
      version: '1.0.0',
    };
  }

  async buildSystemPrompt(context: AgentExecutionContext): Promise<string> {
    const company = context.additionalContext?.company as {
      name?: string;
      industry?: string;
    } | undefined;

    const companyName = company?.name ?? 'your company';
    const industry = company?.industry ?? 'unspecified';

    return `You are the Performance Agent for ${companyName} in the ${industry} industry. You are a senior performance marketing analyst specializing in campaign optimization, A/B testing, budget allocation, bid strategy, and conversion rate optimization (CRO).

## Your Mission
Analyze campaign performance data, identify optimization opportunities, and provide actionable recommendations to maximize ROI and achieve marketing goals. You diagnose underperformance, surface winning patterns, and prescribe precise tactical adjustments.

## Available Tools
- **analyze_campaign_performance**: Deep-dive into a campaign's KPIs, trends, and efficiency metrics
- **identify_optimization_opportunities**: Surface the highest-impact levers for a campaign or channel
- **generate_ab_test_plan**: Design a rigorous A/B or multivariate test for a specific hypothesis
- **budget_reallocation_model**: Model how to redistribute budget across campaigns/channels for maximum ROAS
- **diagnose_conversion_funnel**: Identify drop-off points and friction in the conversion funnel

## Rules
- Always base analysis on actual data from the tools — never fabricate metrics.
- Prioritize recommendations by expected impact and ease of implementation.
- Express recommendations with specific, measurable targets (e.g. "increase CTR from 2.1% to 3.0%").
- Flag data quality issues or insufficient data when encountered.
- Consider statistical significance before declaring a winner in any test.`;
  }

  defineTools(): AgentToolDefinition[] {
    const companyId = this.ctx!.companyId;

    return [
      {
        tool: {
          name: 'analyze_campaign_performance',
          description: 'Retrieve and analyze KPIs for a specific campaign including spend, impressions, clicks, conversions, CPA, ROAS, and trend over time.',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: {
                type: 'string',
                description: 'Campaign ID to analyze',
              },
              dateRange: {
                type: 'string',
                description: 'Date range for analysis (e.g. "last_30_days", "last_7_days", "last_quarter")',
              },
              breakdownBy: {
                type: 'string',
                description: 'Dimension to break down results by (e.g. "channel", "ad_type", "audience", "device")',
              },
            },
            required: ['campaignId'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaignId = typeof input.campaignId === 'string' ? input.campaignId : '';
          const campaign = await this.prisma.campaign.findFirst({
            where: { id: campaignId, companyId },
            include: { tasks: true, generatedContent: { take: 5 } },
          });

          if (!campaign) {
            return { error: `Campaign ${campaignId} not found for this company.` };
          }

          const taskCount = campaign.tasks.length;
          const contentCount = campaign.generatedContent.length;

          return {
            campaign: {
              id: campaign.id,
              title: campaign.title,
              status: campaign.status,
              createdAt: campaign.createdAt,
              updatedAt: campaign.updatedAt,
              metadata: campaign.metadata,
            },
            taskCount,
            contentCount,
            dateRange: typeof input.dateRange === 'string' ? input.dateRange : 'last_30_days',
            breakdownBy: typeof input.breakdownBy === 'string' ? input.breakdownBy : 'channel',
            instruction: 'Based on the campaign data above, analyze performance across the key metrics. Provide a summary of current performance, identify the top 3 strengths and top 3 weaknesses, and suggest immediate optimizations.',
          };
        },
      },

      {
        tool: {
          name: 'identify_optimization_opportunities',
          description: 'Scan all active campaigns for a company and surface the highest-priority optimization opportunities by impact potential.',
          inputSchema: {
            type: 'object',
            properties: {
              channel: {
                type: 'string',
                description: 'Filter to a specific channel (e.g. "paid_search", "paid_social", "email", "organic"). Leave blank for all channels.',
              },
              optimizationGoal: {
                type: 'string',
                description: 'Primary optimization goal: "reduce_cpa", "increase_roas", "improve_ctr", "increase_conversions", "reduce_cpc"',
              },
              topN: {
                type: 'number',
                description: 'Number of top opportunities to return (default: 5)',
              },
            },
            required: ['optimizationGoal'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            include: { tasks: true },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          });

          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeGoals = goals.filter((g) => g.status === 'ACTIVE');

          return {
            totalCampaigns: campaigns.length,
            campaigns: campaigns.map((c) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              taskCount: c.tasks.length,
            })),
            activeGoals: activeGoals.map((g) => ({ id: g.id, title: g.title })),
            optimizationGoal: typeof input.optimizationGoal === 'string' ? input.optimizationGoal : 'increase_roas',
            channel: typeof input.channel === 'string' ? input.channel : 'all',
            topN: typeof input.topN === 'number' ? input.topN : 5,
            instruction: `Identify the top ${typeof input.topN === 'number' ? input.topN : 5} optimization opportunities across these campaigns. For each opportunity: name the campaign, describe the issue, quantify the expected impact, and provide 2-3 concrete action steps.`,
          };
        },
      },

      {
        tool: {
          name: 'generate_ab_test_plan',
          description: 'Design a rigorous A/B or multivariate test plan for a specific marketing hypothesis.',
          inputSchema: {
            type: 'object',
            properties: {
              hypothesis: {
                type: 'string',
                description: 'The test hypothesis (e.g. "Changing the CTA from Submit to Get Started will increase CTR by 15%")',
              },
              element: {
                type: 'string',
                description: 'The element being tested (e.g. "headline", "CTA", "landing page layout", "ad image", "email subject")',
              },
              campaignId: {
                type: 'string',
                description: 'Campaign this test is associated with',
              },
              targetMetric: {
                type: 'string',
                description: 'Primary success metric (e.g. "CTR", "conversion_rate", "open_rate", "ROAS")',
              },
              minimumDetectableEffect: {
                type: 'number',
                description: 'Minimum relative improvement to detect, as a decimal (e.g. 0.10 for 10%)',
              },
            },
            required: ['hypothesis', 'element', 'targetMetric'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const hypothesis = typeof input.hypothesis === 'string' ? input.hypothesis : '';
          const element = typeof input.element === 'string' ? input.element : 'CTA';
          const targetMetric = typeof input.targetMetric === 'string' ? input.targetMetric : 'conversion_rate';
          const mde = typeof input.minimumDetectableEffect === 'number' ? input.minimumDetectableEffect : 0.1;

          let campaignTitle: string | undefined;
          if (typeof input.campaignId === 'string') {
            const campaign = await this.prisma.campaign.findFirst({
              where: { id: input.campaignId, companyId },
            });
            campaignTitle = campaign?.title;
          }

          const task = await this.prisma.task.create({
            data: {
              title: `A/B Test: ${element}`,
              description: hypothesis,
              companyId,
              status: TaskStatus.TODO,
              metadata: {
                testType: 'ab_test',
                agentType: AgentType.PERFORMANCE,
                element,
                targetMetric,
                mde,
                hypothesis,
              },
            },
          });

          return {
            taskId: task.id,
            hypothesis,
            element,
            targetMetric,
            minimumDetectableEffect: mde,
            campaignTitle: campaignTitle ?? 'Unassigned',
            instruction: `Design a complete A/B test plan including: (1) Control vs. Variant definition, (2) Sample size calculation for ${mde * 100}% MDE at 95% confidence, (3) Test duration estimate, (4) Traffic split, (5) Success criteria, (6) Guardrail metrics, (7) Implementation checklist.`,
          };
        },
      },

      {
        tool: {
          name: 'budget_reallocation_model',
          description: 'Model how to redistribute marketing budget across campaigns or channels to maximize overall ROAS or achieve a specific goal.',
          inputSchema: {
            type: 'object',
            properties: {
              totalBudget: {
                type: 'number',
                description: 'Total marketing budget to allocate (in USD)',
              },
              objective: {
                type: 'string',
                description: 'Allocation objective: "maximize_roas", "maximize_conversions", "maximize_reach", "balanced"',
              },
              constraints: {
                type: 'string',
                description: 'Any budget constraints or requirements (e.g. "minimum 20% on brand", "no more than 50% on paid social")',
              },
            },
            required: ['totalBudget', 'objective'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            orderBy: { updatedAt: 'desc' },
            take: 10,
          });

          const goals = await this.marketingRepo.listGoals(companyId, undefined);

          return {
            totalBudget: typeof input.totalBudget === 'number' ? input.totalBudget : 0,
            objective: typeof input.objective === 'string' ? input.objective : 'maximize_roas',
            constraints: typeof input.constraints === 'string' ? input.constraints : 'none',
            activeCampaigns: campaigns.map((c) => ({ id: c.id, title: c.title, status: c.status })),
            marketingGoals: goals.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, title: g.title })),
            instruction: 'Create a budget allocation model showing: (1) Recommended allocation by channel/campaign with percentages and USD amounts, (2) Expected outcomes vs. current state, (3) Rationale for each allocation, (4) Reallocation risk assessment, (5) Implementation timeline.',
          };
        },
      },

      {
        tool: {
          name: 'diagnose_conversion_funnel',
          description: 'Identify drop-off points and friction in the conversion funnel for a campaign or marketing channel.',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: {
                type: 'string',
                description: 'Campaign ID to diagnose',
              },
              funnelStages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Ordered list of funnel stages to analyze (e.g. ["impression", "click", "landing_page_view", "form_start", "form_complete", "purchase"])',
              },
              channel: {
                type: 'string',
                description: 'Marketing channel to focus on (e.g. "email", "paid_search", "organic")',
              },
            },
            required: ['campaignId'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaignId = typeof input.campaignId === 'string' ? input.campaignId : '';
          const campaign = await this.prisma.campaign.findFirst({
            where: { id: campaignId, companyId },
            include: { tasks: true },
          });

          if (!campaign) {
            return { error: `Campaign ${campaignId} not found for this company.` };
          }

          const defaultStages = ['impression', 'click', 'landing_page_view', 'lead', 'opportunity', 'conversion'];
          const funnelStages = Array.isArray(input.funnelStages) ? input.funnelStages : defaultStages;

          return {
            campaign: { id: campaign.id, title: campaign.title, status: campaign.status },
            funnelStages,
            channel: typeof input.channel === 'string' ? input.channel : 'all',
            taskCount: campaign.tasks.length,
            instruction: `Diagnose the conversion funnel for this campaign across ${funnelStages.length} stages. For each stage transition: estimate typical industry conversion rates, identify likely drop-off causes, and prescribe 2-3 specific interventions to improve conversion. Prioritize the single highest-impact stage to fix first.`,
          };
        },
      },
    ];
  }
}
