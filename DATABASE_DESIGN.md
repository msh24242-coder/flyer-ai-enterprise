# AI Marketing OS — Database Design

**Version**: 2.0  
**Status**: Design (awaiting approval)  
**Scope**: First vertical slice — Auth, Company, Agent Engine (observability, approval, orchestration), Goals, Campaigns, Tasks, Conversations, Memory

---

## 1. Engine & Extensions

- **PostgreSQL 16** (Docker Compose for dev, managed PostgreSQL for prod)
- **pgvector** extension for agent memory semantic search (Tiers 3–5)
- **Prisma 6** as ORM and migration manager

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

---

## 2. Entity Relationship Summary

```
Company (1) ─────── (N) User
Company (1) ─────── (N) MarketingGoal
Company (1) ─────── (N) Campaign
Company (1) ─────── (N) Conversation
Company (1) ─────── (N) AgentMemory
Company (1) ─────── (N) CompanyKnowledge      ← Tier 2 memory
Company (1) ─────── (N) AgentExecution        ← observability
Company (1) ─────── (N) ApprovalRequest       ← approval engine
Company (1) ─────── (N) AgentTask             ← orchestration

User    (1) ─────── (N) Conversation
User    (1) ─────── (N) RefreshToken

Campaign (1) ────── (N) Task
Campaign (1) ────── (1) MarketingGoal (optional)

Conversation (1) ── (N) Message

AgentExecution (1) ─ (N) ToolCallLog          ← observability detail

AuditLog → polymorphic, append-only
```

---

## 3. Prisma Schema

```prisma
// backend/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [uuidOssp(map: "uuid-ossp"), vector]
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum UserRole {
  OWNER       // Full company access
  ADMIN       // Manage team, see all campaigns
  MANAGER     // Create/edit campaigns
  VIEWER      // Read-only
}

enum CampaignStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum GoalStatus {
  ACTIVE
  ACHIEVED
  MISSED
  ARCHIVED
}

enum MessageRole {
  USER
  ASSISTANT
  TOOL_CALL     // agent tool invocation
  TOOL_RESULT   // result returned to agent
}

enum MemoryType {
  DECISION            // strategic decision made
  CAMPAIGN_INSIGHT    // learned from a campaign
  COMPANY_PREF        // expressed company preference (deprecated → LEARNED_PREFERENCE)
  LEARNED_PREFERENCE  // Tier 4: preferences across conversations
  GOAL_UPDATE         // goal created or refined
  LESSON              // post-campaign retrospective
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  AGENT_ACTION
}

enum PermissionLevel {
  READ
  WRITE
  APPROVAL_REQUIRED
  ADMIN_ONLY
}

enum ApprovalStatus {
  PENDING
  GRANTED
  DENIED
  EXPIRED
}

enum AgentType {
  DIRECTOR
  STRATEGY
  RESEARCH
  CONTENT
  SOCIAL
  PERFORMANCE
  ANALYTICS
  CREATIVE
}

enum AgentTaskStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  PENDING_AGENT     // target agent doesn't exist yet
  CANCELLED
}

// ─────────────────────────────────────────────
// COMPANY (TENANT ROOT)
// ─────────────────────────────────────────────

model Company {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String
  slug        String   @unique
  industry    String?
  website     String?
  logoUrl     String?

  plan        String   @default("free")   // free | pro | enterprise
  settings    Json     @default("{}")     // brandColors, toneOfVoice, timezone

  // Per-company AI provider config (overrides defaults)
  aiConfig    Json     @default("{}")     // { completionProvider, model, embeddingProvider }

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  users            User[]
  goals            MarketingGoal[]
  campaigns        Campaign[]
  conversations    Conversation[]
  memories         AgentMemory[]
  knowledge        CompanyKnowledge[]    // Tier 2 memory
  agentExecutions  AgentExecution[]
  approvalRequests ApprovalRequest[]
  agentTasks       AgentTask[]
  auditLogs        AuditLog[]

  @@map("companies")
}

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

model User {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId    String   @db.Uuid
  email        String   @unique
  passwordHash String                     // bcrypt cost 12 — never returned in API
  firstName    String
  lastName     String
  role         UserRole @default(MANAGER)
  avatarUrl    String?

  lastLoginAt  DateTime?
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  company       Company          @relation(fields: [companyId], references: [id])
  refreshTokens RefreshToken[]
  conversations Conversation[]
  auditLogs     AuditLog[]
  approvals     ApprovalRequest[] @relation("GrantedBy")

  @@index([companyId])
  @@index([email])
  @@map("users")
}

// ─────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────

model RefreshToken {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId      String   @db.Uuid
  tokenHash   String   @unique           // SHA-256 of raw token
  expiresAt   DateTime
  revokedAt   DateTime?
  userAgent   String?
  ipAddress   String?

  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("refresh_tokens")
}

// ─────────────────────────────────────────────
// COMPANY KNOWLEDGE (Tier 2 Memory — Structured)
// ─────────────────────────────────────────────
// Non-vector, always-loaded structured company context.
// Populated by onboarding and updated by Director agent via store_insight.

model CompanyKnowledge {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String   @db.Uuid

  // Category: icp | brand | product | market | tone | budget | team
  category    String

  // Human-readable label
  label       String   // e.g. "Ideal Customer Profile", "Monthly Marketing Budget"

  // Structured value (flexible JSON)
  value       Json

  // Free-text version (used for display and future embedding)
  summary     String?  @db.Text

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company     Company  @relation(fields: [companyId], references: [id])

  @@unique([companyId, category, label])
  @@index([companyId, category])
  @@map("company_knowledge")
}

// ─────────────────────────────────────────────
// MARKETING GOAL
// ─────────────────────────────────────────────

model MarketingGoal {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String     @db.Uuid
  title       String
  description String?    @db.Text
  status      GoalStatus @default(ACTIVE)

  // JSON: [{ metric: "MQL", target: 500, unit: "leads", period: "Q1 2026" }]
  targetMetrics Json     @default("[]")

  targetDate  DateTime?
  achievedAt  DateTime?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  deletedAt   DateTime?

  company     Company    @relation(fields: [companyId], references: [id])
  campaigns   Campaign[]

  @@index([companyId, status])
  @@map("marketing_goals")
}

// ─────────────────────────────────────────────
// CAMPAIGN
// ─────────────────────────────────────────────

model Campaign {
  id          String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String         @db.Uuid
  goalId      String?        @db.Uuid

  title       String
  description String?        @db.Text
  status      CampaignStatus @default(DRAFT)
  channels    String[]       @default([])
  budgetCents Int?

  startDate   DateTime?
  endDate     DateTime?

  // JSON: { objective, targetAudience, keyMessages[], successMetrics[] }
  brief       Json           @default("{}")

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  deletedAt   DateTime?

  company     Company        @relation(fields: [companyId], references: [id])
  goal        MarketingGoal? @relation(fields: [goalId], references: [id])
  tasks       Task[]

  @@index([companyId, status])
  @@index([goalId])
  @@map("campaigns")
}

// ─────────────────────────────────────────────
// TASK
// ─────────────────────────────────────────────

model Task {
  id           String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  campaignId   String       @db.Uuid

  title        String
  description  String?      @db.Text
  status       TaskStatus   @default(PENDING)
  priority     TaskPriority @default(MEDIUM)

  // "human" | "content_agent" | "social_agent" | etc.
  assigneeType String       @default("human")

  dueDate      DateTime?
  completedAt  DateTime?
  notes        String?      @db.Text

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  deletedAt    DateTime?

  campaign     Campaign     @relation(fields: [campaignId], references: [id])

  @@index([campaignId, status])
  @@map("tasks")
}

// ─────────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────────

model Conversation {
  id          String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String    @db.Uuid
  userId      String    @db.Uuid
  agentType   AgentType @default(DIRECTOR)
  title       String?   // auto-generated after first exchange

  // Token usage totals (updated after each turn)
  totalInputTokens  Int @default(0)
  totalOutputTokens Int @default(0)
  totalCostUsd      Float @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company     Company   @relation(fields: [companyId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  messages    Message[]

  @@index([companyId, userId])
  @@index([companyId, agentType])
  @@map("conversations")
}

// ─────────────────────────────────────────────
// MESSAGE
// ─────────────────────────────────────────────

model Message {
  id             String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  conversationId String      @db.Uuid
  role           MessageRole

  // Text content (null for pure tool_call messages)
  content        String?     @db.Text

  // TOOL_CALL: { toolName, toolUseId, input }
  toolCall       Json?

  // TOOL_RESULT: { toolUseId, result, isError }
  toolResult     Json?

  // Token counts for this message
  inputTokens    Int?
  outputTokens   Int?

  createdAt      DateTime    @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId, createdAt])
  @@map("messages")
}

// ─────────────────────────────────────────────
// AGENT MEMORY (pgvector — Tiers 3, 4, 5)
// ─────────────────────────────────────────────

model AgentMemory {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String     @db.Uuid
  agentType   AgentType  @default(DIRECTOR)
  type        MemoryType

  // Human-readable content (also used to generate the embedding)
  content     String     @db.Text

  // Source traceability
  sourceConversationId String? @db.Uuid

  // pgvector embedding (1024 dimensions for voyage-3-lite)
  // NULL when embedding API unavailable — retrieval falls back to recency
  embedding   Unsupported("vector(1024)")?

  // Importance score 0–1 (decays 10%/week, boosts +0.1 on retrieval)
  importance  Float      @default(0.5)
  retrievalCount Int     @default(0)
  lastRetrievedAt DateTime?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  company     Company    @relation(fields: [companyId], references: [id])

  @@index([companyId, agentType, type])
  @@map("agent_memory")
}

// ─────────────────────────────────────────────
// AGENT EXECUTION (Observability — per agent turn)
// ─────────────────────────────────────────────

model AgentExecution {
  id             String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  traceId        String    @db.Uuid   // links all records for one logical turn

  companyId      String    @db.Uuid
  conversationId String    @db.Uuid
  agentType      AgentType

  // Provider info
  aiProvider     String    // "anthropic" | "openai"
  modelId        String    // e.g. "claude-sonnet-5-20251001"

  // Timing (milliseconds)
  totalDurationMs          Int
  llmCallDurationMs        Int?
  toolExecutionDurationMs  Int?
  memoryRetrievalDurationMs Int?

  // Token usage
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  cacheReadTokens Int      @default(0)
  cacheWriteTokens Int     @default(0)

  // Cost in USD (calculated from model pricing)
  costUsd        Float     @default(0)

  // Summary
  toolCallsCount Int       @default(0)
  toolCallsFailed Int      @default(0)
  loopIterations Int       @default(1)

  // Error details (null on success)
  errorType      String?
  errorMessage   String?   @db.Text

  createdAt      DateTime  @default(now())

  company        Company      @relation(fields: [companyId], references: [id])
  toolCallLogs   ToolCallLog[]

  @@index([companyId, createdAt])
  @@index([traceId])
  @@index([conversationId])
  @@map("agent_executions")
}

// ─────────────────────────────────────────────
// TOOL CALL LOG (Observability — per tool invocation)
// ─────────────────────────────────────────────

model ToolCallLog {
  id              String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  executionId     String    @db.Uuid  // FK → AgentExecution
  traceId         String    @db.Uuid  // same traceId as parent execution

  toolName        String
  permissionLevel PermissionLevel

  // Sanitized — secrets and PII removed before storage
  inputPayload    Json

  // Short summary of what happened, e.g. "created campaign id=abc"
  resultSummary   String?
  isError         Boolean   @default(false)
  errorMessage    String?

  durationMs      Int

  createdAt       DateTime  @default(now())

  execution       AgentExecution @relation(fields: [executionId], references: [id])

  @@index([executionId])
  @@index([traceId])
  @@index([toolName])
  @@map("tool_call_logs")
}

// ─────────────────────────────────────────────
// APPROVAL REQUEST (Approval Engine)
// ─────────────────────────────────────────────

model ApprovalRequest {
  id             String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId      String         @db.Uuid
  conversationId String         @db.Uuid
  traceId        String         @db.Uuid   // links to AgentExecution

  agentType      AgentType
  toolName       String
  permissionLevel PermissionLevel @default(APPROVAL_REQUIRED)

  // Full tool input that will execute on approval
  toolInput      Json

  // Human-readable description of what will happen
  description    String         @db.Text

  status         ApprovalStatus @default(PENDING)

  // Who acted on it (null for agent-initiated denials / expirations)
  grantedById    String?        @db.Uuid
  actedAt        DateTime?
  denialReason   String?        @db.Text

  // Expiry — auto-denied after this time if no action
  expiresAt      DateTime

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  company        Company        @relation(fields: [companyId], references: [id])
  grantedBy      User?          @relation("GrantedBy", fields: [grantedById], references: [id])

  @@index([companyId, status])
  @@index([traceId])
  @@map("approval_requests")
}

// ─────────────────────────────────────────────
// AGENT TASK (Orchestration — agent-to-agent delegation)
// ─────────────────────────────────────────────

model AgentTask {
  id               String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId        String          @db.Uuid

  parentAgentType  AgentType
  targetAgentType  AgentType

  // Source context
  conversationId   String?         @db.Uuid
  campaignId       String?         @db.Uuid

  // Task input payload
  input            Json

  // Priority 1 (highest) → 5 (lowest)
  priority         Int             @default(3)

  status           AgentTaskStatus @default(QUEUED)

  // BullMQ job ID for cancellation
  bullmqJobId      String?

  result           Json?
  errorMessage     String?

  delegatedAt      DateTime        @default(now())
  startedAt        DateTime?
  completedAt      DateTime?

  company          Company         @relation(fields: [companyId], references: [id])

  @@index([companyId, status])
  @@index([targetAgentType, status])
  @@map("agent_tasks")
}

// ─────────────────────────────────────────────
// AUDIT LOG (Append-only)
// ─────────────────────────────────────────────

model AuditLog {
  id          String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String      @db.Uuid

  actorType   String      // "user" | "agent"
  actorId     String?     @db.Uuid   // userId or null for agent actions
  agentType   AgentType?

  action      AuditAction
  entityType  String      // "campaign" | "task" | "goal" | "approval" | etc.
  entityId    String      @db.Uuid

  before      Json?
  after       Json?

  traceId     String?     @db.Uuid   // links to AgentExecution when actor is agent

  ipAddress   String?
  userAgent   String?

  createdAt   DateTime    @default(now())

  company     Company     @relation(fields: [companyId], references: [id])
  user        User?       @relation(fields: [actorId], references: [id])

  @@index([companyId, createdAt])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

---

## 4. pgvector Indexes

Run after initial migration (Prisma does not support HNSW index creation):

```sql
-- Agent memory: semantic similarity search (Tiers 3, 4, 5)
CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx
ON agent_memory
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Place this in a standalone migration file (`migrations/manual/002_pgvector_indexes.sql`) or a post-migration script executed in CI.

---

## 5. Embedding Strategy

The `embedding` column on `agent_memory` is `vector(1024)` — sized for **Voyage AI voyage-3-lite**.

| Provider | Dimensions | Notes |
|----------|-----------|-------|
| **Voyage AI `voyage-3-lite`** | 1024 | **Default** — Anthropic-recommended, $0.02/1M tokens |
| OpenAI `text-embedding-3-small` | 1536 | Alternative (requires schema change to `vector(1536)`) |
| Local fallback | — | If no embedding API, column is NULL; retrieval uses recency order |

Environment config:
```bash
VOYAGE_API_KEY=
EMBEDDING_MODEL=voyage-3-lite
EMBEDDING_DIMENSIONS=1024
```

---

## 6. Memory Tier Mapping

| Tier | Name | Table | Retrieval |
|------|------|-------|-----------|
| 1 | Short-term | `messages` | Last 30 rows, ordered by `createdAt` |
| 2 | Long-term Company | `company_knowledge` | All rows for companyId, grouped by category |
| 3 | Campaign Insights | `agent_memory` (type=CAMPAIGN_INSIGHT) | Top-5 by cosine similarity |
| 4 | Learned Preferences | `agent_memory` (type=LEARNED_PREFERENCE) | Top-5 by cosine similarity |
| 5 | Semantic Memory | `agent_memory` (type=DECISION\|GOAL_UPDATE\|LESSON) | Top-5 by cosine similarity |

Tiers 3–5 share the same table and HNSW index; they are distinguished by the `type` column pre-filter.

---

## 7. Index Summary

| Table | Index | Purpose |
|-------|-------|---------|
| users | email | Login lookup |
| users | companyId | List company users |
| campaigns | companyId + status | Dashboard list |
| campaigns | goalId | Goal → campaigns |
| tasks | campaignId + status | Campaign task list |
| messages | conversationId + createdAt | Conversation history |
| agent_memory | companyId + agentType + type | Memory pre-filter before vector search |
| agent_memory | embedding (HNSW) | Semantic similarity |
| agent_executions | companyId + createdAt | Cost and usage reporting |
| agent_executions | traceId | Link to tool call logs |
| agent_executions | conversationId | Per-conversation cost |
| tool_call_logs | executionId | Execution → tool calls |
| tool_call_logs | traceId | Cross-execution trace |
| approval_requests | companyId + status | Approval inbox query |
| approval_requests | traceId | Approval → execution link |
| agent_tasks | companyId + status | Task queue dashboard |
| agent_tasks | targetAgentType + status | Agent-specific work queue |
| audit_logs | companyId + createdAt | Audit timeline |
| audit_logs | entityType + entityId | Per-entity history |
| company_knowledge | companyId + category | Structured context load |

---

## 8. Seed Data

```typescript
// backend/prisma/seed.ts — development only

const company = await prisma.company.create({
  data: {
    name: 'Demo Company',
    slug: 'demo-company',
    industry: 'B2B SaaS',
    plan: 'pro',
  },
});

const owner = await prisma.user.create({
  data: {
    companyId: company.id,
    email: 'demo@example.com',
    passwordHash: await bcrypt.hash('Demo123!@#', 12),
    firstName: 'Demo',
    lastName: 'User',
    role: 'OWNER',
  },
});

// Tier 2: initial company knowledge
await prisma.companyKnowledge.createMany({
  data: [
    {
      companyId: company.id,
      category: 'icp',
      label: 'Ideal Customer Profile',
      value: { title: 'VP of Operations', companySize: '50-200 employees', vertical: 'B2B SaaS' },
      summary: 'Target buyer is VP of Operations at mid-market B2B SaaS companies with 50-200 employees.',
    },
    {
      companyId: company.id,
      category: 'budget',
      label: 'Monthly Marketing Budget',
      value: { amountUsd: 5000, currency: 'USD' },
      summary: 'Monthly marketing budget is $5,000.',
    },
  ],
});

const goal = await prisma.marketingGoal.create({
  data: {
    companyId: company.id,
    title: 'Increase Brand Awareness Q1 2026',
    targetMetrics: [{ metric: 'impressions', target: 500000, unit: 'views' }],
    targetDate: new Date('2026-03-31'),
  },
});
```

---

## 9. Data Retention & Privacy

- `passwordHash` — never returned in API responses (excluded via Prisma `omit` or DTO mapping)
- `RefreshToken.tokenHash` — stores SHA-256 hash only; raw token is never persisted
- `ToolCallLog.inputPayload` — sanitized before write; PII and secrets stripped
- `deletedAt` — soft delete on Company, User, MarketingGoal, Campaign, Task; hard deletes require explicit admin action
- `AuditLog` — append-only enforced at service layer; no updates, no deletes
- Future GDPR export: `GET /users/me/export` (Phase 3)

---

## 10. Docker Compose (Dev)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ai_marketing_os
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]

volumes:
  pgdata:
  redisdata:
```

Removed from previous config: RabbitMQ, Elasticsearch, PgAdmin. BullMQ on Redis covers all queue needs; pgvector + PostgreSQL FTS covers all search needs; Prisma Studio covers DB UI.
