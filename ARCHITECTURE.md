# SH Marketing — Architecture

**Version**: 2.0  
**Status**: Design (awaiting approval)  
**Revised**: Added AI Provider abstraction, Agent Engine, Approval Engine, Orchestration, Event system, Observability

---

## 1. Product Vision

SH Marketing is a multi-tenant SaaS platform where a company's marketing work is driven by a team of specialized AI agents. Each agent is built on a shared, provider-agnostic Agent Engine — so the infrastructure that powers the Marketing Director Agent also powers every future agent (Strategy, Research, Content, Social, Performance, Analytics, Creative). Agents propose actions, the Approval Engine controls what they can execute autonomously, and humans stay in control of sensitive decisions.

**First milestone**: Marketing Director Agent, end-to-end, with real data.

---

## 2. Architectural Layers

The system is strictly layered. No layer may skip a layer below it — data always flows through the defined boundaries.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PRESENTATION                                               │
│  Next.js 15 · Chat UI · Dashboard · Approval Inbox · Goals/Campaigns│
└───────────────────────────────┬─────────────────────────────────────┘
                                │ REST + SSE
┌───────────────────────────────▼─────────────────────────────────────┐
│  LAYER 2: API (NestJS Controllers)                                   │
│  Request validation · Auth guards · DTO transformation · Rate limit  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  LAYER 3: APPLICATION SERVICES                                       │
│  GoalsService · CampaignService · TaskService · ConversationService  │
│  CompanyService · UserService · AuthService                          │
└───────────┬───────────────────┬─────────────────────────────────────┘
            │                   │
┌───────────▼────────┐ ┌───────▼──────────────────────────────────────┐
│  LAYER 4: AGENT    │ │  LAYER 5: TOOLS                               │
│  ENGINE            │ │  AgentTool implementations                    │
│                    │ │  Each tool calls Application Services only    │
│  AgentEngine       │ │  (never direct DB access)                    │
│  MemorySystem      │ └───────────────────────────────────────────────┘
│  ApprovalEngine    │
│  Orchestrator      │
└───────────┬────────┘
            │
┌───────────▼────────────────────────────────────────────────────────┐
│  LAYER 6: AI PROVIDER                                               │
│  AIProvider interface · AnthropicProvider · OpenAIProvider (future) │
│  EmbeddingProvider interface · VoyageProvider · OpenAIEmbedding     │
└────────────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────────┐
│  LAYER 7: DATA                                                       │
│  Prisma ORM · PostgreSQL 16 + pgvector · Redis                      │
└────────────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────────┐
│  LAYER 8: EXTERNAL INTEGRATIONS (future)                            │
│  Meta Ads · Google Ads · Instagram · Mailchimp · Stripe              │
└────────────────────────────────────────────────────────────────────┘
```

**Cross-cutting concerns** (touch every layer):
- **Event Bus** (BullMQ): decoupled communication between layers
- **Observability** (execution logs, token usage, cost, latency, errors)
- **Audit Log** (immutable record of every mutation and agent action)

---

## 3. System Component Diagram

```
Browser
  │
  │ HTTPS
  ▼
NestJS API (:3001)
  ├── Auth Module
  ├── Companies Module
  ├── Conversations Module ──────────────────┐
  ├── Goals Module                           │
  ├── Campaigns Module                       │
  ├── Tasks Module                           │
  ├── Approval Module                        │
  └── Observability Module                   │
                                             │
                              ┌──────────────▼──────────────┐
                              │       AGENT ENGINE           │
                              │                              │
                              │  ┌────────────────────────┐ │
                              │  │  MarketingDirectorAgent │ │
                              │  │  (AgentEngine impl.)    │ │
                              │  └──────────┬─────────────┘ │
                              │             │                │
                              │  ┌──────────▼─────────────┐ │
                              │  │   Agentic Loop          │ │
                              │  │   ToolRouter            │ │
                              │  │   ApprovalGate          │ │
                              │  │   MemoryContext          │ │
                              │  │   ObservabilityTracer   │ │
                              │  └──────────┬─────────────┘ │
                              └─────────────┼───────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────┐
               │                            │                        │
    ┌──────────▼──────────┐  ┌─────────────▼──────┐  ┌────────────▼──────────┐
    │    AI PROVIDER       │  │   MEMORY SYSTEM     │  │   APPROVAL ENGINE     │
    │                      │  │                     │  │                       │
    │  AIProvider          │  │  ShortTermMemory    │  │  ApprovalRequest      │
    │  interface           │  │  LongTermCompany    │  │  PermissionLevel      │
    │                      │  │  CampaignInsights   │  │  HumanApprovalWait    │
    │  AnthropicProvider   │  │  LearnedPreferences │  │  ApprovalNotifier     │
    │  (+ future providers)│  │  SemanticIndex      │  │                       │
    └──────────────────────┘  └─────────────────────┘  └───────────────────────┘
               │                            │
               │                  ┌─────────▼────────────────────────────┐
               │                  │   ORCHESTRATION LAYER                │
               │                  │   AgentOrchestrator                  │
               │                  │   AgentTaskQueue (BullMQ)            │
               │                  │   (Director delegates → future agents)│
               │                  └──────────────────────────────────────┘
               │
    ┌──────────▼──────────────────────────────────────────────────────────┐
    │   POSTGRESQL 16 + pgvector          REDIS           BULLMQ          │
    │   (Prisma ORM)                      (cache+sessions) (queues+jobs)   │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 4. AI Provider Abstraction

The system never calls Anthropic (or any LLM) directly from the Agent Engine. All AI calls go through a provider interface. Swapping the underlying model requires only a config change.

### 4.1 Provider Interface

```typescript
// packages/agent-engine/src/providers/ai-provider.interface.ts

interface CompletionRequest {
  messages: CanonicalMessage[]    // provider-agnostic message format
  tools?: CanonicalTool[]         // provider-agnostic tool definitions
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  thinkingEnabled?: boolean       // extended reasoning (Anthropic only, no-op elsewhere)
}

interface CompletionResponse {
  content: string | null
  toolCalls: ToolCallRequest[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error'
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
}

interface AIProvider {
  readonly providerId: string         // 'anthropic' | 'openai' | 'gemini'
  readonly modelId: string            // 'claude-sonnet-5-20251001' | 'gpt-4o' | etc.
  readonly contextWindow: number
  readonly supportsToolUse: boolean
  readonly supportsStreaming: boolean

  complete(request: CompletionRequest): Promise<CompletionResponse>
  stream(request: CompletionRequest): AsyncIterable<CompletionChunk>
}

interface EmbeddingProvider {
  readonly providerId: string
  readonly dimensions: number
  embed(texts: string[]): Promise<number[][]>
}
```

### 4.2 Canonical Message and Tool Format

```typescript
// Provider-agnostic — each provider adapter translates to its own format
interface CanonicalMessage {
  role: 'user' | 'assistant' | 'tool_result'
  content: string | CanonicalContentBlock[]
}

interface CanonicalTool {
  name: string
  description: string
  inputSchema: JsonSchema       // JSON Schema object — all providers accept this
  permissionLevel: PermissionLevel  // READ | WRITE | APPROVAL_REQUIRED | ADMIN_ONLY
}
```

### 4.3 Provider Implementations (Day 1 → Future)

| Provider | Status | Used For |
|----------|--------|----------|
| `AnthropicProvider` | **First slice** | All agents — claude-sonnet-5 |
| `OpenAIProvider` | Future | Alternative if cost/capability demands |
| `GeminiProvider` | Future | Alternative or multimodal tasks |
| `VoyageEmbeddingProvider` | **First slice** | Memory embeddings |
| `OpenAIEmbeddingProvider` | Future | Alternative embeddings |
| `LocalEmbeddingProvider` | Dev fallback | Offline dev without API key |

### 4.4 Provider Configuration

```typescript
// Configured per-agent in environment or admin settings
interface AgentProviderConfig {
  completionProvider: 'anthropic' | 'openai' | 'gemini'
  completionModel: string
  embeddingProvider: 'voyage' | 'openai' | 'local'
  embeddingModel: string
  maxTokensPerTurn: number
  enableExtendedThinking: boolean
}
```

---

## 5. Agent Engine

The Agent Engine is a reusable, provider-agnostic framework. Every agent — Director, Strategy, Content, Research, Social, Performance, Analytics, Creative — is implemented by extending `AgentEngine`. The engine handles the agentic loop, memory injection, approval gating, observability, and orchestration. Individual agents only define their persona and tools.

### 5.1 AgentEngine Abstract Class

```typescript
abstract class AgentEngine {
  constructor(
    protected provider: AIProvider,
    protected memory: MemorySystem,
    protected approvalEngine: ApprovalEngine,
    protected orchestrator: AgentOrchestrator,
    protected observability: ObservabilityTracer,
    protected config: AgentConfig,
  ) {}

  // Every agent implements these three
  abstract getAgentType(): AgentType
  abstract buildSystemPrompt(context: AgentContext): string
  abstract defineTools(): CanonicalTool[]

  // Engine handles the rest
  async run(input: AgentInput): Promise<AgentOutput>
  private async executeToolCall(call: ToolCallRequest, context: AgentContext): Promise<ToolResult>
  private async gatePermission(tool: CanonicalTool, input: unknown, context: AgentContext): Promise<void>
  private async buildContext(conversationId: string, userMessage: string, companyId: string): Promise<AgentContext>
}
```

### 5.2 Agentic Loop (Engine-managed)

```
run(input):
  1. Start observability trace
  2. Build AgentContext:
     a. Load conversation history (SHORT_TERM memory)
     b. Retrieve semantic memories (LONG_TERM + INSIGHTS + PREFERENCES)
     c. Load structured context (company, goals, active campaigns)
  3. Build system prompt (delegated to concrete agent)
  4. LOOP:
     a. Call AIProvider.complete()
     b. If stop_reason == end_turn → finalize, break
     c. If stop_reason == tool_use:
        i.   For each tool call:
             - Check PermissionLevel via ApprovalEngine
             - If APPROVAL_REQUIRED → create ApprovalRequest, pause, return partial response
             - If READ/WRITE → execute tool
             - Append tool_result
     d. Append assistant + tool_results to message array
     e. Continue loop (max 10 iterations, configurable)
  5. Save assistant message to DB
  6. Enqueue memory storage job (async, non-blocking)
  7. Record observability: tokens, cost, latency, tool calls, errors
  8. Return AgentOutput
```

### 5.3 First Slice Agent: MarketingDirectorAgent

```typescript
class MarketingDirectorAgent extends AgentEngine {
  getAgentType() { return AgentType.DIRECTOR }

  buildSystemPrompt(context: AgentContext): string {
    // Injects: companyContext, goals, campaigns, memories
    // Persona: senior marketing director, structured, commercially minded
    // See AGENT_DESIGN.md for full prompt template
  }

  defineTools(): CanonicalTool[] {
    return [
      listGoalsTool,        // READ
      createGoalTool,       // WRITE
      createCampaignTool,   // WRITE
      listCampaignsTool,    // READ
      updateCampaignTool,   // WRITE
      createTaskTool,       // WRITE
      updateTaskTool,       // WRITE
      searchMemoryTool,     // READ
      storeInsightTool,     // WRITE
      // Future: delegateToAgentTool (APPROVAL_REQUIRED)
    ]
  }
}
```

### 5.4 Future Agent Implementations (Same Engine)

| Agent | Type | Key Tools (future) |
|-------|------|-------------------|
| Strategy Agent | `STRATEGY` | market_analysis, competitor_research, swot_analysis |
| Research Agent | `RESEARCH` | web_search, trend_analysis, data_scrape |
| Content Agent | `CONTENT` | write_copy, create_brief, review_content |
| Social Media Agent | `SOCIAL` | schedule_post, analyze_engagement, generate_caption |
| Performance Agent | `PERFORMANCE` | create_ad_campaign, adjust_budget, pause_ad |
| Analytics Agent | `ANALYTICS` | pull_report, detect_anomaly, attribute_conversion |
| Creative Agent | `CREATIVE` | generate_flyer, select_template, export_asset |

All seven use the same `AgentEngine.run()` loop, the same memory system, the same approval engine, and the same observability layer.

---

## 6. Memory System

Five distinct memory tiers, all backed by PostgreSQL. Tiers 3–5 use pgvector for semantic retrieval.

```
┌─────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                             │
│                                                                  │
│  Tier 1: SHORT-TERM (Conversation)                               │
│  ─ Last 30 messages of the current conversation                  │
│  ─ Stored in: messages table                                     │
│  ─ Retrieved: always, full load, ordered by time                 │
│                                                                  │
│  Tier 2: LONG-TERM COMPANY (Structured)                         │
│  ─ Company profile, brand guidelines, product catalog            │
│  ─ Stored in: company_knowledge table (JSON + text)              │
│  ─ Retrieved: always, structured query (not vector)              │
│                                                                  │
│  Tier 3: CAMPAIGN INSIGHTS (Semantic)                           │
│  ─ Learnings from past campaigns (what worked, what didn't)      │
│  ─ Stored in: agent_memory (type=CAMPAIGN_INSIGHT) + embedding   │
│  ─ Retrieved: top-k by cosine similarity to current query        │
│                                                                  │
│  Tier 4: LEARNED PREFERENCES (Semantic)                         │
│  ─ User/company preferences expressed across conversations       │
│  ─ Stored in: agent_memory (type=LEARNED_PREFERENCE) + embedding │
│  ─ Retrieved: top-k by cosine similarity                         │
│                                                                  │
│  Tier 5: SEMANTIC MEMORY (Cross-type Index)                     │
│  ─ Decisions, goals created, key strategic choices              │
│  ─ Stored in: agent_memory (type=DECISION|GOAL_UPDATE|LESSON)   │
│  ─ Retrieved: top-k by cosine similarity, filtered by type       │
│                                                                  │
│  pgvector HNSW index covers Tiers 3, 4, 5                       │
└─────────────────────────────────────────────────────────────────┘
```

Context injected into each agent turn:
```
Tier 1: conversation_history (last 30 msgs, always)
Tier 2: company_context (always, structured)
Tier 3+4+5: top 5 semantic memories (retrieved by relevance to user's message)
```

---

## 7. Approval Engine

Every tool action carries a `PermissionLevel`. The Approval Engine enforces this before any tool executes.

### 7.1 Permission Levels

| Level | Description | Behavior |
|-------|-------------|----------|
| `READ` | Safe data retrieval | Executes immediately, no human gate |
| `WRITE` | Creates or modifies data | Executes immediately; logged to audit |
| `APPROVAL_REQUIRED` | Affects external systems or significant spend | Agent pauses, human is notified, execution waits |
| `ADMIN_ONLY` | Billing, user management, company deletion | Blocked for agents; admin API only |

### 7.2 Approval Flow

```
Agent wants to call tool with APPROVAL_REQUIRED:
  1. Engine calls ApprovalEngine.requestApproval(tool, input, context)
  2. ApprovalEngine creates ApprovalRequest record (status: PENDING)
  3. Event emitted: ApprovalRequested → SSE pushes to frontend
  4. Agent returns: "I've prepared a [action]. Your approval is required. [description]"
  5. Human sees Approval Inbox notification
  6. Human approves → ApprovalGranted event
  7. BullMQ job resumes the agent turn, executes the tool, continues loop
  8. Human denies → AgentDenied event, agent receives denial reason, responds accordingly
```

### 7.3 First Slice Tool Permission Map

| Tool | Permission |
|------|-----------|
| `list_goals` | READ |
| `list_campaigns` | READ |
| `search_memory` | READ |
| `create_goal` | WRITE |
| `create_campaign` | WRITE |
| `update_campaign` | WRITE |
| `create_task` | WRITE |
| `update_task` | WRITE |
| `store_insight` | WRITE |
| *(future)* `schedule_social_post` | APPROVAL_REQUIRED |
| *(future)* `create_ad_campaign` | APPROVAL_REQUIRED |
| *(future)* `adjust_ad_budget` | APPROVAL_REQUIRED |
| *(future)* `send_email_campaign` | APPROVAL_REQUIRED |
| *(future)* `delete_campaign` | ADMIN_ONLY |

---

## 8. Agent Orchestration Layer

Designed for future agent-to-agent delegation. The Director can request that another agent handle a task — this goes through the Orchestrator, which queues it in BullMQ. In the first slice, no other agents exist, so delegated tasks are queued as PENDING_AGENT_AVAILABILITY.

### 8.1 Orchestration Protocol

```typescript
interface AgentTask {
  taskId: string          // UUID
  parentAgentType: AgentType
  targetAgentType: AgentType
  companyId: string
  campaignId?: string
  input: Record<string, unknown>
  priority: 1 | 2 | 3 | 4 | 5
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING_AGENT'
  delegatedAt: Date
  completedAt?: Date
  result?: unknown
}

class AgentOrchestrator {
  async delegate(task: Omit<AgentTask, 'taskId' | 'status'>): Promise<string>
  async getStatus(taskId: string): Promise<AgentTask>
  async cancel(taskId: string): Promise<void>
  async listPending(companyId: string): Promise<AgentTask[]>
}
```

### 8.2 Delegation Example (Director → Content Agent, future)

```
User: "Create a LinkedIn content plan for the Q1 campaign"
Director agent decides: this requires Content Agent
Director calls: delegate_to_agent({
  targetAgentType: 'CONTENT',
  campaignId: 'abc',
  input: { request: 'LinkedIn content calendar, Q1, 12 posts...' }
})
Orchestrator: creates AgentTask in DB, queues to BullMQ
Response to user: "I've queued this for the Content Agent. It will create the LinkedIn content plan and notify you when done."
```

---

## 9. Event System

All significant events are published to BullMQ. Consumers: audit logger, observability service, notification service, webhook gateway (future), scheduler.

### 9.1 Event Types

```typescript
// Agent lifecycle
AgentTurnStarted  { traceId, agentType, conversationId, companyId }
AgentTurnCompleted { traceId, durationMs, inputTokens, outputTokens, costUsd }
AgentTurnFailed   { traceId, error, durationMs }

// Tool execution
ToolCallStarted   { traceId, toolName, permissionLevel, input }
ToolCallCompleted { traceId, toolName, durationMs, result }
ToolCallFailed    { traceId, toolName, error }

// Approval workflow
ApprovalRequested { requestId, agentType, toolName, companyId, userId }
ApprovalGranted   { requestId, grantedBy, grantedAt }
ApprovalDenied    { requestId, deniedBy, reason }

// Business events
GoalCreated       { goalId, companyId, agentType, conversationId }
CampaignCreated   { campaignId, companyId, agentType }
TaskCreated       { taskId, campaignId, assigneeType }
CampaignUpdated   { campaignId, fields, agentType }

// Scheduled triggers
ScheduledJobFired { jobType, companyId, scheduledAt }
DailyReportDue    { companyId }
```

### 9.2 Scheduled Jobs (Cloud-ready)

BullMQ repeatable jobs handle time-based triggers. Designed now, even though the triggered agents may not exist yet.

```typescript
// Example: daily 08:00 digest per company
await queue.add(
  'daily-marketing-report',
  { companyId, reportType: 'daily_summary' },
  { repeat: { cron: '0 8 * * *', tz: company.timezone } }
)

// Future scheduled jobs
'weekly-campaign-review'    → triggers Director Agent review of all active campaigns
'campaign-health-check'     → checks KPI progress, alerts if off-track
'competitor-watch'          → triggers Research Agent (future)
```

---

## 10. Observability

Built in from day one. Every agent execution is traced end-to-end.

### 10.1 What is Traced

```
Per agent turn:
  - traceId (UUID, links all records for one turn)
  - agentType, conversationId, companyId
  - totalDurationMs
  - llmCallDurationMs (time waiting for AI provider)
  - toolExecutionDurationMs (time executing tools)
  - memoryRetrievalDurationMs
  - inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens
  - costUsd (calculated from model pricing config)
  - toolCallsCount, toolCallsFailed
  - error (if any)

Per tool call:
  - traceId (same as parent turn)
  - toolName, permissionLevel
  - inputPayload (sanitized — no secrets)
  - resultSummary (e.g. "created campaign id=abc")
  - durationMs
  - error (if any)
```

### 10.2 Cost Calculation

```typescript
// Pricing config (updated as models change)
const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-5-20251001': {
    inputPerMillion: 3.00,       // $3 per 1M input tokens
    outputPerMillion: 15.00,     // $15 per 1M output tokens
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.30,
  },
}

function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = PRICING[model]
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPerMillion +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMillion
  )
}
```

### 10.3 Observability Outputs

| Output | Destination | Purpose |
|--------|-------------|---------|
| Structured logs | stdout (JSON) | Collected by cloud log aggregator |
| Execution records | `agent_executions` table | Per-company cost dashboards |
| Tool call records | `tool_call_logs` table | Audit + debugging |
| Error events | BullMQ dead-letter queue | Alerting |
| Health endpoint | `GET /health` | Load balancer + uptime monitoring |

---

## 11. Tech Stack Decisions

| Layer | Choice | Decision |
|-------|--------|----------|
| **Frontend** | Next.js 15 + React 19 + TypeScript | App Router, Server Components, streaming |
| **UI Components** | shadcn/ui + existing tailwind.config.ts | Token system already configured |
| **API** | NestJS 11 + TypeScript strict | Module system maps cleanly to agent/service decomposition |
| **ORM** | Prisma 6 | Type-safe; migrations; preview: postgresqlExtensions |
| **Database** | PostgreSQL 16 + pgvector | Single engine: relational + vector search |
| **Auth** | Custom JWT + bcrypt | No external dependency; full control; works with local Docker |
| **AI (Day 1)** | Anthropic SDK → claude-sonnet-5 | Via AIProvider interface |
| **Embeddings (Day 1)** | Voyage AI voyage-3-lite | Via EmbeddingProvider interface |
| **Queue** | BullMQ on Redis | Scheduled jobs, async memory writes, approval workflow |
| **Cache/Sessions** | Redis 7 | Token blocklist, response cache, BullMQ backend |
| **Streaming** | SSE (Server-Sent Events) | Real-time agent output; simpler than WebSocket for first slice |
| **Observability** | Structured JSON logs + `agent_executions` DB table | No external service needed for first slice |
| **Dropped** | RabbitMQ, Elasticsearch, PgAdmin | BullMQ covers queues; pgvector + FTS covers search; Prisma Studio covers DB UI |

---

## 12. Repository Structure

```
sh-marketing/
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   │
│   │   ├── auth/                    ← JWT, bcrypt, refresh tokens
│   │   ├── companies/               ← company/tenant management
│   │   ├── users/                   ← user profiles
│   │   ├── goals/                   ← MarketingGoal CRUD
│   │   ├── campaigns/               ← Campaign CRUD
│   │   ├── tasks/                   ← Task CRUD
│   │   ├── conversations/           ← Conversation + Message + SSE stream
│   │   │
│   │   ├── agent-engine/            ← THE REUSABLE ENGINE
│   │   │   ├── agent-engine.module.ts
│   │   │   ├── base/
│   │   │   │   ├── agent-engine.abstract.ts
│   │   │   │   ├── agent-context.types.ts
│   │   │   │   ├── agent-tool.types.ts
│   │   │   │   └── agent-config.types.ts
│   │   │   ├── providers/
│   │   │   │   ├── ai-provider.interface.ts
│   │   │   │   ├── embedding-provider.interface.ts
│   │   │   │   ├── anthropic.provider.ts
│   │   │   │   └── voyage.embedding.provider.ts
│   │   │   ├── memory/
│   │   │   │   ├── memory-system.service.ts
│   │   │   │   ├── short-term.memory.ts
│   │   │   │   ├── long-term.memory.ts
│   │   │   │   ├── semantic.memory.ts
│   │   │   │   └── memory.types.ts
│   │   │   ├── approval/
│   │   │   │   ├── approval-engine.service.ts
│   │   │   │   ├── approval.types.ts
│   │   │   │   └── permission-level.enum.ts
│   │   │   ├── orchestration/
│   │   │   │   ├── agent-orchestrator.service.ts
│   │   │   │   └── agent-task.types.ts
│   │   │   └── observability/
│   │   │       ├── observability-tracer.service.ts
│   │   │       ├── cost-calculator.ts
│   │   │       └── execution-log.types.ts
│   │   │
│   │   ├── agents/                  ← CONCRETE AGENT IMPLEMENTATIONS
│   │   │   ├── agents.module.ts
│   │   │   └── director/
│   │   │       ├── director-agent.service.ts    ← extends AgentEngine
│   │   │       ├── director-agent.prompt.ts
│   │   │       └── director-agent.tools.ts      ← tool definitions + implementations
│   │   │
│   │   ├── approval/                ← Approval HTTP API (inbox, grant, deny)
│   │   ├── observability/           ← Observability HTTP API + scheduled reporters
│   │   ├── scheduler/               ← BullMQ job definitions + cron setup
│   │   │
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── prisma.service.ts
│   │   └── common/
│   │       ├── decorators/
│   │       ├── filters/
│   │       ├── guards/
│   │       ├── interceptors/
│   │       └── pipes/
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   └── (dashboard)/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx              ← overview
│   │   │       ├── chat/[id]/page.tsx    ← agent chat
│   │   │       ├── goals/page.tsx
│   │   │       ├── campaigns/page.tsx
│   │   │       ├── campaigns/[id]/page.tsx
│   │   │       └── approvals/page.tsx    ← approval inbox
│   │   ├── components/
│   │   │   ├── ui/                       ← shadcn/ui
│   │   │   ├── chat/
│   │   │   │   ├── message-list.tsx
│   │   │   │   ├── message-input.tsx
│   │   │   │   ├── tool-call-display.tsx
│   │   │   │   └── approval-prompt.tsx   ← inline approval in chat
│   │   │   ├── approvals/
│   │   │   │   └── approval-card.tsx
│   │   │   └── layout/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── store/
│   └── package.json
│
├── docker-compose.yml           ← postgres (pgvector), redis only
├── package.json                 ← workspace root
├── .env.example
└── *.md                         ← design docs
```

---

## 13. Security Baseline

| Concern | Implementation |
|---------|----------------|
| Passwords | bcrypt, cost factor 12 |
| JWT secrets | Minimum 64 random bytes, env-only, never committed |
| Refresh tokens | Stored as SHA-256 hash, rotated on every use |
| Rate limiting | 100 req/15min global; 10/min on `/auth/*` |
| Input validation | `class-validator` on all DTOs; `whitelist: true, forbidNonWhitelisted: true` |
| SQL injection | Prisma parameterized queries only |
| Company isolation | `companyId` from JWT on every query — no exceptions |
| CORS | Allowlist from `FRONTEND_URL` env var |
| Agent permission gate | ApprovalEngine enforced before any APPROVAL_REQUIRED tool |
| Sensitive data | `passwordHash`, token hashes never returned in any API response |
| Audit trail | Every mutation and agent action written to `audit_logs` (append-only) |

---

## 14. Environment Variables

```bash
# App
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_marketing_os

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=                       # min 64 random bytes
JWT_EXPIRATION=15m
REFRESH_TOKEN_SECRET=             # min 64 random bytes, different from JWT_SECRET
REFRESH_TOKEN_EXPIRATION=7d

# AI Providers
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-5-20251001
DEFAULT_AI_PROVIDER=anthropic

# Embeddings
VOYAGE_API_KEY=
EMBEDDING_MODEL=voyage-3-lite
EMBEDDING_DIMENSIONS=1024

# Frontend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```
