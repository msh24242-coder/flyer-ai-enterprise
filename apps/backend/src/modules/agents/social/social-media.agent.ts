import { Injectable, Inject, Scope, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel, Prisma } from '@prisma/client';
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

const PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'tiktok'] as const;
type Platform = (typeof PLATFORMS)[number];

@Injectable({ scope: Scope.REQUEST })
export class SocialMediaAgent extends AgentEngine {
  private readonly socialLogger = new Logger(SocialMediaAgent.name);
  private ctx: AgentExecutionContext | null = null;
  private lastToolName: string | null = null;

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
    const result = await super.execute(context);
    await this.persistContent(context, result.response);
    return result;
  }

  override async executeStream(
    context: AgentExecutionContext,
    onEvent: (event: AgentStreamEventType) => void,
  ): Promise<AgentExecutionResult> {
    this.ctx = context;
    const wrappedOnEvent = (event: AgentStreamEventType) => {
      if (event.type === 'tool_start') this.lastToolName = event.toolName;
      onEvent(event);
    };
    const result = await super.executeStream(context, wrappedOnEvent);
    await this.persistContent(context, result.response);
    return result;
  }

  private async persistContent(context: AgentExecutionContext, response: string): Promise<void> {
    if (!response || response.length < 20) return;
    try {
      const contentType = this.lastToolName ?? 'social_post';
      await this.prisma.generatedContent.create({
        data: {
          companyId: context.companyId,
          agentType: AgentType.SOCIAL,
          contentType,
          title: context.userMessage.slice(0, 100),
          content: response,
          metadata: { model: context.model, tool: contentType } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.socialLogger.error(`Failed to persist social content: ${String(err)}`);
    }
  }

  getIdentity(): AgentIdentity {
    return { agentType: AgentType.SOCIAL, displayName: 'Social Media Agent', version: '1.0.0' };
  }

  async buildSystemPrompt(context: AgentExecutionContext): Promise<string> {
    const knowledge = await this.memoryService.getCompanyKnowledge(context.companyId);
    const brand = knowledge.filter((k) => k.category === 'brand');
    const voice = brand.find((k) => k.key === 'voice')?.value ?? 'professional and engaging';
    const tone = brand.find((k) => k.key === 'tone')?.value ?? 'friendly';
    const companyCtx = (context.additionalContext?.company as Record<string, unknown>) ?? {};

    return `You are a Social Media Agent for ${companyCtx.name ?? 'the company'}.
Your role is to create, schedule, and optimize social media content across platforms.

Brand voice: ${String(voice)}
Brand tone: ${String(tone)}
Industry: ${companyCtx.industry ?? 'Not specified'}

Platform-specific guidelines:
- LinkedIn: Professional, thought leadership, 1300 char limit
- Twitter/X: Concise, punchy, 280 char limit, use hashtags
- Instagram: Visual-first, engaging captions, 2200 char limit, use hashtags
- Facebook: Community-focused, 63206 char limit
- TikTok: Trendy, authentic, short captions

Always align content with brand voice and company values.`;
  }

  defineTools(): AgentToolDefinition[] {
    return [
      {
        tool: {
          name: 'create_social_post',
          description: 'Create a social media post for a specific platform',
          inputSchema: {
            type: 'object',
            properties: {
              platform: { type: 'string', enum: PLATFORMS as unknown as string[], description: 'Target social platform' },
              topic: { type: 'string', description: 'Topic or theme for the post' },
              goal: { type: 'string', description: 'Goal: awareness, engagement, conversion, etc.' },
              campaign_id: { type: 'string', description: 'Optional: associate with a campaign' },
            },
            required: ['platform', 'topic'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge.filter((k) => k.category === 'brand');
          const platform = (input.platform as Platform) ?? 'linkedin';
          const charLimits: Record<Platform, number> = { linkedin: 1300, twitter: 280, instagram: 2200, facebook: 63206, tiktok: 300 };
          return {
            platform,
            charLimit: charLimits[platform] ?? 1300,
            topic: input.topic,
            goal: input.goal ?? 'engagement',
            brandGuidelines: brandKnowledge.map((k) => ({ key: k.key, value: k.value })),
            instruction: `Write a ${platform} post about "${input.topic}" for ${input.goal ?? 'engagement'}, respecting the char limit of ${charLimits[platform] ?? 1300}.`,
          };
        },
      },
      {
        tool: {
          name: 'create_content_calendar',
          description: 'Create a social media content calendar for a given timeframe',
          inputSchema: {
            type: 'object',
            properties: {
              platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms' },
              weeks: { type: 'number', description: 'Number of weeks to plan (default: 4)' },
              themes: { type: 'array', items: { type: 'string' }, description: 'Content themes or topics' },
            },
            required: ['platforms'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const [campaigns, goals] = await Promise.all([
            this.prisma.campaign.findMany({ where: { companyId, status: 'ACTIVE' }, select: { title: true, description: true, endDate: true }, take: 5 }),
            this.prisma.marketingGoal.findMany({ where: { companyId, status: 'ACTIVE' }, select: { title: true, targetDate: true }, take: 5 }),
          ]);
          return {
            platforms: input.platforms,
            weeks: input.weeks ?? 4,
            themes: input.themes ?? [],
            activeCampaigns: campaigns,
            activeGoals: goals,
            instruction: 'Create a detailed content calendar with post ideas, timing, and platform for each week.',
          };
        },
      },
      {
        tool: {
          name: 'analyze_social_performance',
          description: 'Analyze past social media campaign performance from company records',
          inputSchema: {
            type: 'object',
            properties: {
              platform: { type: 'string', description: 'Filter by platform (optional)' },
              limit: { type: 'number', description: 'Number of campaigns to analyze (default: 10)' },
            },
            required: [],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const campaigns = await this.prisma.campaign.findMany({
            where: { companyId },
            take: (input.limit as number) ?? 10,
            orderBy: { createdAt: 'desc' },
          });
          return {
            campaigns: campaigns.map((c) => ({
              title: c.title,
              status: c.status,
              budget: c.budget,
              startDate: c.startDate,
              endDate: c.endDate,
              metadata: c.metadata,
            })),
            instruction: 'Analyze these campaigns and extract social media performance insights.',
          };
        },
      },
      {
        tool: {
          name: 'generate_hashtag_strategy',
          description: 'Generate a hashtag strategy for a campaign or post',
          inputSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'Topic or theme' },
              platform: { type: 'string', description: 'Target platform' },
              style: { type: 'string', enum: ['branded', 'community', 'trending', 'mixed'], description: 'Hashtag style' },
            },
            required: ['topic'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const companyId = this.ctx!.companyId;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandName = knowledge.find((k) => k.key === 'name' || k.key === 'brand_name')?.value ?? '';
          return {
            topic: input.topic,
            platform: input.platform ?? 'all',
            style: input.style ?? 'mixed',
            brandName,
            instruction: `Generate a hashtag strategy for "${input.topic}" on ${input.platform ?? 'all platforms'} in ${input.style ?? 'mixed'} style. Include 10-20 hashtags.`,
          };
        },
      },
    ];
  }
}
