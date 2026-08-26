# SH Marketing — Agent Design

**Version**: 2.0  
**Status**: Design (awaiting approval)  
**Scope**: Marketing Director Agent — first concrete implementation of the AgentEngine

---

## 1. Design Principle

The Marketing Director Agent is **not a bespoke agent** — it is the first implementation of a reusable `AgentEngine` abstract class. Three abstract methods define its personality and capabilities; the engine handles all infrastructure (agentic loop, memory, approval gating, observability, orchestration).

Every future agent (Strategy, Research, Content, Social, Performance, Analytics, Creative) is built the same way. The infrastructure is built once.

---

## 2. AgentEngine Contract

All agents extend `AgentEngine` and implement exactly three methods:

```typescript
// packages/agent-engine/src/base/agent-engine.abstract.ts

abstract class AgentEngine {
  constructor(
    protected provider: AIProvider,
    protected memory: MemorySystem,
    protected approvalEngine: ApprovalEngine,
    protected orchestrator: AgentOrchestrator,
    protected observability: ObservabilityTracer,
    protected config: AgentConfig,
  ) {}

  // ── Agents implement these three ──────────────────────────────────
  abstract getAgentType(): AgentType
  abstract buildSystemPrompt(context: AgentContext): string
  abstract defineTools(): CanonicalTool[]

  // ── Engine manages everything else ────────────────────────────────
  async run(input: AgentInput): Promise<AgentOutput>
  private async buildContext(conversationId: string, userMessage: string, companyId: string): Promise<AgentContext>
  private async executeToolCall(call: ToolCallRequest, context: AgentContext): Promise<ToolResult>
  private async gatePermission(tool: CanonicalTool, input: unknown, context: AgentContext): Promise<void>
}
```

---

## 3. AI Provider Configuration

The engine calls an `AIProvider` interface. The underlying model is configurable without changing agent code.

```typescript
// Default for first slice
const defaultProviderConfig: AgentProviderConfig = {
  completionProvider: 'anthropic',
  completionModel: 'claude-sonnet-5-20251001',
  embeddingProvider: 'voyage',
  embeddingModel: 'voyage-3-lite',
  maxTokensPerTurn: 8096,
  enableExtendedThinking: false,  // enable for complex strategy turns
}

// To switch to OpenAI (future — no code changes in agent or engine):
const openaiConfig: AgentProviderConfig = {
  completionProvider: 'openai',
  completionModel: 'gpt-4o',
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  maxTokensPerTurn: 4096,
  enableExtendedThinking: false,
}
```

---

## 4. Marketing Director Agent

### 4.1 Implementation

```typescript
// backend/src/agents/director/director-agent.service.ts

@Injectable()
class MarketingDirectorAgent extends AgentEngine {

  getAgentType(): AgentType {
    return AgentType.DIRECTOR
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildDirectorPrompt(context)  // see Section 5
  }

  defineTools(): CanonicalTool[] {
    return directorTools  // see Section 6
  }
}
```

### 4.2 Agent Persona

Experienced marketing director at a fast-growing B2B company. Direct, structured, commercially minded. Asks at most two focused questions per message. Everything is specific to this company's context — no generic advice. Does not hallucinate metrics or competitor data.

**Role**: Plan, organize, and guide. Does not execute campaigns directly. Creates structured goals, campaigns, and tasks. Delegates execution to future specialized agents or human team members.

---

## 5. System Prompt Template

The prompt is built fresh for every agent turn from the current `AgentContext`. All `{{...}}` variables are injected at runtime — none are hardcoded.

```
You are the Marketing Director for {{companyName}}, a {{industry}} company.

Your role is to help plan, organize, and guide the company's marketing efforts.
You have full context on their current goals, active campaigns, and past decisions.

## Your Responsibilities
- Understand the company's marketing situation through focused questions
- Help define clear, measurable marketing goals
- Break goals down into concrete campaigns with realistic timelines and budgets
- Create actionable tasks within each campaign
- Track progress and suggest adjustments when campaigns are off track
- Remember past decisions and build on them in future conversations

## How You Work
- Ask at most 2 focused questions per message — never a list of 8
- Always be specific to this company — no generic marketing advice
- When you have enough context to create a campaign or task, use the tools provided
- Briefly explain your reasoning before using a tool
- After creating artifacts, summarize what you created and what happens next

## Constraints
- Do not invent metrics, market data, or competitor information
- Do not make financial projections without real data
- If you lack enough information to make a recommendation, say so and ask
- Always use tools to create campaigns and tasks — never just describe them

## Company Context
{{companyContext}}

## Ideal Customer Profile
{{icpContext}}

## Brand & Tone
{{brandContext}}

## Current Budget
{{budgetContext}}

## Active Goals ({{activeGoalCount}})
{{goalsContext}}

## Active Campaigns ({{activeCampaignCount}})
{{campaignsContext}}

## Recent Memory (last retrieved insights)
{{memoriesContext}}

Today's date: {{currentDate}}
```

### 5.1 Context Build (5-Tier Memory Injection)

```typescript
// Built by AgentEngine.buildContext() before each turn

interface AgentContext {
  // Tier 1: Short-term — last 30 messages from this conversation
  conversationHistory: Message[]

  // Tier 2: Long-term Company — structured knowledge (always loaded)
  company: {
    name: string
    industry: string
    icp?: CompanyKnowledge
    brand?: CompanyKnowledge
    budget?: CompanyKnowledge
  }

  // Tier 3+4+5: Semantic memories (top-5, retrieved by cosine similarity)
  semanticMemories: {
    campaignInsights: AgentMemory[]   // type=CAMPAIGN_INSIGHT
    preferences: AgentMemory[]        // type=LEARNED_PREFERENCE
    decisions: AgentMemory[]          // type=DECISION|GOAL_UPDATE|LESSON
  }

  // Structured business state (DB queries, not vector)
  activeGoals: MarketingGoal[]
  activeCampaigns: Campaign[]

  currentDate: string
}
```

---

## 6. Tool Definitions

All tools follow the `CanonicalTool` format — provider-agnostic JSON Schema that the `AIProvider` adapter translates to its native format (Anthropic tool_use, OpenAI function_call, etc.).

Each tool declares a `permissionLevel`. The `ApprovalEngine` enforces this before execution.

### 6.1 `list_marketing_goals`

```typescript
{
  name: 'list_marketing_goals',
  description: 'Retrieve the company\'s marketing goals. Use to understand current priorities before suggesting campaigns.',
  permissionLevel: PermissionLevel.READ,
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ACTIVE', 'ACHIEVED', 'MISSED', 'ARCHIVED', 'all'],
        description: 'Filter by status. Default: ACTIVE',
      },
    },
    required: [],
  },
}
```

**Executes**: `GoalsService.list({ companyId, status })`

---

### 6.2 `create_marketing_goal`

```typescript
{
  name: 'create_marketing_goal',
  description: 'Create a new marketing goal when the user expresses a clear business objective.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Clear, concise goal title (e.g. "Increase MQL volume by 40% in Q1 2026")',
      },
      description: {
        type: 'string',
        description: 'Detailed context: why this goal matters, what success looks like',
      },
      targetMetrics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },   // e.g. "MQL", "impressions", "CAC"
            target: { type: 'number' },
            unit: { type: 'string' },     // e.g. "leads", "views", "USD"
            period: { type: 'string' },   // e.g. "Q1 2026", "monthly"
          },
          required: ['metric', 'target'],
        },
      },
      targetDate: { type: 'string', format: 'date' },
    },
    required: ['title'],
  },
}
```

**Executes**: `GoalsService.create({ companyId, ...input })`  
**Audit**: Creates `AuditLog` entry (actorType=agent, action=CREATE, entityType=goal)

---

### 6.3 `list_campaigns`

```typescript
{
  name: 'list_campaigns',
  description: 'Retrieve campaigns for this company, optionally filtered by status or goal.',
  permissionLevel: PermissionLevel.READ,
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'all'],
      },
      goalId: { type: 'string', description: 'Filter by goal UUID' },
    },
    required: [],
  },
}
```

**Executes**: `CampaignService.list({ companyId, status, goalId })`

---

### 6.4 `create_campaign`

```typescript
{
  name: 'create_campaign',
  description: 'Create a marketing campaign under a goal. A campaign is a coordinated set of activities with a clear objective, timeline, and budget.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      goalId: { type: 'string', description: 'UUID of the marketing goal. Get from list_marketing_goals.' },
      title: { type: 'string', description: 'Campaign name (e.g. "Q1 LinkedIn Thought Leadership")' },
      description: { type: 'string' },
      channels: {
        type: 'array',
        items: { type: 'string' },
        description: 'e.g. ["linkedin", "email", "blog", "paid_search"]',
      },
      budgetCents: { type: 'integer', description: 'Budget in cents (e.g. 500000 = $5,000)' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      brief: {
        type: 'object',
        properties: {
          objective: { type: 'string' },
          targetAudience: { type: 'string' },
          keyMessages: { type: 'array', items: { type: 'string' } },
          successMetrics: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['title'],
  },
}
```

**Executes**: `CampaignService.create({ companyId, ...input })`

---

### 6.5 `update_campaign`

```typescript
{
  name: 'update_campaign',
  description: 'Update a campaign\'s status, budget, dates, or brief. Use when the user reports progress or requests changes.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      campaignId: { type: 'string' },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
      title: { type: 'string' },
      description: { type: 'string' },
      budgetCents: { type: 'integer' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
    },
    required: ['campaignId'],
  },
}
```

**Executes**: `CampaignService.update(campaignId, { companyId, ...input })`  
**Audit**: Creates before/after `AuditLog` entry

---

### 6.6 `create_task`

```typescript
{
  name: 'create_task',
  description: 'Create a task within a campaign. Tasks are concrete actions needed for the campaign to succeed.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      campaignId: { type: 'string' },
      title: { type: 'string', description: 'Action-oriented title (e.g. "Write 4 LinkedIn articles on supply chain trends")' },
      description: { type: 'string', description: 'What needs to be done, acceptance criteria, guidance' },
      assigneeType: {
        type: 'string',
        enum: ['human', 'content_agent', 'social_agent', 'research_agent'],
        description: 'Use "human" unless the task should be automated by a future agent',
      },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      dueDate: { type: 'string', format: 'date' },
    },
    required: ['campaignId', 'title'],
  },
}
```

**Executes**: `TaskService.create({ companyId, ...input })`

---

### 6.7 `update_task`

```typescript
{
  name: 'update_task',
  description: 'Update a task status or notes. Use when the user reports a task is done, blocked, or needs changes.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] },
      notes: { type: 'string', description: 'Progress notes, blockers, or completion details' },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    },
    required: ['taskId'],
  },
}
```

**Executes**: `TaskService.update(taskId, { companyId, ...input })`

---

### 6.8 `search_memory`

```typescript
{
  name: 'search_memory',
  description: 'Search past decisions, campaign insights, and preferences from long-term memory. Use when you need context about past conversations or decisions not covered by the injected context.',
  permissionLevel: PermissionLevel.READ,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query (e.g. "budget constraints", "what worked in Q4", "target audience preferences")',
      },
      memoryTypes: {
        type: 'array',
        items: { type: 'string', enum: ['DECISION', 'CAMPAIGN_INSIGHT', 'LEARNED_PREFERENCE', 'GOAL_UPDATE', 'LESSON'] },
        description: 'Filter by memory type. Omit to search all types.',
      },
      limit: { type: 'integer', description: 'Number of results (default: 5, max: 10)' },
    },
    required: ['query'],
  },
}
```

**Executes**: pgvector cosine similarity search on `agent_memory` table, pre-filtered by `companyId` and optional `type` list.

---

### 6.9 `store_insight`

```typescript
{
  name: 'store_insight',
  description: 'Store an important insight, decision, or preference in long-term memory. Use when the user shares something that will inform future marketing decisions.',
  permissionLevel: PermissionLevel.WRITE,
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The insight to remember, written as a clear, standalone fact (e.g. "The company targets VP of Operations at mid-market B2B SaaS with 50-200 employees")',
      },
      type: {
        type: 'string',
        enum: ['DECISION', 'CAMPAIGN_INSIGHT', 'LEARNED_PREFERENCE', 'GOAL_UPDATE', 'LESSON'],
      },
    },
    required: ['content', 'type'],
  },
}
```

**Executes**: `MemorySystem.store({ companyId, agentType, content, type })` — embedding generated async via BullMQ job.

---

## 7. Tool Permission Summary

| Tool | Permission | Approval Needed |
|------|-----------|----------------|
| `list_marketing_goals` | READ | No |
| `list_campaigns` | READ | No |
| `search_memory` | READ | No |
| `create_marketing_goal` | WRITE | No — logged to audit |
| `create_campaign` | WRITE | No — logged to audit |
| `update_campaign` | WRITE | No — logged to audit |
| `create_task` | WRITE | No — logged to audit |
| `update_task` | WRITE | No — logged to audit |
| `store_insight` | WRITE | No — logged to audit |
| *(future)* `schedule_social_post` | APPROVAL_REQUIRED | Yes |
| *(future)* `create_ad_campaign` | APPROVAL_REQUIRED | Yes |
| *(future)* `send_email_campaign` | APPROVAL_REQUIRED | Yes |
| *(future)* `adjust_ad_budget` | APPROVAL_REQUIRED | Yes |
| *(future)* `delete_campaign` | ADMIN_ONLY | Blocked for agents |

---

## 8. Agentic Loop (Engine-managed)

The Director Agent does not implement the loop. `AgentEngine.run()` handles it:

```
run(input: AgentInput):
  1. Start observability trace (generate traceId)
  2. Build AgentContext:
     a. Tier 1: Load last 30 conversation messages
     b. Tier 2: Load all CompanyKnowledge for this company
     c. Tier 3+4+5: Semantic search for top-5 relevant memories (by userMessage)
     d. Load active goals + active campaigns (structured DB queries)
  3. buildSystemPrompt(context)  ← Director implements this
  4. LOOP (max 10 iterations):
     a. Call AIProvider.complete({ messages, tools: defineTools(), systemPrompt })
     b. If stop_reason == 'end_turn':
        → Save assistant message to DB
        → Enqueue memory analysis job (async)
        → Record observability
        → Return AgentOutput
     c. If stop_reason == 'tool_use':
        For each tool call in response:
          i.   Look up CanonicalTool by name
          ii.  ApprovalEngine.gate(tool.permissionLevel, toolInput, context)
               - READ/WRITE → proceed
               - APPROVAL_REQUIRED → create ApprovalRequest, emit event, return partial response to user
               - ADMIN_ONLY → return error tool_result
          iii. Execute tool (calls Application Service)
          iv.  Log ToolCallLog record
          v.   Append tool_result to messages
     d. Append assistant turn to messages, continue
  5. If max iterations reached: return partial response with explanation
```

---

## 9. Memory Write Strategy

Memory writes happen **asynchronously** via BullMQ — they never block the agent response.

**Automatic memory analysis** (post-turn job):

```typescript
// After every agent turn, enqueue:
await memoryAnalysisQueue.add('analyze-turn', {
  conversationId,
  companyId,
  agentType: 'director',
  lastAssistantMessage,
  toolCallsExecuted,
})

// Job logic: examine the turn for insights worth storing
// Uses LLM call with low token budget to classify and extract
// Stores to agent_memory if insight found, skips otherwise
```

**Manual storage** (agent uses `store_insight` tool mid-conversation):

| User shares... | Memory type | Example content |
|---------------|------------|----------------|
| Target customer description | LEARNED_PREFERENCE | "ICP is VP Operations at 50-200 person SaaS" |
| Budget information | LEARNED_PREFERENCE | "Monthly marketing budget is $15K" |
| Campaign created | DECISION | "Created LinkedIn thought leadership campaign for Q1 2026" |
| Campaign result reported | CAMPAIGN_INSIGHT | "Email campaign achieved 28% open rate" |
| Goal defined or changed | GOAL_UPDATE | "Primary goal shifted from awareness to pipeline generation" |
| Post-campaign learning | LESSON | "Short-form video outperformed long articles 3:1 on LinkedIn" |

**Importance scoring**:
- Initial: `0.5`
- On retrieval: `+0.1` boost (capped at 1.0)
- Weekly decay: `× 0.9`
- This surfaces recently-relevant memories over stale ones

---

## 10. Error Handling

| Scenario | Behavior |
|----------|----------|
| AI provider timeout (>30s) | Return partial response; retry job queued in BullMQ |
| Tool execution failure | Return `is_error: true` tool_result; agent responds gracefully |
| DB write failure in tool | Transaction rollback; error returned as tool_result |
| Embedding API unavailable | Memory stored without embedding; retrieval falls back to recency |
| AI provider rate limit | Exponential backoff with jitter; user sees "thinking…" in SSE stream |
| APPROVAL_REQUIRED gate hit | Pause turn; create ApprovalRequest; return partial response |
| Max iterations (10) reached | Agent stops, explains situation, user can continue |
| ADMIN_ONLY tool called | Immediate error tool_result: "This action requires admin access" |

---

## 11. Observability Per Turn

Each `AgentEngine.run()` call produces:

```typescript
interface ExecutionRecord {
  traceId: string          // UUID linking all records for this turn
  agentType: 'director'
  conversationId: string
  companyId: string
  aiProvider: string
  modelId: string
  totalDurationMs: number
  llmCallDurationMs: number
  toolExecutionDurationMs: number
  memoryRetrievalDurationMs: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number          // calculated from model pricing config
  toolCallsCount: number
  toolCallsFailed: number
  loopIterations: number
  errorType?: string
}
```

Stored in `agent_executions` table. Token cost estimate for first slice:
- Input: ~4,000 tokens/turn → **$0.012** (claude-sonnet-5 @ $3/1M)
- Output: ~1,500 tokens/turn → **$0.023** (claude-sonnet-5 @ $15/1M)
- **~$0.035 per agent turn** (approximate)

---

## 12. What the Director Does NOT Do (First Slice)

- Does not publish to social media
- Does not create ads in Meta / Google
- Does not generate content or copy
- Does not send emails
- Does not access real-time market data
- Does not delegate to other agents (they don't exist yet — delegation queues as PENDING_AGENT)

These are Phase 2+ features. The Director plans; execution agents carry out the work in future milestones.
