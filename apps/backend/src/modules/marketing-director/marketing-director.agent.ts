import { Injectable, Inject, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, PermissionLevel, MemoryType } from '@prisma/client';
import { AgentEngine } from '../agent-engine/base/agent-engine.abstract';
import { AgentToolDefinition, AgentExecutionContext, AgentIdentity, AgentExecutionResult, AgentStreamEventType } from '../agent-engine/base/agent-engine.types';
import { IAIProvider } from '../agent-engine/providers/ai/ai-provider.interface';
import { IEmbeddingProvider } from '../agent-engine/providers/embedding/embedding-provider.interface';
import { MemoryService } from '../agent-engine/memory/memory.service';
import { ApprovalEngineService } from '../agent-engine/approval/approval-engine.service';
import { ObservabilityTracerService } from '../agent-engine/observability/observability-tracer.service';
import { AgentOrchestratorService } from '../agent-engine/orchestration/agent-orchestrator.service';
import { AI_PROVIDER, EMBEDDING_PROVIDER } from '../agent-engine/agent-engine.constants';
import { MarketingRepository } from './repositories/marketing.repository';

interface CompanyKnowledgeEntry {
  category: string;
  key: string;
  value: unknown;
}

interface CompanyContextData {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  knowledge: CompanyKnowledgeEntry[];
}

@Injectable({ scope: Scope.REQUEST })
export class MarketingDirectorAgent extends AgentEngine {
  // Captured per-request; safe because scope is REQUEST
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
  ) {
    super(aiProvider, embeddingProvider, memoryService, approvalEngine, tracer, orchestrator, config);
  }

  // Capture context before super.execute() calls defineTools()
  override async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    this.ctx = context;
    return super.execute(context);
  }

  // Same as execute() above — executeStream() also calls defineTools() internally,
  // and was missing this override entirely (only reachable once run/stream became a
  // real callable POST route; ctx was always null on this path before that).
  override async executeStream(
    context: AgentExecutionContext,
    onEvent: (event: AgentStreamEventType) => void,
  ): Promise<AgentExecutionResult> {
    this.ctx = context;
    return super.executeStream(context, onEvent);
  }

  getIdentity(): AgentIdentity {
    return {
      agentType: AgentType.DIRECTOR,
      displayName: 'Marketing Director',
      version: '1.0.0',
    };
  }

  async buildSystemPrompt(context: AgentExecutionContext): Promise<string> {
    const company = context.additionalContext?.company as CompanyContextData | undefined;
    const companyName = company?.name ?? 'your company';
    const industry = company?.industry ? `**Industry**: ${company.industry}` : '';
    const website = company?.website ? `**Website**: ${company.website}` : '';

    const knowledgeSection = this.formatKnowledge(company?.knowledge ?? []);

    return `You are the Marketing Director AI for ${companyName}. You are a senior marketing manager with deep expertise in marketing strategy, campaign planning, and brand development.

## Your Role
You analyze marketing situations, recommend strategies, create campaigns and tasks, and store important business insights. You help the team make data-driven marketing decisions aligned with company goals.

## Company Profile
**Company**: ${companyName}
${industry}
${website}

## Company Knowledge Base
${knowledgeSection}

## Available Tools

### READ Tools (always permitted)
- **get_company_knowledge**: Retrieve brand, audience, product, or other company knowledge
- **list_marketing_goals**: List current marketing goals by status
- **list_campaigns**: List campaigns (optionally filter by goal or status)
- **search_memory**: Search past decisions, insights, and conversation history semantically

### WRITE Tools (require WRITE permission)
- **create_marketing_goal**: Create a new marketing goal with measurable objectives
- **create_campaign**: Create a campaign linked to a goal
- **update_campaign**: Update a campaign's details or status
- **create_task**: Create a task (optionally linked to a campaign)
- **update_task**: Update a task's status, priority, or details
- **store_insight**: Store an important strategic insight for future reference

## Tool Usage Rules
1. Always check existing goals and campaigns before creating new ones to avoid duplication.
2. Use get_company_knowledge to understand brand context before making recommendations.
3. Link campaigns to goals whenever possible for traceability.
4. Store important strategic decisions with store_insight so they are available in future sessions.
5. Be specific and measurable when creating goals and campaigns.
6. Always explain your reasoning before taking a write action.

## Important Limitations
- You can ONLY access ${companyName}'s data. You have NO access to any other company's information.
- You do NOT have access to the internet or real-time market data.
- You CANNOT publish campaigns, send emails, post on social media, or change ad budgets. Those actions require explicit human approval and are not available in this phase.
- All tool calls are logged for audit and compliance.

## Memory System
- Use search_memory to find relevant past decisions and insights before making recommendations.
- Use store_insight to record important strategic decisions, brand learnings, and campaign insights.
- Memories are scoped to ${companyName} only.

Be specific, actionable, and data-driven. Always ground recommendations in the company's actual goals and knowledge base.`;
  }

  defineTools(): AgentToolDefinition[] {
    // ctx is guaranteed to be set before defineTools() is called (see execute() override)
    const companyId = this.ctx!.companyId;

    return [
      // ── READ tools ──────────────────────────────────────────────────────────

      {
        tool: {
          name: 'get_company_knowledge',
          description:
            'Retrieve entries from the company knowledge base. Filter by category (e.g. "brand", "audience", "products").',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Optional category to filter by (e.g. "brand", "audience", "products")',
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const category = typeof input.category === 'string' ? input.category : undefined;
          const knowledge = await this.memoryService.getCompanyKnowledge(companyId);
          const filtered = category ? knowledge.filter((k) => k.category === category) : knowledge;
          return filtered.map((k) => ({ category: k.category, key: k.key, value: k.value }));
        },
      },

      {
        tool: {
          name: 'list_marketing_goals',
          description: 'List marketing goals for the company, optionally filtered by status.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Optional status filter',
                enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const status = typeof input.status === 'string' ? input.status : undefined;
          const goals = await this.marketingRepo.listGoals(companyId, status as never);
          return goals.map((g) => ({
            id: g.id,
            title: g.title,
            description: g.description,
            status: g.status,
            targetDate: g.targetDate,
            metrics: g.metrics,
          }));
        },
      },

      {
        tool: {
          name: 'list_campaigns',
          description:
            'List campaigns for the company. Optionally filter by goal ID or status.',
          inputSchema: {
            type: 'object',
            properties: {
              goalId: {
                type: 'string',
                description: 'Optional goal ID to filter campaigns',
              },
              status: {
                type: 'string',
                description: 'Optional status filter',
                enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
              },
            },
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const goalId = typeof input.goalId === 'string' ? input.goalId : undefined;
          const status = typeof input.status === 'string' ? input.status : undefined;
          const campaigns = await this.marketingRepo.listCampaigns(companyId, goalId, status as never);
          return campaigns.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            status: c.status,
            goalId: c.goalId,
            startDate: c.startDate,
            endDate: c.endDate,
            budget: c.budget,
          }));
        },
      },

      {
        tool: {
          name: 'search_memory',
          description:
            'Search past decisions, insights, and conversation history using semantic similarity. Use this to find relevant past context before making recommendations.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The semantic search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default 5)',
              },
            },
            required: ['query'],
          },
        },
        permissionLevel: PermissionLevel.READ,
        handler: async (input) => {
          const query = String(input.query);
          const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 5;
          try {
            const embeddingResp = await this.embeddingProvider.embed({ texts: [query] });
            const queryEmbedding = embeddingResp.embeddings[0];
            const results = await this.memoryService.searchSemanticMemory({
              companyId,
              agentType: AgentType.DIRECTOR,
              queryEmbedding,
              topK: limit,
            });
            return results.map((r) => ({
              content: r.content,
              memoryType: r.memoryType,
              similarity: r.similarity,
              createdAt: r.createdAt,
            }));
          } catch {
            // Gracefully degrade if pgvector / embedding is unavailable
            return [];
          }
        },
      },

      // ── WRITE tools ─────────────────────────────────────────────────────────

      {
        tool: {
          name: 'create_marketing_goal',
          description:
            'Create a new marketing goal. Goals should be specific and measurable.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Goal title (concise, actionable)',
              },
              description: {
                type: 'string',
                description: 'Detailed description of the goal',
              },
              targetDate: {
                type: 'string',
                description: 'ISO date string for the target completion date',
              },
              metrics: {
                type: 'object',
                description: 'Key metrics to measure success (e.g. { "targetLeads": 500, "channel": "LinkedIn" })',
              },
            },
            required: ['title'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const goal = await this.marketingRepo.createGoal(companyId, {
            title: String(input.title),
            description: typeof input.description === 'string' ? input.description : undefined,
            targetDate: typeof input.targetDate === 'string' ? input.targetDate : undefined,
            metrics: typeof input.metrics === 'object' && input.metrics !== null
              ? (input.metrics as Record<string, unknown>)
              : undefined,
          });
          return { id: goal.id, title: goal.title, status: goal.status, createdAt: goal.createdAt };
        },
      },

      {
        tool: {
          name: 'create_campaign',
          description: 'Create a new marketing campaign, optionally linked to a goal.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Campaign name',
              },
              description: {
                type: 'string',
                description: 'Campaign description and objectives',
              },
              goalId: {
                type: 'string',
                description: 'Optional ID of the marketing goal this campaign supports',
              },
              startDate: {
                type: 'string',
                description: 'ISO date string for campaign start',
              },
              endDate: {
                type: 'string',
                description: 'ISO date string for campaign end',
              },
              budget: {
                type: 'number',
                description: 'Campaign budget in USD',
              },
            },
            required: ['title'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const campaign = await this.marketingRepo.createCampaign(companyId, {
            title: String(input.title),
            description: typeof input.description === 'string' ? input.description : undefined,
            goalId: typeof input.goalId === 'string' ? input.goalId : undefined,
            startDate: typeof input.startDate === 'string' ? input.startDate : undefined,
            endDate: typeof input.endDate === 'string' ? input.endDate : undefined,
            budget: typeof input.budget === 'number' ? input.budget : undefined,
          });
          return { id: campaign.id, title: campaign.title, status: campaign.status, goalId: campaign.goalId };
        },
      },

      {
        tool: {
          name: 'update_campaign',
          description: 'Update an existing campaign. Must be the company\'s own campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: {
                type: 'string',
                description: 'ID of the campaign to update',
              },
              title: { type: 'string' },
              description: { type: 'string' },
              status: {
                type: 'string',
                enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
              },
              budget: { type: 'number' },
            },
            required: ['campaignId'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const campaignId = String(input.campaignId);
          const updated = await this.marketingRepo.updateCampaign(companyId, campaignId, {
            title: typeof input.title === 'string' ? input.title : undefined,
            description: typeof input.description === 'string' ? input.description : undefined,
            status: typeof input.status === 'string' ? (input.status as never) : undefined,
            budget: typeof input.budget === 'number' ? input.budget : undefined,
          });
          if (!updated) return { error: 'Campaign not found or access denied' };
          return { id: updated.id, title: updated.title, status: updated.status };
        },
      },

      {
        tool: {
          name: 'create_task',
          description: 'Create a task, optionally linked to a campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Task title',
              },
              description: {
                type: 'string',
                description: 'Task details and acceptance criteria',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign ID to link this task to',
              },
              priority: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              },
              dueDate: {
                type: 'string',
                description: 'ISO date string for task due date',
              },
            },
            required: ['title'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const task = await this.marketingRepo.createTask(companyId, {
            title: String(input.title),
            description: typeof input.description === 'string' ? input.description : undefined,
            campaignId: typeof input.campaignId === 'string' ? input.campaignId : undefined,
            priority: typeof input.priority === 'string' ? (input.priority as never) : undefined,
            dueDate: typeof input.dueDate === 'string' ? input.dueDate : undefined,
          });
          return { id: task.id, title: task.title, status: task.status, priority: task.priority };
        },
      },

      {
        tool: {
          name: 'update_task',
          description: 'Update an existing task\'s status, priority, or details.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'ID of the task to update',
              },
              title: { type: 'string' },
              description: { type: 'string' },
              status: {
                type: 'string',
                enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
              },
              priority: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              },
            },
            required: ['taskId'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const taskId = String(input.taskId);
          const updated = await this.marketingRepo.updateTask(companyId, taskId, {
            title: typeof input.title === 'string' ? input.title : undefined,
            description: typeof input.description === 'string' ? input.description : undefined,
            status: typeof input.status === 'string' ? (input.status as never) : undefined,
            priority: typeof input.priority === 'string' ? (input.priority as never) : undefined,
          });
          if (!updated) return { error: 'Task not found or access denied' };
          return { id: updated.id, title: updated.title, status: updated.status, priority: updated.priority };
        },
      },

      {
        tool: {
          name: 'store_insight',
          description:
            'Store an important strategic insight, decision, or learning in the company memory for future reference.',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The insight or decision to store',
              },
              type: {
                type: 'string',
                description: 'Type of insight',
                enum: ['DECISION', 'CAMPAIGN_INSIGHT', 'LEARNED_PREFERENCE', 'GOAL_UPDATE'],
              },
            },
            required: ['content'],
          },
        },
        permissionLevel: PermissionLevel.WRITE,
        handler: async (input) => {
          const content = String(input.content);
          const memoryType = (typeof input.type === 'string'
            ? input.type
            : 'CAMPAIGN_INSIGHT') as MemoryType;

          try {
            await this.memoryService.enqueueMemoryWrite({
              companyId,
              agentType: AgentType.DIRECTOR,
              memoryType,
              content,
              conversationId: this.ctx?.conversationId,
            });
            return { stored: true, content, type: memoryType };
          } catch {
            return { stored: false, error: 'Memory queue unavailable' };
          }
        },
      },
    ];
  }

  private formatKnowledge(knowledge: CompanyKnowledgeEntry[]): string {
    if (!knowledge.length) return '_No company knowledge configured yet._';

    const grouped = knowledge.reduce<Record<string, CompanyKnowledgeEntry[]>>((acc, k) => {
      if (!acc[k.category]) acc[k.category] = [];
      acc[k.category].push(k);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([cat, entries]) => {
        const lines = entries.map((e) => `  - **${e.key}**: ${JSON.stringify(e.value)}`).join('\n');
        return `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n${lines}`;
      })
      .join('\n\n');
  }
}
