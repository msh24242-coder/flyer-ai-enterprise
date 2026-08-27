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
export class AnalyticsAgent extends AgentEngine {
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
      agentType: AgentType.ANALYTICS,
      displayName: 'Analytics Agent',
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

    return `You are the Analytics Agent for ${companyName} in the ${industry} industry. You are a senior marketing data analyst and business intelligence expert. You specialize in attribution modeling, cohort analysis, customer lifetime value (LTV), marketing mix modeling (MMM), and executive reporting.

## Your Mission
Transform raw marketing data into clear, actionable intelligence. Provide analysis that drives strategic decisions — from understanding which channels truly drive revenue (attribution) to forecasting future performance based on current trajectories.

## Available Tools
- **generate_marketing_report**: Compile a comprehensive marketing performance report for any time period
- **run_attribution_analysis**: Model which touchpoints and channels are driving conversions
- **analyze_customer_cohorts**: Segment customers by acquisition cohort and analyze retention/LTV trends
- **forecast_performance**: Project future performance based on historical trends and planned changes
- **build_executive_dashboard**: Structure a C-suite-ready marketing dashboard summary

## Rules
- Always clarify assumptions behind any model or projection.
- Present data with appropriate uncertainty bounds — no false precision.
- Lead with the "So what?" — insight and implication before the raw numbers.
- When data is insufficient for a conclusion, say so explicitly rather than speculating.
- Recommend next analytical steps when the current data raises new questions.`;
  }

  defineTools(): AgentToolDefinition[] {
    const companyId = this.ctx!.companyId;

    return [
      {
        tool: {
          name: 'generate_marketing_report',
          description: 'Compile a comprehensive marketing performance report covering all campaigns, channels, and goals for a specified period.',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                description: 'Reporting period (e.g. "last_month", "last_quarter", "Q2_2026", "ytd")',
              },
              format: {
                type: 'string',
                description: 'Report format: "executive_summary", "full_detail", "channel_breakdown", "goal_progress"',
              },
              includeRecommendations: {
                type: 'boolean',
                description: 'Whether to include strategic recommendations in the report',
              },
            },
            required: ['period'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            include: { tasks: true, generatedContent: true },
            orderBy: { createdAt: 'desc' },
          });

          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);

          const campaignSummaries = campaigns.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            createdAt: c.createdAt,
            taskCount: c.tasks.length,
            contentCount: c.generatedContent.length,
            metadata: c.metadata,
          }));

          return {
            period: typeof input.period === 'string' ? input.period : 'last_month',
            format: typeof input.format === 'string' ? input.format : 'executive_summary',
            includeRecommendations: typeof input.includeRecommendations === 'boolean' ? input.includeRecommendations : true,
            totalCampaigns: campaigns.length,
            campaigns: campaignSummaries,
            goals: goals.map((g) => ({ id: g.id, title: g.title, status: g.status })),
            knowledgeItems: knowledge.length,
            instruction: `Generate a ${typeof input.format === 'string' ? input.format : 'executive_summary'} report for ${typeof input.period === 'string' ? input.period : 'last_month'}. Structure: (1) Performance Headline with 3-5 key numbers, (2) Goal Progress scorecard, (3) Campaign Performance summary table, (4) Top wins and top concerns, ${typeof input.includeRecommendations === 'boolean' && input.includeRecommendations ? '(5) Strategic recommendations for next period.' : ''}`,
          };
        },
      },

      {
        tool: {
          name: 'run_attribution_analysis',
          description: 'Model which marketing touchpoints and channels are driving conversions using first-touch, last-touch, or multi-touch attribution.',
          inputSchema: {
            type: 'object',
            properties: {
              attributionModel: {
                type: 'string',
                description: 'Attribution model to use: "first_touch", "last_touch", "linear", "time_decay", "position_based", "data_driven"',
              },
              conversionEvent: {
                type: 'string',
                description: 'The conversion event to attribute (e.g. "purchase", "lead_form_submit", "trial_signup")',
              },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Channels to include in attribution (e.g. ["paid_search", "organic", "email", "social", "direct"])',
              },
              lookbackWindowDays: {
                type: 'number',
                description: 'Attribution lookback window in days (default: 30)',
              },
            },
            required: ['attributionModel', 'conversionEvent'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            select: { id: true, title: true, status: true, metadata: true },
          });

          const defaultChannels = ['paid_search', 'organic_search', 'email', 'paid_social', 'direct', 'referral'];

          return {
            attributionModel: typeof input.attributionModel === 'string' ? input.attributionModel : 'last_touch',
            conversionEvent: typeof input.conversionEvent === 'string' ? input.conversionEvent : 'lead',
            channels: Array.isArray(input.channels) ? input.channels : defaultChannels,
            lookbackWindowDays: typeof input.lookbackWindowDays === 'number' ? input.lookbackWindowDays : 30,
            activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').map((c) => ({ id: c.id, title: c.title })),
            marketingGoals: goals.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, title: g.title })),
            instruction: `Perform a ${typeof input.attributionModel === 'string' ? input.attributionModel : 'last_touch'} attribution analysis for the "${typeof input.conversionEvent === 'string' ? input.conversionEvent : 'lead'}" conversion event. Provide: (1) Credit distribution table by channel (%), (2) Comparison vs. last-touch baseline, (3) Channels that appear over- or under-valued by simpler models, (4) Budget implication — which channels deserve more or less investment based on this model, (5) Limitations of this attribution approach for this company.`,
          };
        },
      },

      {
        tool: {
          name: 'analyze_customer_cohorts',
          description: 'Segment customers by acquisition cohort and analyze retention rates, churn, and lifetime value trends.',
          inputSchema: {
            type: 'object',
            properties: {
              cohortDimension: {
                type: 'string',
                description: 'How to define cohorts: "acquisition_month", "acquisition_channel", "campaign", "plan_type"',
              },
              metric: {
                type: 'string',
                description: 'Primary metric to track across cohorts: "retention_rate", "churn_rate", "ltv", "revenue", "engagement_score"',
              },
              periodsToAnalyze: {
                type: 'number',
                description: 'Number of periods (months) to include in cohort analysis (default: 6)',
              },
            },
            required: ['cohortDimension', 'metric'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const customerKnowledge = knowledge.filter((k) =>
            ['customer', 'audience', 'persona', 'ltv', 'churn', 'retention'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ),
          ).map((k) => ({ category: k.category, key: k.key, value: k.value }));

          const periods = typeof input.periodsToAnalyze === 'number' ? input.periodsToAnalyze : 6;

          return {
            cohortDimension: typeof input.cohortDimension === 'string' ? input.cohortDimension : 'acquisition_month',
            metric: typeof input.metric === 'string' ? input.metric : 'retention_rate',
            periodsToAnalyze: periods,
            customerContext: customerKnowledge,
            instruction: `Analyze customer cohorts by ${typeof input.cohortDimension === 'string' ? input.cohortDimension : 'acquisition_month'} tracking ${typeof input.metric === 'string' ? input.metric : 'retention_rate'} over ${periods} periods. Produce: (1) A cohort grid table (rows = cohorts, columns = periods), (2) Trend analysis — are newer cohorts performing better or worse?, (3) LTV projection for each cohort, (4) Key drivers of cohort performance differences, (5) Retention improvement recommendations.`,
          };
        },
      },

      {
        tool: {
          name: 'forecast_performance',
          description: 'Project future marketing performance (traffic, leads, revenue) based on historical trends and planned initiatives.',
          inputSchema: {
            type: 'object',
            properties: {
              metric: {
                type: 'string',
                description: 'Metric to forecast (e.g. "leads", "revenue", "website_traffic", "conversions", "roas")',
              },
              forecastPeriod: {
                type: 'string',
                description: 'Period to forecast (e.g. "next_month", "next_quarter", "next_6_months")',
              },
              plannedChanges: {
                type: 'string',
                description: 'Describe planned budget or strategy changes that should factor into the forecast',
              },
              scenarios: {
                type: 'array',
                items: { type: 'string' },
                description: 'Forecast scenarios to model (e.g. ["conservative", "base", "optimistic"])',
              },
            },
            required: ['metric', 'forecastPeriod'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeGoals = goals.filter((g) => g.status === 'ACTIVE');

          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, title: true, status: true, createdAt: true },
          });

          const defaultScenarios = ['conservative', 'base', 'optimistic'];
          const scenarios = Array.isArray(input.scenarios) ? input.scenarios : defaultScenarios;

          return {
            metric: typeof input.metric === 'string' ? input.metric : 'leads',
            forecastPeriod: typeof input.forecastPeriod === 'string' ? input.forecastPeriod : 'next_quarter',
            plannedChanges: typeof input.plannedChanges === 'string' ? input.plannedChanges : 'no changes planned',
            scenarios,
            activeGoals: activeGoals.map((g) => ({ id: g.id, title: g.title })),
            recentCampaigns: campaigns.map((c) => ({ id: c.id, title: c.title, status: c.status })),
            instruction: `Forecast ${typeof input.metric === 'string' ? input.metric : 'leads'} for ${typeof input.forecastPeriod === 'string' ? input.forecastPeriod : 'next_quarter'}. For each of ${scenarios.join(', ')} scenarios: (1) Point estimate with range, (2) Key assumptions and growth drivers, (3) Risks that could cause underperformance, (4) Required initiatives to hit the optimistic scenario. Express all forecasts with confidence intervals.`,
          };
        },
      },

      {
        tool: {
          name: 'build_executive_dashboard',
          description: 'Structure a C-suite-ready marketing dashboard with the most critical KPIs, trends, and decision-ready insights.',
          inputSchema: {
            type: 'object',
            properties: {
              audience: {
                type: 'string',
                description: 'Target executive audience (e.g. "CEO", "CFO", "CMO", "Board")',
              },
              period: {
                type: 'string',
                description: 'Reporting period (e.g. "this_month", "this_quarter", "ytd")',
              },
              focusArea: {
                type: 'string',
                description: 'Primary area to highlight (e.g. "growth", "efficiency", "pipeline", "brand")',
              },
            },
            required: ['audience'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            include: { tasks: true },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          });

          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);

          const businessContext = knowledge.filter((k) =>
            ['revenue', 'goal', 'target', 'kpi', 'okr', 'north_star'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ),
          ).map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            audience: typeof input.audience === 'string' ? input.audience : 'CMO',
            period: typeof input.period === 'string' ? input.period : 'this_quarter',
            focusArea: typeof input.focusArea === 'string' ? input.focusArea : 'growth',
            activeCampaigns: campaigns.map((c) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              taskCount: c.tasks.length,
            })),
            marketingGoals: goals.map((g) => ({ id: g.id, title: g.title, status: g.status })),
            businessContext,
            instruction: `Build an executive dashboard for ${typeof input.audience === 'string' ? input.audience : 'CMO'} covering ${typeof input.period === 'string' ? input.period : 'this_quarter'}. Include: (1) 3-5 headline KPI cards with trend arrows and vs-target comparison, (2) Marketing funnel health summary, (3) Top campaign performance table (3-5 rows), (4) Goal progress vs. targets, (5) One-paragraph narrative on marketing's contribution to business outcomes, (6) Top 3 decisions needed from leadership. Format as structured sections ready to copy into a slide deck.`,
          };
        },
      },
    ];
  }
}
