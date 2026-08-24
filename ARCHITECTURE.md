# AI Marketing OS — Architecture

**Version**: 1.0  
**Status**: Design (awaiting approval)  
**Scope**: Full system design; first vertical slice is Marketing Director Agent end-to-end

---

## 1. Product Vision

AI Marketing OS is a multi-tenant SaaS platform where a company's marketing work is driven by a team of specialized AI agents. Each agent has domain expertise, access to the company's knowledge base, and the ability to create real artifacts (campaigns, tasks, content briefs). Humans stay in control through an approval workflow — agents propose, humans decide, agents execute.

The first milestone delivers one agent end-to-end: the **Marketing Director Agent**, which conducts a persistent conversation with the user, understands the company's marketing goals, and creates campaigns and tasks backed by a real database.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                          │
│   Next.js 15 App  ·  Chat UI  ·  Dashboard  ·  Approval Inbox  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS / REST + SSE
┌───────────────────────────────▼─────────────────────────────────┐
│                         NestJS API (Port 3001)                   │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │   Auth   │ │Companies │ │ Conversations│ │   Campaigns   │  │
│  └──────────┘ └──────────┘ └──────┬───────┘ └───────────────┘  │
│                                   │                              │
│                        ┌──────────▼───────────┐                 │
│                        │  Agent Orchestrator  │                 │
│                        │  (Director Agent)    │                 │
│                        └──────────┬───────────┘                 │
│                                   │ tool_use                     │
│                        ┌──────────▼───────────┐                 │
│                        │   Claude API         │                 │
│                        │   (claude-sonnet-5)  │                 │
│                        └──────────────────────┘                 │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────┐
           │                       │                   │
  ┌────────▼────────┐   ┌─────────▼──────┐   ┌───────▼──────┐
  │  PostgreSQL 16  │   │   Redis 7      │   │   BullMQ     │
  │  + pgvector     │   │   (cache/      │   │   Workers    │
  │  (Prisma ORM)   │   │    sessions)   │   │   (jobs)     │
  └─────────────────┘   └────────────────┘   └──────────────┘
```

---

## 3. Tech Stack

### 3.1 Decisions and Rationale

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 15 + React 19 | App Router + Server Components for fast dashboard; existing next.config.js reusable |
| **UI System** | shadcn/ui + existing tailwind.config.ts | Token system already configured; saves setup; consistent radix primitives |
| **API** | NestJS 11 + TypeScript strict | Modular, decorator-driven; aligns with multi-agent service decomposition |
| **ORM** | Prisma 6 | Type-safe DB access; migration tracking; generator for query types |
| **Database** | PostgreSQL 16 + pgvector | Single engine covers relational data + semantic vector search; no separate vector DB |
| **Auth** | Custom JWT (NestJS Passport) | No external auth dependency; full control; works immediately with local Docker PG |
| **AI** | Anthropic SDK (`@anthropic-ai/sdk`) + Claude claude-sonnet-5 | Native tool_use; extended thinking; 200K context for company knowledge |
| **Queue** | BullMQ + Redis | Built on Redis (already present); excellent retry/delay/cron; replaces bare RabbitMQ |
| **Cache** | Redis 7 | Session store + response cache + BullMQ backing |
| **Streaming** | SSE (Server-Sent Events) | Real-time agent response streaming; no WebSocket complexity for first slice |

### 3.2 What is Dropped from Old Stack

| Removed | Reason |
|---------|--------|
| RabbitMQ | BullMQ on Redis covers all queue needs; one less service |
| Elasticsearch | pgvector handles semantic search; PostgreSQL FTS handles text search |
| PgAdmin | Prisma Studio serves the same dev need without a running container |

---

## 4. Repository Structure

```
ai-marketing-os/             ← rename from flyer-ai-enterprise
├── backend/                 ← NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/            ← JWT auth, guards, strategies
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   ├── companies/       ← company/tenant management
│   │   │   ├── companies.module.ts
│   │   │   ├── companies.controller.ts
│   │   │   ├── companies.service.ts
│   │   │   └── dto/
│   │   ├── users/           ← user profile, within a company
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   ├── conversations/   ← persistent agent conversations
│   │   │   ├── conversations.module.ts
│   │   │   ├── conversations.controller.ts
│   │   │   ├── conversations.service.ts
│   │   │   └── dto/
│   │   ├── agents/          ← agent orchestration layer
│   │   │   ├── agents.module.ts
│   │   │   ├── base-agent.service.ts       ← abstract base
│   │   │   ├── director/
│   │   │   │   ├── director-agent.service.ts
│   │   │   │   ├── director-agent.tools.ts ← tool definitions
│   │   │   │   └── director-agent.prompt.ts
│   │   │   └── memory/
│   │   │       ├── memory.service.ts       ← pgvector read/write
│   │   │       └── memory.types.ts
│   │   ├── goals/           ← marketing goals
│   │   │   ├── goals.module.ts
│   │   │   ├── goals.controller.ts
│   │   │   ├── goals.service.ts
│   │   │   └── dto/
│   │   ├── campaigns/       ← campaigns + tasks
│   │   │   ├── campaigns.module.ts
│   │   │   ├── campaigns.controller.ts
│   │   │   ├── campaigns.service.ts
│   │   │   └── dto/
│   │   ├── tasks/
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   └── dto/
│   │   ├── database/        ← Prisma setup
│   │   │   ├── database.module.ts
│   │   │   └── prisma.service.ts
│   │   └── common/          ← shared guards, pipes, interceptors, decorators
│   │       ├── decorators/
│   │       │   └── current-user.decorator.ts
│   │       ├── filters/
│   │       │   └── all-exceptions.filter.ts
│   │       ├── interceptors/
│   │       │   └── transform.interceptor.ts
│   │       └── pipes/
│   │           └── validation.pipe.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── test/
│   │   └── auth.e2e-spec.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                ← Next.js App
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   └── (dashboard)/
│   │   │       ├── layout.tsx          ← sidebar + topbar
│   │   │       ├── page.tsx            ← overview: goals, active campaigns
│   │   │       ├── chat/
│   │   │       │   └── page.tsx        ← Marketing Director Agent chat
│   │   │       ├── goals/
│   │   │       │   └── page.tsx
│   │   │       └── campaigns/
│   │   │           ├── page.tsx
│   │   │           └── [id]/page.tsx
│   │   ├── components/
│   │   │   ├── ui/              ← shadcn/ui components
│   │   │   ├── chat/
│   │   │   │   ├── message-list.tsx
│   │   │   │   ├── message-input.tsx
│   │   │   │   └── tool-call-display.tsx
│   │   │   ├── campaigns/
│   │   │   └── layout/
│   │   │       ├── sidebar.tsx
│   │   │       └── topbar.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts    ← typed fetch wrapper
│   │   │   └── auth.ts          ← token management
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   └── use-conversation.ts
│   │   ├── store/
│   │   │   └── auth.store.ts    ← Zustand
│   │   └── types/
│   │       └── index.ts
│   ├── public/
│   ├── package.json
│   ├── next.config.js           ← reuse existing
│   ├── tailwind.config.ts       ← reuse existing
│   └── tsconfig.json
│
├── docker-compose.yml           ← updated (remove backend build, remove ES/Rabbit)
├── docker-compose.dev.yml       ← dev overrides with hot reload
├── .env.example                 ← updated for new stack
├── .gitignore                   ← ensure .env is listed
├── ARCHITECTURE.md              ← this file
├── DATABASE_DESIGN.md
├── AGENT_DESIGN.md
└── IMPLEMENTATION_PLAN.md
```

---

## 5. Authentication Flow

Custom JWT, no external auth service dependency.

```
Register:
  POST /auth/register { email, password, firstName, lastName, companyName }
  → creates Company + User (OWNER role)
  → returns { accessToken, refreshToken, user, company }

Login:
  POST /auth/login { email, password }
  → validates bcrypt hash
  → returns { accessToken (15m), refreshToken (7d), user, company }

Refresh:
  POST /auth/refresh { refreshToken }
  → validates refresh token from DB (stored hashed)
  → issues new access + refresh token pair (rotation)
  → old refresh token invalidated

Every authenticated request:
  Authorization: Bearer <accessToken>
  → JwtAuthGuard validates signature + expiry
  → CurrentUser decorator injects { userId, companyId, role }
```

**Multi-tenancy**: Every database query is scoped by `companyId` extracted from the JWT payload. There is no cross-tenant data access.

---

## 6. Agent Communication Pattern

The Marketing Director Agent runs within an HTTP request/response cycle for synchronous responses, with SSE streaming for real-time output.

```
POST /conversations/:id/messages
  Body: { content: string }

1. Save user message to DB (role: USER)
2. Load conversation history (last N messages)
3. Retrieve relevant memories (pgvector similarity search)
4. Load company context (goals, active campaigns, company profile)
5. Call Claude claude-sonnet-5 with:
   - system prompt (director persona + company context + memories)
   - messages (conversation history + new user message)
   - tools (create_campaign, create_task, list_goals, etc.)
6. Handle tool calls:
   a. Execute tool (real DB operation)
   b. Append tool_result to message array
   c. Continue Claude call until no more tool calls
7. Save assistant message to DB (role: ASSISTANT)
8. Save notable decisions to memory (async, via BullMQ job)
9. Return final response

Response format: { message, toolCallsExecuted: [], tokensUsed: {} }
Streaming: SSE endpoint /conversations/:id/stream for real-time display
```

---

## 7. Memory Architecture

Agent memory uses pgvector for semantic retrieval. Two memory types:

**Working Memory** (conversation context, loaded every turn):
- Last 20 messages of current conversation
- Company goals and active campaigns (structured query, not vector)

**Long-term Memory** (semantic search):
- Key decisions made by the agent
- Campaign outcomes and lessons
- Company preferences expressed in conversation
- Stored with embedding, retrieved by cosine similarity

```
Memory retrieval on each agent turn:
  query_embedding = embed(user_message)
  relevant_memories = SELECT * FROM agent_memory
    WHERE company_id = $1
    ORDER BY embedding <=> query_embedding
    LIMIT 5
    WHERE similarity > 0.75
```

---

## 8. API Design Principles

- Base path: `/api/v1`
- All responses: `{ data: T, meta?: { pagination } }`
- All errors: `{ error: { code, message, details? }, timestamp, path }`
- HTTP status codes used correctly (201 for creates, 204 for deletes)
- Pagination: `?page=1&limit=20` on all list endpoints
- Soft deletes: `deletedAt` timestamp, never physical deletes
- Audit trail: every mutation appends to `audit_logs` table

---

## 9. Environment Variables

```
# App
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_marketing_os

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<min 64 chars, randomly generated>
JWT_EXPIRATION=15m
REFRESH_TOKEN_SECRET=<min 64 chars, different from JWT_SECRET>
REFRESH_TOKEN_EXPIRATION=7d

# Anthropic
ANTHROPIC_API_KEY=<your key>
CLAUDE_MODEL=claude-sonnet-5-20251001

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## 10. Security Baseline

| Concern | Implementation |
|---------|----------------|
| Password storage | bcrypt, cost factor 12 |
| JWT secrets | Min 64 random bytes, never committed |
| Refresh token | Stored hashed (SHA-256), rotated on use |
| Rate limiting | `@nestjs/throttler`: 100 req/15min globally, 10/min on auth endpoints |
| Input validation | `class-validator` on all DTOs, `ValidationPipe(transform: true, whitelist: true)` |
| SQL injection | Prisma parameterized queries only, no raw SQL except pgvector similarity |
| CORS | Explicit allowlist of `FRONTEND_URL` |
| Company isolation | `companyId` on every query extracted from verified JWT |
| .env | In .gitignore; `.env.example` is the only committed env file |
