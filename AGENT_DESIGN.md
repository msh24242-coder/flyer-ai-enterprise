# AI Marketing OS — Marketing Director Agent Design

**Version**: 1.0  
**Status**: Design (awaiting approval)  
**Scope**: Marketing Director Agent — the only agent in the first vertical slice

---

## 1. Agent Role

The Marketing Director Agent is a senior marketing strategist embedded in the product. It holds a persistent conversation with the user, asks the right questions to understand their business situation, and translates goals into structured campaigns and tasks.

It does not execute the campaigns — it plans, organizes, and instructs. Other agents (Content, Social, Paid Media) will be added in later phases; the Director will delegate to them.

**Persona**: Experienced marketing director at a fast-growing company. Direct, structured, commercially minded. Asks one or two focused questions at a time. Does not give generic advice — everything is specific to this company's context and goals. Does not hallucinate metrics or make up market data.

---

## 2. Claude API Configuration

```typescript
// Model
model: 'claude-sonnet-5-20251001'

// Context strategy
max_tokens: 8096           // output limit per turn
temperature: 1             // required when using extended_thinking

// Extended thinking: enable for strategic analysis turns
// Disable for simple conversational turns to reduce latency/cost
betas: ['interleaved-thinking-2025-05-14']  // when thinking is enabled
```

**Model choice**: `claude-sonnet-5` — best balance of capability and cost for agentic tasks with tool use. Switch to `claude-opus-5` for complex strategy turns if quality requires it (add `thinkingModel` config option).

---

## 3. System Prompt

```
You are the Marketing Director for {{companyName}}, a {{industry}} company.

Your role is to help plan, organize, and guide the company's marketing efforts.
You have full context on their current goals, active campaigns, and past decisions.

## Your Responsibilities
- Understand the company's marketing situation through focused questions
- Help define clear, measurable marketing goals
- Break goals down into concrete campaigns with realistic timelines and budgets
- Create actionable tasks within each campaign, assigning them to the right person or agent
- Track progress and suggest adjustments when campaigns are off track
- Remember past decisions and build on them in future conversations

## How You Work
- Ask at most 2 focused questions per message — not a list of 8
- Always be specific to this company — never give generic marketing advice
- When you have enough context to create a campaign or task, do it using the tools provided
- Explain your reasoning briefly before using a tool
- After creating artifacts, summarize what you created and what happens next

## Constraints
- Do not invent metrics, market data, or competitor information
- Do not make financial projections without real data
- If you don't have enough information to make a recommendation, say so and ask
- Always use the tools to create campaigns and tasks — never just describe them

## Company Context
{{companyContext}}

## Current Goals
{{goalsContext}}

## Active Campaigns ({{activeCampaignCount}})
{{campaignsContext}}

## Recent Memories
{{memoriesContext}}

Today's date: {{currentDate}}
```

Context variables are injected at runtime — they are not static strings in the codebase.

---

## 4. Tool Definitions

All tools perform real database operations. No tool returns mock data in production.

### 4.1 `list_marketing_goals`

```typescript
{
  name: 'list_marketing_goals',
  description: 'Retrieve the company\'s marketing goals. Use this to understand current priorities before suggesting campaigns.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ACTIVE', 'ACHIEVED', 'MISSED', 'ARCHIVED', 'all'],
        description: 'Filter by goal status. Default: ACTIVE',
      },
    },
    required: [],
  },
}
```

**Executes**: `prisma.marketingGoal.findMany({ where: { companyId, status } })`

---

### 4.2 `create_marketing_goal`

```typescript
{
  name: 'create_marketing_goal',
  description: 'Create a new marketing goal. Use when the user expresses a clear business objective.',
  input_schema: {
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
        description: 'Measurable success criteria',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },    // e.g. "MQL", "impressions", "CAC"
            target: { type: 'number' },    // e.g. 500
            unit: { type: 'string' },      // e.g. "leads", "views", "USD"
            period: { type: 'string' },    // e.g. "Q1 2026", "monthly"
          },
          required: ['metric', 'target'],
        },
      },
      targetDate: {
        type: 'string',
        format: 'date',
        description: 'Target completion date (ISO 8601)',
      },
    },
    required: ['title'],
  },
}
```

---

### 4.3 `create_campaign`

```typescript
{
  name: 'create_campaign',
  description: 'Create a marketing campaign under a specific goal. A campaign is a coordinated set of marketing activities with a clear objective, timeline, and budget.',
  input_schema: {
    type: 'object',
    properties: {
      goalId: {
        type: 'string',
        description: 'UUID of the marketing goal this campaign supports. Get from list_marketing_goals.',
      },
      title: {
        type: 'string',
        description: 'Campaign name (e.g. "Q1 LinkedIn Thought Leadership Campaign")',
      },
      description: {
        type: 'string',
        description: 'Campaign overview — objective, approach, expected outcome',
      },
      channels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Marketing channels: e.g. ["linkedin", "email", "blog", "paid_search", "instagram"]',
      },
      budgetCents: {
        type: 'integer',
        description: 'Campaign budget in cents (e.g. 500000 = $5,000). Omit if not yet defined.',
      },
      startDate: {
        type: 'string',
        format: 'date',
        description: 'Campaign start date (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date',
        description: 'Campaign end date (ISO 8601)',
      },
      brief: {
        type: 'object',
        description: 'Structured campaign brief',
        properties: {
          objective: { type: 'string' },
          targetAudience: { type: 'string' },
          keyMessages: {
            type: 'array',
            items: { type: 'string' },
          },
          successMetrics: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    required: ['title'],
  },
}
```

---

### 4.4 `list_campaigns`

```typescript
{
  name: 'list_campaigns',
  description: 'Retrieve campaigns for this company, optionally filtered by status or goal.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'all'],
      },
      goalId: {
        type: 'string',
        description: 'Filter by goal UUID',
      },
    },
    required: [],
  },
}
```

---

### 4.5 `create_task`

```typescript
{
  name: 'create_task',
  description: 'Create a task within a campaign. Tasks are concrete actions that need to happen for the campaign to succeed.',
  input_schema: {
    type: 'object',
    properties: {
      campaignId: {
        type: 'string',
        description: 'UUID of the parent campaign',
      },
      title: {
        type: 'string',
        description: 'Action-oriented task title (e.g. "Write 4 LinkedIn articles on supply chain trends")',
      },
      description: {
        type: 'string',
        description: 'What needs to be done, acceptance criteria, any specific guidance',
      },
      assigneeType: {
        type: 'string',
        enum: ['human', 'content_agent', 'social_agent', 'research_agent'],
        description: 'Who should execute this. Use "human" unless it should be automated.',
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      },
      dueDate: {
        type: 'string',
        format: 'date',
      },
    },
    required: ['campaignId', 'title'],
  },
}
```

---

### 4.6 `update_campaign`

```typescript
{
  name: 'update_campaign',
  description: 'Update a campaign\'s status, budget, dates, or brief. Use when the user reports progress or requests changes.',
  input_schema: {
    type: 'object',
    properties: {
      campaignId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
      },
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

---

### 4.7 `update_task`

```typescript
{
  name: 'update_task',
  description: 'Update a task status or notes. Use when the user reports a task is done, blocked, or needs changes.',
  input_schema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
      },
      notes: {
        type: 'string',
        description: 'Progress notes, blockers, or completion details',
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      },
    },
    required: ['taskId'],
  },
}
```

---

### 4.8 `search_memory`

```typescript
{
  name: 'search_memory',
  description: 'Search past decisions, campaign insights, and company preferences stored in long-term memory. Use when you need context about past conversations or decisions.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query — what you want to remember (e.g. "budget constraints", "target audience for product X", "what worked last quarter")',
      },
      limit: {
        type: 'integer',
        description: 'Number of memories to retrieve (default: 5, max: 10)',
      },
    },
    required: ['query'],
  },
}
```

**Executes**: pgvector cosine similarity search on `agent_memory` table for this company.

---

### 4.9 `store_insight`

```typescript
{
  name: 'store_insight',
  description: 'Store an important insight, decision, or preference in long-term memory. Use when the user shares something that will inform future marketing decisions.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The insight to remember, written as a clear, standalone fact (e.g. "The company targets mid-market B2B SaaS companies with 50-200 employees. Their ICP is the VP of Operations.")',
      },
      type: {
        type: 'string',
        enum: ['COMPANY_PREF', 'DECISION', 'CAMPAIGN_INSIGHT', 'GOAL_UPDATE', 'LESSON'],
        description: 'Memory category for retrieval filtering',
      },
    },
    required: ['content', 'type'],
  },
}
```

---

## 5. Agent Execution Loop

```typescript
async function runDirectorAgent(
  conversationId: string,
  userMessage: string,
  companyContext: CompanyContext,
): Promise<AgentResponse> {
  
  // 1. Build context
  const history = await loadConversationHistory(conversationId, limit: 30)
  const memories = await searchMemory(companyContext.id, userMessage, limit: 5)
  const systemPrompt = buildSystemPrompt(companyContext, memories)
  
  // 2. Construct messages array for Claude
  const messages: MessageParam[] = [
    ...history.map(toAnthropicMessage),
    { role: 'user', content: userMessage },
  ]
  
  // 3. Agentic loop
  const toolCallsExecuted: ToolCallRecord[] = []
  let continueLoop = true
  
  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8096,
      system: systemPrompt,
      messages,
      tools: DIRECTOR_TOOLS,
    })
    
    if (response.stop_reason === 'end_turn') {
      // Final text response
      continueLoop = false
      return buildFinalResponse(response, toolCallsExecuted)
    }
    
    if (response.stop_reason === 'tool_use') {
      // Execute each tool call
      const toolResults: ToolResultBlockParam[] = []
      
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        
        const result = await executeTool(block.name, block.input, companyContext)
        toolCallsExecuted.push({ tool: block.name, input: block.input, result })
        
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      
      // Append assistant turn + tool results, continue loop
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }
  }
}
```

---

## 6. Memory Write Strategy

Memories are written **asynchronously** via a BullMQ job after the agent response is returned to the user — they do not block the response.

**When to store a memory** (agent decides via `store_insight` tool, or automatic):

| Trigger | Type | Example |
|---------|------|---------|
| User describes their ICP | COMPANY_PREF | "Target is VP Ops at 50-200 person SaaS" |
| Budget is discussed | COMPANY_PREF | "Monthly marketing budget is $15K" |
| Campaign is created | DECISION | "Created LinkedIn thought leadership campaign for Q1" |
| User reports campaign result | LESSON | "Email campaign achieved 28% open rate, above industry avg" |
| Goal is defined or updated | GOAL_UPDATE | "Primary goal changed to pipeline generation, not awareness" |

**Memory importance decay**: `importance` decreases by 10% per week. Retrieved memories get a +0.1 boost. This surfaces recently-relevant memories over stale ones.

---

## 7. Token & Cost Management

| Budget item | Limit | Action if exceeded |
|-------------|-------|-------------------|
| Messages in context | 30 most recent | Oldest are summarized (not dropped) |
| Memories injected | 5 per turn | Retrieved by relevance score |
| Max output tokens | 8,096 | Sufficient for structured campaign plans |
| Tool calls per turn | 10 (hard limit) | Return partial result with explanation |

**Cost estimate per conversation turn** (approximate):
- Input: ~4,000 tokens avg → $0.012 (claude-sonnet-5 pricing)
- Output: ~1,500 tokens avg → $0.018
- **~$0.03 per agent turn** at current pricing

Track per-conversation token usage in the `conversations` table for billing/analytics.

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude API timeout (>30s) | Return partial response + retry job via BullMQ |
| Tool execution failure | Return error as `tool_result` with `is_error: true`; agent handles gracefully |
| DB write failure during tool | Transaction rollback; agent informed via tool_result |
| Embedding API failure | Memory stored without embedding; retrieval falls back to recency |
| Rate limit from Anthropic | Exponential backoff with jitter; user sees "thinking..." state |
| Max tool calls exceeded | Agent stops, explains situation, asks user to continue |

---

## 9. What This Agent Does NOT Do (First Slice)

- Does not publish social media posts
- Does not create ad campaigns in Meta/Google
- Does not generate content or copy
- Does not send emails
- Does not access real-time market data
- Does not delegate to other agents (they don't exist yet)

All of these are Phase 2+ features. The Director creates the plan; execution agents will carry it out in future milestones.
