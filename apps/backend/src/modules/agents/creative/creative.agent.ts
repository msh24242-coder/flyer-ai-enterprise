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
import { MarketingRepository } from '../../marketing-director/repositories/marketing.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class CreativeAgent extends AgentEngine {
  private readonly creativeLogger = new Logger(CreativeAgent.name);
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
    await this.persistCreative(context, result.response);
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
    await this.persistCreative(context, result.response);
    return result;
  }

  private async persistCreative(context: AgentExecutionContext, response: string): Promise<void> {
    if (!response || response.length < 20) return;
    try {
      const contentType = this.lastToolName ?? 'creative_brief';
      const title = context.userMessage.slice(0, 100);
      await this.prisma.generatedContent.create({
        data: {
          companyId: context.companyId,
          agentType: AgentType.CREATIVE,
          contentType,
          title,
          content: response,
          metadata: { model: context.model, tool: contentType } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.creativeLogger.error(`Failed to persist creative output: ${String(err)}`);
    }
  }

  getIdentity(): AgentIdentity {
    return {
      agentType: AgentType.CREATIVE,
      displayName: 'Creative Agent',
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

    const brandGuidelines = knowledge
      .filter((k) =>
        ['brand', 'color', 'logo', 'visual', 'design', 'style', 'font', 'typography'].some((cat) =>
          k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
        ),
      )
      .map((k) => `- [${k.category}/${k.key}]: ${JSON.stringify(k.value)}`)
      .join('\n') || 'No visual brand guidelines available — apply best-practice design principles.';

    return `You are the Creative Agent for ${companyName}, operating in the ${industry} industry. You are a senior creative director specializing in brand identity, visual strategy, creative briefs, and campaign concepting.

## Company: ${companyName}
## Industry: ${industry}

## Visual Brand Guidelines
${brandGuidelines}

## Your Mission
Develop creative strategies, visual concepts, and design briefs that bring marketing campaigns to life. You translate marketing objectives into compelling creative directions that resonate with target audiences.

## Available Tools
- **create_creative_brief**: Create a comprehensive creative brief for a campaign or asset
- **develop_visual_concept**: Develop a visual concept with mood, palette, typography, and imagery direction
- **create_brand_guidelines**: Define or refine brand identity guidelines (colors, fonts, voice, logo rules)
- **generate_campaign_concept**: Conceive a complete campaign with big idea, tagline, and cross-channel executions
- **create_design_brief**: Write a detailed design brief for a specific asset (banner, landing page, deck)
- **audit_brand_consistency**: Audit brand consistency across touchpoints and identify gaps
- **create_style_guide_section**: Draft a section of a brand style guide

## Rules
- Ground all creative direction in the company's existing brand guidelines when available.
- Provide specific, actionable creative direction — not vague adjectives.
- Always include rationale explaining why creative choices serve the marketing objective.
- When visual guidelines are missing, propose them rather than leaving blanks.
- Flag any creative directions that may conflict with existing brand identity.`;
  }

  defineTools(): AgentToolDefinition[] {
    const companyId = this.ctx!.companyId;

    return [
      {
        tool: {
          name: 'create_creative_brief',
          description: 'Create a comprehensive creative brief for a marketing campaign or creative asset.',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: { type: 'string', description: 'Name of the project or campaign' },
              objective: { type: 'string', description: 'Primary marketing objective this creative serves' },
              targetAudience: { type: 'string', description: 'Detailed target audience description' },
              keyMessage: { type: 'string', description: 'Single most important message to communicate' },
              deliverables: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of creative deliverables (e.g. ["hero banner", "social graphics", "email header"])',
              },
              budget: { type: 'string', description: 'Creative production budget range' },
              timeline: { type: 'string', description: 'Project timeline or deadline' },
              campaignId: { type: 'string', description: 'Optional associated campaign ID' },
            },
            required: ['projectName', 'objective'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'visual', 'design', 'voice', 'color'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeGoals = goals.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, title: g.title }));

          return {
            projectName: typeof input.projectName === 'string' ? input.projectName : '',
            objective: typeof input.objective === 'string' ? input.objective : '',
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : 'general audience',
            keyMessage: typeof input.keyMessage === 'string' ? input.keyMessage : undefined,
            deliverables: Array.isArray(input.deliverables) ? input.deliverables : [],
            budget: typeof input.budget === 'string' ? input.budget : 'TBD',
            timeline: typeof input.timeline === 'string' ? input.timeline : 'TBD',
            brandGuidelines: brandKnowledge,
            activeGoals,
            instruction: 'Create a complete creative brief with sections: Project Overview, Objective, Target Audience, Key Message, Tone & Manner, Mandatories, Deliverables, Timeline, Success Metrics.',
          };
        },
      },

      {
        tool: {
          name: 'develop_visual_concept',
          description: 'Develop a visual concept including mood, color palette, typography, and imagery direction.',
          inputSchema: {
            type: 'object',
            properties: {
              concept: { type: 'string', description: 'The core creative concept or big idea to visualize' },
              emotion: { type: 'string', description: 'Primary emotion the visuals should evoke' },
              audience: { type: 'string', description: 'Target audience for this visual direction' },
              channel: { type: 'string', description: 'Primary channel (e.g. "digital ads", "OOH", "social media", "print")' },
              referenceStyle: { type: 'string', description: 'Optional: describe a visual style reference or inspiration' },
            },
            required: ['concept'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const visualGuidelines = knowledge
            .filter((k) => ['color', 'font', 'typography', 'visual', 'logo', 'brand'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            concept: typeof input.concept === 'string' ? input.concept : '',
            emotion: typeof input.emotion === 'string' ? input.emotion : 'professional',
            audience: typeof input.audience === 'string' ? input.audience : 'general',
            channel: typeof input.channel === 'string' ? input.channel : 'digital',
            referenceStyle: typeof input.referenceStyle === 'string' ? input.referenceStyle : undefined,
            existingVisualGuidelines: visualGuidelines,
            instruction: 'Develop a visual concept with: Mood Board Description, Color Palette (primary/secondary/accent with hex codes), Typography (heading/body/accent fonts), Photography/Illustration Direction, Layout Principles, and Sample Execution Description for the primary channel.',
          };
        },
      },

      {
        tool: {
          name: 'create_brand_guidelines',
          description: 'Define or refine brand identity guidelines including colors, fonts, logo usage, and voice.',
          inputSchema: {
            type: 'object',
            properties: {
              section: {
                type: 'string',
                enum: ['colors', 'typography', 'logo', 'voice', 'imagery', 'full'],
                description: 'Which section of brand guidelines to create',
              },
              currentBrand: { type: 'string', description: 'Description of current brand identity (if exists)' },
              targetPositioning: { type: 'string', description: 'Desired brand positioning statement' },
            },
            required: ['section'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const existingBrand = knowledge
            .filter((k) => ['brand', 'color', 'font', 'logo', 'voice'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          await this.memoryService.enqueueMemoryWrite({
            companyId,
            agentType: AgentType.CREATIVE,
            memoryType: 'LESSON',
            content: `Brand guidelines section "${String(input.section ?? 'full')}" created/updated.`,
            conversationId: this.ctx?.conversationId,
          });

          return {
            section: typeof input.section === 'string' ? input.section : 'full',
            currentBrand: typeof input.currentBrand === 'string' ? input.currentBrand : undefined,
            targetPositioning: typeof input.targetPositioning === 'string' ? input.targetPositioning : undefined,
            existingBrandData: existingBrand,
            instruction: `Create detailed brand guidelines for the "${String(input.section ?? 'full')}" section. Include specific values (hex codes for colors, font names and weights, clear do/don't rules). Make it actionable for designers and content creators.`,
          };
        },
      },

      {
        tool: {
          name: 'generate_campaign_concept',
          description: 'Conceive a complete marketing campaign with a big idea, tagline, and cross-channel executions.',
          inputSchema: {
            type: 'object',
            properties: {
              campaignObjective: { type: 'string', description: 'Primary objective (e.g. "awareness", "conversion", "retention")' },
              targetAudience: { type: 'string', description: 'Target audience for this campaign' },
              budget: { type: 'string', description: 'Campaign budget range' },
              duration: { type: 'string', description: 'Campaign duration (e.g. "4 weeks", "Q3 2026")' },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Channels to include (e.g. ["social", "display", "email", "OOH"])',
              },
              competitorContext: { type: 'string', description: 'Brief description of competitor creative landscape' },
              goalId: { type: 'string', description: 'Optional marketing goal ID this campaign serves' },
            },
            required: ['campaignObjective'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'voice', 'visual', 'audience', 'usp', 'positioning'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          const goals = await this.marketingRepo.listGoals(companyId, undefined);
          const activeGoals = goals.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, title: g.title }));

          const campaign = await this.marketingRepo.createCampaign(companyId, {
            title: `[Creative] ${typeof input.campaignObjective === 'string' ? input.campaignObjective.slice(0, 60) : 'New Campaign'}`,
            description: `Creative campaign concept — ${typeof input.duration === 'string' ? input.duration : 'TBD'}`,
            goalId: typeof input.goalId === 'string' ? input.goalId : undefined,
            metadata: {
              objective: input.campaignObjective,
              channels: Array.isArray(input.channels) ? input.channels : [],
              duration: input.duration,
              createdBy: 'creative_agent',
            } as Record<string, unknown>,
          });

          return {
            campaignId: campaign.id,
            campaignObjective: typeof input.campaignObjective === 'string' ? input.campaignObjective : '',
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : 'general audience',
            channels: Array.isArray(input.channels) ? input.channels : ['social', 'email', 'display'],
            duration: typeof input.duration === 'string' ? input.duration : '4 weeks',
            budget: typeof input.budget === 'string' ? input.budget : 'TBD',
            competitorContext: typeof input.competitorContext === 'string' ? input.competitorContext : undefined,
            brandContext: brandKnowledge,
            activeGoals,
            instruction: 'Generate a complete campaign concept with: Campaign Name, Big Idea (1-2 sentences), Tagline (≤7 words), Strategic Rationale, Visual Direction, Channel-by-channel execution plan, Key Messages per audience segment, and Success Metrics.',
          };
        },
      },

      {
        tool: {
          name: 'create_design_brief',
          description: 'Write a detailed design brief for a specific marketing asset such as a banner, landing page, or deck.',
          inputSchema: {
            type: 'object',
            properties: {
              assetType: { type: 'string', description: 'Asset type (e.g. "web banner", "landing page", "pitch deck", "social template", "email template")' },
              dimensions: { type: 'string', description: 'Asset dimensions or format (e.g. "1200x628px", "A4", "16:9")' },
              primaryMessage: { type: 'string', description: 'Primary message or headline for the asset' },
              callToAction: { type: 'string', description: 'Call to action text' },
              platform: { type: 'string', description: 'Where the asset will be used' },
              urgency: { type: 'string', description: 'Deadline or urgency level' },
            },
            required: ['assetType', 'primaryMessage'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const visualGuidelines = knowledge
            .filter((k) => ['color', 'font', 'logo', 'brand', 'visual'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            assetType: typeof input.assetType === 'string' ? input.assetType : 'banner',
            dimensions: typeof input.dimensions === 'string' ? input.dimensions : 'TBD',
            primaryMessage: typeof input.primaryMessage === 'string' ? input.primaryMessage : '',
            callToAction: typeof input.callToAction === 'string' ? input.callToAction : undefined,
            platform: typeof input.platform === 'string' ? input.platform : undefined,
            urgency: typeof input.urgency === 'string' ? input.urgency : 'standard',
            brandGuidelines: visualGuidelines,
            instruction: 'Create a design brief with: Asset Specifications, Layout Grid, Content Hierarchy, Copy Blocks (with exact text), Visual Elements, Color Application, Typography Rules, Do\'s and Don\'ts, and File Format Requirements.',
          };
        },
      },

      {
        tool: {
          name: 'audit_brand_consistency',
          description: 'Audit brand consistency across marketing touchpoints and identify inconsistencies or gaps.',
          inputSchema: {
            type: 'object',
            properties: {
              touchpoints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Touchpoints to audit (e.g. ["website", "email", "social media", "ads", "print"])',
              },
              focusArea: {
                type: 'string',
                enum: ['visual', 'voice', 'messaging', 'all'],
                description: 'Area to focus audit on',
              },
            },
            required: ['touchpoints'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const brandKnowledge = knowledge
            .filter((k) => ['brand', 'color', 'font', 'logo', 'voice', 'visual', 'messaging'].some((cat) =>
              k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
            ))
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            touchpoints: Array.isArray(input.touchpoints) ? input.touchpoints : ['website', 'social media', 'email'],
            focusArea: typeof input.focusArea === 'string' ? input.focusArea : 'all',
            brandStandards: brandKnowledge,
            instruction: 'Produce a brand consistency audit report with: Executive Summary, Touchpoint-by-Touchpoint assessment (pass/fail/partial for visual, voice, messaging), Identified Inconsistencies with severity (high/medium/low), Priority Fixes, and a Brand Consistency Score (0-100).',
          };
        },
      },

      {
        tool: {
          name: 'create_style_guide_section',
          description: 'Draft a specific section of a brand style guide for use by design and content teams.',
          inputSchema: {
            type: 'object',
            properties: {
              section: { type: 'string', description: 'Section name (e.g. "Color System", "Typography Scale", "Icon Usage", "Photography Style", "Illustration Guidelines")' },
              audience: { type: 'string', description: 'Who will use this guide section (e.g. "designers", "content creators", "developers")' },
              format: { type: 'string', description: 'Output format (e.g. "Figma-ready specs", "narrative guide", "rules list")' },
            },
            required: ['section'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const relevantKnowledge = knowledge
            .filter((k) => {
              const sectionName = typeof input.section === 'string' ? input.section.toLowerCase() : '';
              return ['brand', 'visual', 'design', 'color', 'font', 'typography', 'logo'].some((cat) =>
                sectionName.includes(cat) || k.category.toLowerCase().includes(cat) || k.key.toLowerCase().includes(cat),
              );
            })
            .map((k) => ({ category: k.category, key: k.key, value: k.value }));

          return {
            section: typeof input.section === 'string' ? input.section : 'General',
            audience: typeof input.audience === 'string' ? input.audience : 'designers and content creators',
            format: typeof input.format === 'string' ? input.format : 'narrative guide',
            existingBrandData: relevantKnowledge,
            instruction: `Write the "${String(input.section ?? 'General')}" section of the brand style guide. Include: Purpose, Rules with rationale, Specific values/specs, Visual examples described in text, Common mistakes to avoid. Make it actionable for ${typeof input.audience === 'string' ? input.audience : 'the target audience'}.`,
          };
        },
      },
    ];
  }
}
