import { Injectable, Inject, Scope } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel, Prisma } from '@prisma/client';
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
export class ContentAgent extends AgentEngine {
  private readonly contentLogger = new Logger(ContentAgent.name);
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
    private readonly marketingRepo: MarketingRepository,
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
      const contentType = this.lastToolName ?? 'general';
      const title = context.userMessage.slice(0, 100);
      await this.prisma.generatedContent.create({
        data: {
          companyId: context.companyId,
          agentType: AgentType.CONTENT,
          contentType,
          title,
          content: response,
          metadata: { model: context.model, tool: contentType } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.contentLogger.error(`Failed to persist generated content: ${String(err)}`);
    }
  }

  getIdentity(): AgentIdentity {
    return {
      agentType: AgentType.CONTENT,
      displayName: 'Content Agent',
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

    const brandKnowledge = knowledge
      .filter((k) =>
        ['brand', 'voice', 'tone', 'style', 'messaging', 'audience'].some((cat) =>
          k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
        ),
      )
      .map((k) => `- [${k.category}/${k.key}]: ${JSON.stringify(k.value)}`)
      .join('\n') || 'No brand guidelines available.';

    return `You are the Content Agent for ${companyName}, operating in the ${industry} industry. You are a senior content strategist and copywriter specializing in marketing copy, social media, email, SEO, and multi-channel content.

## Company: ${companyName}
## Industry: ${industry}

## Brand Guidelines & Voice
${brandKnowledge}

## Your Mission
Create compelling, on-brand content across all marketing channels. Every piece of content must reflect the company's voice, target the right audience, and serve a specific marketing objective.

## Available Tools
- **generate_copy**: Generate marketing copy for any purpose (ads, landing pages, CTAs, headlines)
- **create_social_post**: Create platform-optimized social media posts (LinkedIn, Twitter/X, Instagram, Facebook)
- **create_email_brief**: Draft an email marketing brief with subject lines, preview text, and body structure
- **create_blog_outline**: Build a structured blog post outline with SEO considerations
- **create_ad_copy**: Generate ad copy variants for paid media campaigns
- **create_content_calendar**: Plan a content calendar with scheduled topics and channels
- **rewrite_content**: Rewrite or improve existing content for clarity, SEO, or brand alignment
- **translate_content**: Adapt content for different audiences, markets, or platforms

## Rules
- Always match the company's brand voice from the guidelines above.
- Never fabricate statistics, testimonials, or factual claims — use placeholders if needed.
- For social posts, respect platform-specific character limits and norms.
- Flag when brand guidelines are insufficient to produce on-brand content.
- Base audience targeting on the company knowledge, not external assumptions.`;
  }

  defineTools(): AgentToolDefinition[] {
    const companyId = this.ctx!.companyId;

    return [
      {
        tool: {
          name: 'generate_copy',
          description:
            'Generate marketing copy for any purpose such as landing pages, CTAs, headlines, or value propositions.',
          inputSchema: {
            type: 'object',
            properties: {
              purpose: {
                type: 'string',
                description: 'What the copy is for (e.g. "hero headline", "CTA button", "value proposition")',
              },
              audience: {
                type: 'string',
                description: 'Target audience description',
              },
              tone: {
                type: 'string',
                description: 'Desired tone (e.g. "professional", "conversational", "urgent")',
              },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key terms or phrases to include',
              },
              maxLength: {
                type: 'number',
                description: 'Maximum character count for the copy',
              },
            },
            required: ['purpose'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'voice', 'tone', 'messaging'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            purpose: typeof input.purpose === 'string' ? input.purpose : 'general',
            audience: typeof input.audience === 'string' ? input.audience : undefined,
            tone: typeof input.tone === 'string' ? input.tone : 'professional',
            keywords: Array.isArray(input.keywords) ? input.keywords : [],
            maxLength: typeof input.maxLength === 'number' ? input.maxLength : undefined,
            brandGuidelines: brandKnowledge,
            instruction: 'Use the brand guidelines and the parameters above to write copy. Provide 2-3 variants.',
          };
        },
      },

      {
        tool: {
          name: 'create_social_post',
          description:
            'Create platform-optimized social media posts for LinkedIn, Twitter/X, Instagram, or Facebook.',
          inputSchema: {
            type: 'object',
            properties: {
              platform: {
                type: 'string',
                enum: ['linkedin', 'twitter', 'instagram', 'facebook'],
                description: 'Target social platform',
              },
              topic: {
                type: 'string',
                description: 'Post topic or key message',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign ID this post belongs to',
              },
              includeHashtags: {
                type: 'boolean',
                description: 'Whether to suggest relevant hashtags',
              },
              callToAction: {
                type: 'string',
                description: 'Desired call to action (e.g. "visit our website", "sign up today")',
              },
            },
            required: ['platform', 'topic'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const platform = typeof input.platform === 'string' ? input.platform : 'linkedin';
          const characterLimits: Record<string, number> = {
            linkedin: 3000,
            twitter: 280,
            instagram: 2200,
            facebook: 63206,
          };

          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const audienceKnowledge = knowledge
            .filter((k) => ['audience', 'customer', 'persona'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            platform,
            characterLimit: characterLimits[platform] ?? 1000,
            topic: typeof input.topic === 'string' ? input.topic : '',
            includeHashtags: typeof input.includeHashtags === 'boolean' ? input.includeHashtags : true,
            callToAction: typeof input.callToAction === 'string' ? input.callToAction : undefined,
            audienceData: audienceKnowledge,
            instruction: `Write a ${platform} post within the ${characterLimits[platform] ?? 1000} character limit. Provide 2 variants.`,
          };
        },
      },

      {
        tool: {
          name: 'create_email_brief',
          description:
            'Draft an email marketing brief including subject line options, preview text, and body structure.',
          inputSchema: {
            type: 'object',
            properties: {
              emailType: {
                type: 'string',
                description: 'Type of email (e.g. "newsletter", "promotional", "welcome", "drip", "re-engagement")',
              },
              objective: {
                type: 'string',
                description: 'Primary email objective',
              },
              audience: {
                type: 'string',
                description: 'Target audience segment',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign ID this email supports',
              },
              keyOffer: {
                type: 'string',
                description: 'Main value proposition or offer in the email',
              },
            },
            required: ['emailType', 'objective'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'voice', 'tone', 'messaging', 'audience'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            emailType: typeof input.emailType === 'string' ? input.emailType : 'newsletter',
            objective: typeof input.objective === 'string' ? input.objective : '',
            audience: typeof input.audience === 'string' ? input.audience : 'all subscribers',
            keyOffer: typeof input.keyOffer === 'string' ? input.keyOffer : undefined,
            brandGuidelines: brandKnowledge,
            instruction: 'Create an email brief with: 3 subject line options, preview text, header, body sections, CTA, footer note. Keep subject lines under 50 characters.',
          };
        },
      },

      {
        tool: {
          name: 'create_blog_outline',
          description:
            'Build a structured blog post outline with SEO title, meta description, headings, and key points.',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Blog post topic',
              },
              targetKeyword: {
                type: 'string',
                description: 'Primary SEO keyword to optimize for',
              },
              audience: {
                type: 'string',
                description: 'Intended reader (e.g. "B2B decision-makers", "first-time buyers")',
              },
              wordCount: {
                type: 'number',
                description: 'Target word count (e.g. 1000, 1500, 2000)',
              },
              contentGoal: {
                type: 'string',
                description: 'Content goal (e.g. "thought leadership", "product education", "lead generation")',
              },
            },
            required: ['topic'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const productKnowledge = knowledge
            .filter((k) => ['product', 'service', 'feature', 'usp', 'positioning'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            topic: typeof input.topic === 'string' ? input.topic : '',
            targetKeyword: typeof input.targetKeyword === 'string' ? input.targetKeyword : undefined,
            audience: typeof input.audience === 'string' ? input.audience : 'general audience',
            wordCount: typeof input.wordCount === 'number' ? input.wordCount : 1200,
            contentGoal: typeof input.contentGoal === 'string' ? input.contentGoal : 'thought leadership',
            productContext: productKnowledge,
            instruction: 'Create: SEO title (≤60 chars), meta description (≤160 chars), H1, 4-6 H2 sections with bullet points, conclusion with CTA.',
          };
        },
      },

      {
        tool: {
          name: 'create_ad_copy',
          description:
            'Generate ad copy variants for paid media campaigns across Google Ads, Meta, LinkedIn Ads, or display.',
          inputSchema: {
            type: 'object',
            properties: {
              adPlatform: {
                type: 'string',
                description: 'Ad platform (e.g. "google", "meta", "linkedin", "display")',
              },
              adType: {
                type: 'string',
                description: 'Ad format (e.g. "search", "responsive", "carousel", "video script", "display banner")',
              },
              offer: {
                type: 'string',
                description: 'The offer or value proposition to promote',
              },
              audience: {
                type: 'string',
                description: 'Target audience for the ad',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign ID this ad belongs to',
              },
            },
            required: ['adPlatform', 'offer'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const uspKnowledge = knowledge
            .filter((k) => ['usp', 'competitive', 'advantage', 'value', 'product'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          const adPlatform = typeof input.adPlatform === 'string' ? input.adPlatform : 'google';
          const charLimits: Record<string, { headline: number; description: number }> = {
            google: { headline: 30, description: 90 },
            meta: { headline: 40, description: 125 },
            linkedin: { headline: 70, description: 300 },
            display: { headline: 25, description: 90 },
          };
          const limits = charLimits[adPlatform] ?? { headline: 40, description: 125 };

          return {
            adPlatform,
            adType: typeof input.adType === 'string' ? input.adType : 'responsive',
            offer: typeof input.offer === 'string' ? input.offer : '',
            audience: typeof input.audience === 'string' ? input.audience : undefined,
            characterLimits: limits,
            uspContext: uspKnowledge,
            instruction: `Create 3 headline variants (≤${limits.headline} chars each) and 2 description variants (≤${limits.description} chars each) for ${adPlatform} ads.`,
          };
        },
      },

      {
        tool: {
          name: 'create_content_calendar',
          description:
            'Plan a content calendar with topics, publish dates, channels, and formats for a given time period.',
          inputSchema: {
            type: 'object',
            properties: {
              duration: {
                type: 'string',
                description: 'Calendar duration (e.g. "2 weeks", "1 month", "Q4 2026")',
              },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Channels to include (e.g. ["blog", "linkedin", "email", "instagram"])',
              },
              postsPerWeek: {
                type: 'number',
                description: 'Approximate number of posts per week across all channels',
              },
              themes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Content themes or topics to cover',
              },
              goalId: {
                type: 'string',
                description: 'Optional marketing goal ID this calendar supports',
              },
            },
            required: ['duration'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeGoals = goals.filter((g) => g.status === 'ACTIVE');

          const calendarData = {
            duration: typeof input.duration === 'string' ? input.duration : '1 month',
            channels: Array.isArray(input.channels) ? input.channels : ['blog', 'linkedin', 'email'],
            postsPerWeek: typeof input.postsPerWeek === 'number' ? input.postsPerWeek : 5,
            themes: Array.isArray(input.themes) ? input.themes : [],
            createdAt: new Date().toISOString(),
          };

          const campaign = await this.marketingRepo.createCampaign(companyId, {
            title: `[Content Calendar] ${calendarData.duration}`,
            description: `Content calendar for ${calendarData.duration} across ${calendarData.channels.join(', ')}`,
            goalId: typeof input.goalId === 'string' ? input.goalId : undefined,
            metadata: calendarData as Record<string, unknown>,
          });

          await this.memoryService.enqueueMemoryWrite({
            companyId,
            agentType: AgentType.CONTENT,
            memoryType: 'DECISION',
            content: `Content calendar created for ${calendarData.duration}. Channels: ${calendarData.channels.join(', ')}.`,
            conversationId: this.ctx?.conversationId,
          });

          const audienceKnowledge = knowledge
            .filter((k) => ['audience', 'customer', 'persona'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            calendarId: campaign.id,
            calendar: calendarData,
            activeGoals: activeGoals.map((g) => ({ id: g.id, title: g.title })),
            audienceContext: audienceKnowledge,
            instruction: 'Generate a weekly content calendar table with: date, channel, content type, topic, key message, CTA.',
          };
        },
      },

      {
        tool: {
          name: 'rewrite_content',
          description:
            'Rewrite or improve existing content for clarity, brand alignment, SEO, or a different audience.',
          inputSchema: {
            type: 'object',
            properties: {
              originalContent: {
                type: 'string',
                description: 'The content to rewrite',
              },
              goal: {
                type: 'string',
                description: 'Rewrite goal (e.g. "improve clarity", "align with brand voice", "make more concise", "SEO optimization")',
              },
              targetAudience: {
                type: 'string',
                description: 'Target audience for the rewritten content',
              },
              preserveLength: {
                type: 'boolean',
                description: 'Whether to preserve the approximate length of the original',
              },
            },
            required: ['originalContent', 'goal'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'voice', 'tone', 'style'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          const originalContent = typeof input.originalContent === 'string' ? input.originalContent : '';
          return {
            originalContent: originalContent.slice(0, 5000),
            goal: typeof input.goal === 'string' ? input.goal : 'improve clarity',
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : undefined,
            preserveLength: typeof input.preserveLength === 'boolean' ? input.preserveLength : false,
            brandGuidelines: brandKnowledge,
            wordCount: originalContent.split(/\s+/).length,
            instruction: 'Rewrite the content according to the goal. Show the rewritten version followed by a short list of key changes made.',
          };
        },
      },

      {
        tool: {
          name: 'translate_content',
          description:
            'Adapt content for a different audience, market, or communication channel while preserving the core message.',
          inputSchema: {
            type: 'object',
            properties: {
              originalContent: {
                type: 'string',
                description: 'The content to adapt',
              },
              targetFormat: {
                type: 'string',
                description: 'Target format or channel (e.g. "LinkedIn post", "executive summary", "technical documentation", "press release")',
              },
              targetAudience: {
                type: 'string',
                description: 'Target audience for the adapted content',
              },
              language: {
                type: 'string',
                description: 'Target language if translating (e.g. "Spanish", "French") — leave blank for same language',
              },
            },
            required: ['originalContent', 'targetFormat'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const originalContent = typeof input.originalContent === 'string' ? input.originalContent : '';
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'voice', 'messaging'].some((cat) =>
              k.category.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            originalContent: originalContent.slice(0, 5000),
            targetFormat: typeof input.targetFormat === 'string' ? input.targetFormat : 'general',
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : undefined,
            language: typeof input.language === 'string' && input.language ? input.language : 'English',
            wordCount: originalContent.split(/\s+/).length,
            brandGuidelines: brandKnowledge,
            instruction: 'Adapt the content to the target format and audience. Preserve the core message and key facts.',
          };
        },
      },
    ];
  }
}
