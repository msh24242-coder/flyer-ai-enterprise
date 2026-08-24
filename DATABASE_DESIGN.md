# AI Marketing OS — Database Design

**Version**: 1.0  
**Status**: Design (awaiting approval)  
**Scope**: First vertical slice — User, Auth, Company, Goals, Campaigns, Tasks, Conversations, Memory

---

## 1. Engine & Extensions

- **PostgreSQL 16** (Docker Compose for dev, managed PostgreSQL for prod)
- **pgvector** extension for agent memory and future semantic search
- **Prisma 6** as ORM and migration manager

```sql
-- Required extensions (applied via init script or first migration)
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

User    (1) ─────── (N) Conversation
User    (1) ─────── (N) RefreshToken

Campaign (1) ────── (N) Task
Campaign (1) ────── (1) MarketingGoal (optional link)

Conversation (1) ── (N) Message

AuditLog → polymorphic: records any mutation with actor + diff
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
  TOOL_CALL   // agent tool invocation record
  TOOL_RESULT // result returned to agent
}

enum MemoryType {
  DECISION        // agent made a strategic decision
  CAMPAIGN_INSIGHT // learned something about a campaign
  COMPANY_PREF    // user expressed a preference
  GOAL_UPDATE     // goal was refined or created
  LESSON          // post-campaign retrospective
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  AGENT_ACTION    // agent executed a tool
}

// ─────────────────────────────────────────────
// COMPANY (TENANT ROOT)
// ─────────────────────────────────────────────

model Company {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String
  slug        String   @unique           // used in URLs: /c/acme-corp
  industry    String?
  website     String?
  logoUrl     String?
  
  // Plan & limits
  plan        String   @default("free")  // free | pro | enterprise
  
  // Settings stored as JSON
  settings    Json     @default("{}")    // brandColors, toneOfVoice, etc.

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  // Relations
  users         User[]
  goals         MarketingGoal[]
  campaigns     Campaign[]
  conversations Conversation[]
  memories      AgentMemory[]
  auditLogs     AuditLog[]

  @@map("companies")
}

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

model User {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId    String   @db.Uuid
  email        String   @unique
  passwordHash String                     // bcrypt, never returned in API responses
  firstName    String
  lastName     String
  role         UserRole @default(MANAGER)
  avatarUrl    String?
  
  lastLoginAt  DateTime?
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  // Relations
  company       Company        @relation(fields: [companyId], references: [id])
  refreshTokens RefreshToken[]
  conversations Conversation[]
  auditLogs     AuditLog[]

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
  tokenHash   String   @unique           // SHA-256 of the actual token
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
// MARKETING GOAL
// ─────────────────────────────────────────────

model MarketingGoal {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String     @db.Uuid
  title       String
  description String?    @db.Text
  status      GoalStatus @default(ACTIVE)
  
  // Success metrics (flexible JSON — agent populates during conversation)
  // Example: { "metric": "MQL", "target": 500, "unit": "leads", "period": "Q1 2026" }
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
  goalId      String?        @db.Uuid    // optional link to a goal
  
  title       String
  description String?        @db.Text
  status      CampaignStatus @default(DRAFT)
  
  // Channels targeted (e.g. ["social_media", "email", "paid_search"])
  channels    String[]       @default([])
  
  // Budget in cents (avoid floating-point)
  budgetCents Int?
  
  startDate   DateTime?
  endDate     DateTime?
  
  // Agent-generated brief stored as structured JSON
  // { objective, targetAudience, keyMessages, successMetrics }
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
  
  // Who should do this: "human" | "content_agent" | "social_agent" | etc.
  assigneeType String       @default("human")
  
  dueDate      DateTime?
  completedAt  DateTime?
  
  // Freeform notes (progress updates, blockers)
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
  
  // Which agent is this conversation with
  agentType   String    @default("director")
  
  title       String?   // auto-generated after first exchange, user-editable
  
  // Token usage tracking
  totalInputTokens  Int @default(0)
  totalOutputTokens Int @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company     Company   @relation(fields: [companyId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  messages    Message[]

  @@index([companyId, userId])
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
  
  // For TOOL_CALL messages: the tool invocation details
  // { toolName, toolUseId, input }
  toolCall       Json?
  
  // For TOOL_RESULT messages: the result returned to the agent
  // { toolUseId, result, isError }
  toolResult     Json?
  
  // Token counts for this specific message
  inputTokens    Int?
  outputTokens   Int?

  createdAt      DateTime    @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId, createdAt])
  @@map("messages")
}

// ─────────────────────────────────────────────
// AGENT MEMORY (pgvector)
// ─────────────────────────────────────────────

model AgentMemory {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String     @db.Uuid
  agentType   String     @default("director")
  type        MemoryType
  
  // Human-readable content (also used to generate the embedding)
  content     String     @db.Text
  
  // Source context
  sourceConversationId String? @db.Uuid
  
  // pgvector embedding (1536 dimensions for text-embedding-3-small, or use Anthropic's)
  // We use OpenAI's embedding API for now — or a local model later
  // Dimension: 1536 (text-embedding-3-small) or 1024 (voyage-3-lite)
  embedding   Unsupported("vector(1536)")?
  
  // Importance score 0-1, decays over time, boosts on retrieval
  importance  Float      @default(0.5)
  
  // How many times this memory was retrieved (used for importance boosting)
  retrievalCount Int     @default(0)
  lastRetrievedAt DateTime?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  company     Company    @relation(fields: [companyId], references: [id])

  @@index([companyId, agentType])
  @@map("agent_memory")
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

model AuditLog {
  id          String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  companyId   String      @db.Uuid
  
  // Actor: human user or agent
  actorType   String      // "user" | "agent"
  actorId     String?     @db.Uuid  // userId or null for agent
  agentType   String?     // "director" | etc. when actorType = "agent"
  
  action      AuditAction
  
  // What entity was affected
  entityType  String      // "campaign" | "task" | "goal" | etc.
  entityId    String      @db.Uuid
  
  // Before and after snapshots (null for creates/deletes)
  before      Json?
  after       Json?
  
  // Request metadata
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

## 4. pgvector Index

After running migrations, create the vector index:

```sql
-- Run once after migration, not in Prisma (Prisma doesn't support HNSW yet)
CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx
ON agent_memory
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

This goes in a dedicated migration file or a post-migration script.

---

## 5. Embedding Strategy

**For the first vertical slice**, we use Anthropic does not expose an embeddings API directly. Options:

| Option | Dimensions | Cost | Quality |
|--------|-----------|------|---------|
| OpenAI `text-embedding-3-small` | 1536 | $0.02/1M tokens | Excellent |
| Voyage AI `voyage-3-lite` | 1024 (configurable) | $0.02/1M tokens | Excellent, Anthropic-recommended |
| Local (Ollama `nomic-embed`) | 768 | Free | Good |

**Recommendation**: Use **Voyage AI** (`voyage-3-lite`) — Anthropic's recommended embedding partner, 1024 dimensions, very cost-effective. Adjust schema dimension from 1536 to 1024 if Voyage is chosen.

Add to .env:
```
VOYAGE_API_KEY=<your key>
EMBEDDING_MODEL=voyage-3-lite
EMBEDDING_DIMENSIONS=1024
```

If no embedding API is available in development, memories still save as text — the `embedding` column allows NULL and retrieval falls back to recency ordering.

---

## 6. Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| users | email | Login lookup |
| users | companyId | List company users |
| campaigns | companyId + status | Dashboard list |
| campaigns | goalId | Goal → campaigns |
| tasks | campaignId + status | Campaign task list |
| messages | conversationId + createdAt | Conversation history |
| agent_memory | companyId + agentType | Memory pre-filter |
| agent_memory | embedding (HNSW) | Semantic similarity |
| audit_logs | companyId + createdAt | Audit timeline |
| audit_logs | entityType + entityId | Per-entity history |

---

## 7. Seed Data

```typescript
// backend/prisma/seed.ts — for development only

const company = await prisma.company.create({
  data: {
    name: 'Demo Company',
    slug: 'demo-company',
    industry: 'E-commerce',
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

## 8. Data Retention & Privacy Notes

- `passwordHash` is never returned in any API response (Prisma `omit` or manual exclusion)
- `RefreshToken.tokenHash` stores only SHA-256 hash, never the raw token
- `deletedAt` enables soft deletes; hard deletes require explicit admin action
- `AuditLog` is append-only (no updates, no deletes) — enforced at service layer
- User PII: `email`, `firstName`, `lastName` — future GDPR export via `GET /users/me/export`
