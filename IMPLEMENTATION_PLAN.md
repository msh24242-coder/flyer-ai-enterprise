# AI Marketing OS — Implementation Plan

**Version**: 2.0  
**Status**: Design (awaiting approval)  
**Scope**: First vertical slice end-to-end — Auth → Company → Agent Engine → Marketing Director → Memory → Goals → Campaigns → Tasks → Dashboard

---

## Guiding Principles

1. **No placeholder code** — every file delivered is real and functional
2. **No mock agents** — only the Director Agent is built; future agents are not stubbed
3. **No fake APIs** — every endpoint talks to a real database
4. **Test doubles only in tests** — no mock data in production paths
5. **Security-first** — credentials rotated before any implementation begins
6. **Layer discipline** — no layer skips another (see ARCHITECTURE.md §2)
7. **Observability from day one** — tracing and cost tracking wired in Phase 1

---

## Pre-Implementation Security Checklist

**MUST COMPLETE BEFORE WRITING ANY CODE**

- [ ] Rotate Supabase database password (`FlyerAI2026Secure` is exposed in committed `.env`)
- [ ] Regenerate Supabase project credentials (project `swnvjzdhwdthjujugsup`)
- [ ] Purge `.env` from entire git history (`git filter-repo` or `BFG Repo-Cleaner`)
- [ ] Add `.env` to `.gitignore` (confirm it is listed)
- [ ] Generate new `JWT_SECRET` — minimum 64 random bytes (`openssl rand -hex 64`)
- [ ] Generate new `REFRESH_TOKEN_SECRET` — different value, same length
- [ ] Add `.env.example` with blank values and documentation — this file IS committed
- [ ] Verify: `git log --all -- .env` shows no `.env` commits in new history

This is not optional. The old credentials are permanently compromised.

---

## Phase 0 — Repository Foundation
**Duration**: 1 day

### 0.1 Clean Up Stale Documentation

- [ ] Delete `COMPLETION_SUMMARY.md` (describes a non-existent implementation)
- [ ] Delete `AUDIT_SUMMARY.md` (audit of the other machine's project)
- [ ] Delete `IMPLEMENTATION_ROADMAP.md` (superseded by this plan)
- [ ] Delete `structure.txt` (3MB Windows tree output)
- [ ] Retain: `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `AGENT_DESIGN.md`, `IMPLEMENTATION_PLAN.md`

### 0.2 Monorepo Workspace Setup

```
ai-marketing-os/
├── backend/          ← NestJS 11 API
├── frontend/         ← Next.js 15 App
├── package.json      ← workspace root (pnpm workspaces)
└── docker-compose.yml
```

**Root `package.json`**:
```json
{
  "name": "ai-marketing-os",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "engines": { "node": ">=20" }
}
```

### 0.3 Docker Compose

Two services only:
- `pgvector/pgvector:pg16` — PostgreSQL 16 with pgvector extension
- `redis:7-alpine` — Redis for BullMQ + session cache

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

### 0.4 Backend Scaffold

```bash
cd backend
nest new . --strict --package-manager pnpm

pnpm add @nestjs/config @nestjs/jwt @nestjs/passport
pnpm add @prisma/client @anthropic-ai/sdk bullmq ioredis
pnpm add bcrypt class-validator class-transformer
pnpm add -D prisma @types/bcrypt typescript@5 ts-jest
```

### 0.5 Frontend Scaffold

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
pnpm add @tanstack/react-query axios zustand
npx shadcn-ui@latest init
```

**Deliverables — Phase 0**:
- [ ] Clean repo (stale docs removed)
- [ ] `docker-compose.yml` — postgres + redis only
- [ ] `backend/` — NestJS scaffold with strict TypeScript
- [ ] `frontend/` — Next.js 15 App Router scaffold
- [ ] `backend/.env.example` — all variables documented with blank values
- [ ] `.gitignore` — `.env` listed

---

## Phase 0.5 — Agent Engine Foundation
**Duration**: 2 days  
**Why before Phase 1**: Every other phase builds on this. Getting the interfaces right first prevents costly rewrites later.

### 0.5.1 Prisma Schema + Initial Migration

Write the full schema from `DATABASE_DESIGN.md`:
- All models: Company, User, RefreshToken, CompanyKnowledge, MarketingGoal, Campaign, Task, Conversation, Message, AgentMemory, AgentExecution, ToolCallLog, ApprovalRequest, AgentTask, AuditLog
- All enums (including PermissionLevel, AgentType, AgentTaskStatus, ApprovalStatus)
- Run: `prisma migrate dev --name init`
- Run pgvector index SQL as manual migration file (HNSW — Prisma doesn't support it yet)
- Run: `prisma generate`

### 0.5.2 AI Provider Interface

```
backend/src/agent-engine/
├── agent-engine.module.ts
├── base/
│   ├── agent-engine.abstract.ts       ← AgentEngine abstract class
│   ├── agent-context.types.ts          ← AgentContext, AgentInput, AgentOutput
│   ├── agent-tool.types.ts             ← CanonicalTool, CanonicalMessage, ToolCallRequest
│   └── agent-config.types.ts           ← AgentProviderConfig, AgentConfig
├── providers/
│   ├── ai-provider.interface.ts        ← AIProvider, EmbeddingProvider interfaces
│   ├── anthropic.provider.ts           ← AnthropicProvider (first slice)
│   └── voyage.embedding.provider.ts    ← VoyageEmbeddingProvider (first slice)
```

`AnthropicProvider` must:
- Translate `CanonicalMessage[]` → Anthropic `MessageParam[]`
- Translate `CanonicalTool[]` → Anthropic tool definitions
- Translate Anthropic response → `CompletionResponse`
- Handle streaming via SSE
- Handle extended thinking (pass-through, disabled by default)

### 0.5.3 Memory System

```
backend/src/agent-engine/memory/
├── memory-system.service.ts    ← orchestrates all 5 tiers
├── short-term.memory.ts        ← Tier 1: load last 30 messages
├── long-term.memory.ts         ← Tier 2: load CompanyKnowledge
├── semantic.memory.ts          ← Tier 3+4+5: pgvector cosine search
└── memory.types.ts
```

`MemorySystem.buildContext(conversationId, userMessage, companyId)` returns full `AgentContext`.

`MemorySystem.store(content, type, companyId)` saves to `agent_memory` and enqueues embedding job.

### 0.5.4 Approval Engine

```
backend/src/agent-engine/approval/
├── approval-engine.service.ts  ← gate(), createRequest(), grant(), deny()
├── approval.types.ts
└── permission-level.enum.ts    ← READ | WRITE | APPROVAL_REQUIRED | ADMIN_ONLY
```

`ApprovalEngine.gate(permissionLevel, toolInput, context)`:
- `READ` → pass-through
- `WRITE` → pass-through (audit log written after execution)
- `APPROVAL_REQUIRED` → throw `ApprovalRequiredException` (engine catches, pauses loop)
- `ADMIN_ONLY` → throw `AdminOnlyException` (engine catches, returns error tool_result)

### 0.5.5 Observability

```
backend/src/agent-engine/observability/
├── observability-tracer.service.ts   ← start(), recordToolCall(), finish()
├── cost-calculator.ts                ← calculateCost(usage, modelId)
└── execution-log.types.ts
```

`ObservabilityTracer.finish()` writes `AgentExecution` + all `ToolCallLog` records in one transaction.

### 0.5.6 Orchestration (structurally complete)

```
backend/src/agent-engine/orchestration/
├── agent-orchestrator.service.ts   ← delegate() → creates AgentTask, queues BullMQ job
└── agent-task.types.ts
```

`AgentOrchestrator.delegate()` creates an `AgentTask` with status `PENDING_AGENT` in the first slice (no target agents exist). This is correct behavior — not a stub, not an error.

### 0.5.7 Agent Engine Abstract Class

`AgentEngine.run()` implements the full agentic loop from `AGENT_DESIGN.md §8`:
1. Start observability trace
2. Build AgentContext (all 5 memory tiers)
3. Build system prompt (via `buildSystemPrompt()`)
4. Loop: call provider → gate approval → execute tools → append results
5. Save messages, enqueue memory job, record observability
6. Return `AgentOutput`

**Deliverables — Phase 0.5**:
- [ ] `prisma/schema.prisma` — full schema, all models
- [ ] `prisma/migrations/` — initial migration (SQL)
- [ ] pgvector HNSW index (manual SQL migration file)
- [ ] `agent-engine/providers/ai-provider.interface.ts`
- [ ] `agent-engine/providers/anthropic.provider.ts`
- [ ] `agent-engine/providers/voyage.embedding.provider.ts`
- [ ] `agent-engine/memory/memory-system.service.ts` + tier files
- [ ] `agent-engine/approval/approval-engine.service.ts`
- [ ] `agent-engine/observability/observability-tracer.service.ts`
- [ ] `agent-engine/orchestration/agent-orchestrator.service.ts`
- [ ] `agent-engine/base/agent-engine.abstract.ts` (full loop)
- [ ] Unit tests: AnthropicProvider translation, MemorySystem context build, ApprovalEngine gating, cost calculation

---

## Phase 1 — Auth, Company, Core API
**Duration**: 2 days

### 1.1 Auth Module

**Endpoints**:
- `POST /auth/register` — creates User + Company in one transaction
- `POST /auth/login` — returns JWT (15m) + refresh token (7d, httpOnly cookie)
- `POST /auth/refresh` — rotates refresh token, returns new JWT
- `POST /auth/logout` — revokes refresh token

**Implementation**:
- Passwords: `bcrypt.hash(password, 12)`
- JWT: `@nestjs/jwt` with `JWT_SECRET` (min 64 bytes)
- Refresh tokens: SHA-256 hash stored in `refresh_tokens`; raw token in httpOnly cookie
- Rate limit: `10 req/min` on all `/auth/*` routes
- Guard: `JwtAuthGuard` — validates JWT, attaches `{ userId, companyId, role }` to request
- `companyId` is extracted from JWT on every authenticated request — never from query params

### 1.2 Company Module

**Endpoints**:
- `GET /company` — current user's company details
- `PATCH /company` — update name, industry, settings (OWNER/ADMIN only)
- `GET /company/users` — list company users (ADMIN+)
- `PATCH /company/users/:id/role` — change user role (OWNER only)

### 1.3 Common Infrastructure

- `JwtAuthGuard` — applies to all routes; extracts `companyId` + `userId` + `role`
- `RolesGuard` — checks `UserRole` on decorated routes
- `CompanyInterceptor` — ensures all DB queries include `companyId` from JWT
- `ValidationPipe` — `whitelist: true, forbidNonWhitelisted: true` globally
- `GlobalExceptionFilter` — structured error responses, never leaks stack traces
- `HealthController` — `GET /health` returns 200 + version
- BullMQ connection — `QueueModule` with Redis config from env

**Deliverables — Phase 1**:
- [ ] `auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- [ ] `auth/strategies/jwt.strategy.ts`, `auth/guards/jwt-auth.guard.ts`
- [ ] `auth/guards/roles.guard.ts`
- [ ] `companies/companies.module.ts`, `.controller.ts`, `.service.ts`
- [ ] `database/prisma.service.ts`
- [ ] `common/filters/global-exception.filter.ts`
- [ ] `common/interceptors/company.interceptor.ts`
- [ ] `scheduler/queue.module.ts` — BullMQ setup
- [ ] `health/health.controller.ts`
- [ ] Integration tests: register → login → refresh → logout → protected route

---

## Phase 2 — Marketing Director Agent
**Duration**: 3 days

### 2.1 Business Services

These services are what agent tools call. They enforce `companyId` isolation and write audit logs.

- `GoalsService`: `list()`, `create()`, `update()`, `findOne()`
- `CampaignService`: `list()`, `create()`, `update()`, `findOne()`
- `TaskService`: `list()`, `create()`, `update()`, `findOne()`

Each mutating method:
1. Verifies the entity belongs to the caller's `companyId`
2. Executes the DB write in a transaction
3. Writes an `AuditLog` entry (before/after snapshot on updates)

### 2.2 Director Agent Implementation

```
backend/src/agents/
├── agents.module.ts
└── director/
    ├── director-agent.service.ts    ← extends AgentEngine
    ├── director-agent.prompt.ts     ← buildDirectorPrompt(context)
    └── director-agent.tools.ts      ← 9 CanonicalTool definitions + implementations
```

Tool implementations call the Application Services from §2.1 — never direct Prisma calls.

### 2.3 Conversations Module

**Endpoints**:
- `POST /conversations` — create new conversation (returns `conversationId`)
- `POST /conversations/:id/messages` — send message, returns AgentOutput (or 202 if approval needed)
- `GET /conversations/:id/stream` — SSE stream for real-time agent output
- `GET /conversations` — list conversations (paginated)
- `GET /conversations/:id/messages` — full message history

**SSE streaming**:
```typescript
// Stream token chunks as they arrive from AnthropicProvider
res.setHeader('Content-Type', 'text/event-stream')
for await (const chunk of provider.stream(request)) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}
res.write('data: [DONE]\n\n')
res.end()
```

### 2.4 Approval HTTP API

- `GET /approvals` — list pending approvals for company (MANAGER+)
- `POST /approvals/:id/grant` — grant approval (ADMIN+)
- `POST /approvals/:id/deny` — deny with reason (ADMIN+)

On grant → BullMQ job resumes the agent turn, executes the tool, continues the loop.

### 2.5 Memory Jobs (BullMQ)

```
backend/src/scheduler/jobs/
├── embed-memory.job.ts          ← generate embedding for new AgentMemory row
├── analyze-turn.job.ts          ← post-turn memory extraction
└── update-memory-scores.job.ts  ← weekly importance decay job
```

**Deliverables — Phase 2**:
- [ ] `goals/goals.module.ts`, `.controller.ts`, `.service.ts`
- [ ] `campaigns/campaigns.module.ts`, `.controller.ts`, `.service.ts`
- [ ] `tasks/tasks.module.ts`, `.controller.ts`, `.service.ts`
- [ ] `agents/director/director-agent.service.ts`
- [ ] `agents/director/director-agent.prompt.ts`
- [ ] `agents/director/director-agent.tools.ts` (all 9 tools implemented)
- [ ] `conversations/conversations.module.ts`, `.controller.ts`, `.service.ts`
- [ ] `conversations/sse-stream.ts`
- [ ] `approval/approval.controller.ts` (list, grant, deny endpoints)
- [ ] BullMQ job processors: embed-memory, analyze-turn, weekly-decay
- [ ] End-to-end test: send message → agent uses tools → creates campaign → SSE stream

---

## Phase 3 — Frontend Dashboard
**Duration**: 2 days

### 3.1 Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `LoginPage` | Email + password form |
| `/register` | `RegisterPage` | Company name + user info |
| `/` | `DashboardPage` | Goal summaries, active campaigns, recent activity |
| `/chat` | `ChatPage` | New conversation |
| `/chat/[id]` | `ChatPage` | Existing conversation |
| `/goals` | `GoalsPage` | Goal list, progress |
| `/campaigns` | `CampaignsPage` | Campaign list + status |
| `/campaigns/[id]` | `CampaignDetailPage` | Tasks, brief, progress |
| `/approvals` | `ApprovalsPage` | Pending approval inbox |

### 3.2 Chat Interface

- **Message list** — renders USER, ASSISTANT, TOOL_CALL, TOOL_RESULT messages
- **Tool call display** — collapsible card: tool name, input summary, result
- **Approval prompt** — inline card when agent hits APPROVAL_REQUIRED gate
- **SSE integration** — connects to `/conversations/:id/stream`, renders tokens as they arrive
- **Input** — textarea + send button; disabled while agent is responding

### 3.3 State Management

- **TanStack Query** — server state (conversations, campaigns, goals)
- **Zustand** — UI state (active conversation, pending approvals count)
- **Axios** — HTTP client with JWT interceptor (auto-refresh on 401)

### 3.4 Auth Flow

- Login → store JWT in memory (not localStorage); refresh token in httpOnly cookie
- Axios interceptor: on 401, call `/auth/refresh`, retry original request once
- On logout: call `/auth/logout`, clear in-memory JWT, redirect to `/login`

**Deliverables — Phase 3**:
- [ ] `app/(auth)/login/page.tsx` + form
- [ ] `app/(auth)/register/page.tsx` + form
- [ ] `app/(dashboard)/layout.tsx` — sidebar navigation
- [ ] `app/(dashboard)/page.tsx` — dashboard overview
- [ ] `app/(dashboard)/chat/[id]/page.tsx` — agent chat
- [ ] `components/chat/message-list.tsx`
- [ ] `components/chat/message-input.tsx`
- [ ] `components/chat/tool-call-display.tsx`
- [ ] `components/chat/approval-prompt.tsx`
- [ ] `app/(dashboard)/goals/page.tsx`
- [ ] `app/(dashboard)/campaigns/page.tsx`
- [ ] `app/(dashboard)/campaigns/[id]/page.tsx`
- [ ] `app/(dashboard)/approvals/page.tsx`
- [ ] `lib/api.ts` — Axios instance + JWT interceptor
- [ ] `hooks/useSSE.ts` — SSE connection hook
- [ ] `store/auth.store.ts` — Zustand auth state

---

## Phase 4 — Integration, Polish, Seed
**Duration**: 2 days

### 4.1 Seed Data

Real seed that creates a usable demo:
```
Demo Company (B2B SaaS)
├── Owner user: demo@example.com / Demo123!@#
├── Company Knowledge:
│   ├── ICP: VP of Operations, 50-200 person B2B SaaS
│   └── Budget: $5,000/month
├── Marketing Goal: Increase Brand Awareness Q1 2026
└── Campaign: LinkedIn Thought Leadership (DRAFT)
    └── Task: Write 4 articles on industry trends (human, HIGH priority)
```

### 4.2 End-to-End Validation Checklist

Manual test script — must pass before milestone is declared complete:

1. [ ] Register company + user
2. [ ] Login → JWT in memory, refresh token in httpOnly cookie
3. [ ] Start conversation with Director Agent
4. [ ] Ask agent to create a goal → verify DB row + audit log
5. [ ] Ask agent to create a campaign under the goal → verify DB row + audit log
6. [ ] Ask agent to create 3 tasks → verify DB rows
7. [ ] Verify `agent_executions` row exists (token count, cost, latency)
8. [ ] Verify `tool_call_logs` rows (one per tool call)
9. [ ] Verify `agent_memory` rows after analysis job runs
10. [ ] Verify SSE stream delivers tokens in real-time
11. [ ] Trigger an approval flow (manually set a tool to APPROVAL_REQUIRED in dev config)
12. [ ] Verify ApprovalRequest created, SSE notifies frontend
13. [ ] Grant approval → verify tool executed, agent continued
14. [ ] Verify cross-tenant access returns 403

### 4.3 Error Scenario Validation

- [ ] Wrong credentials → 401, not 500
- [ ] Cross-tenant access attempt → 403 (companyId mismatch)
- [ ] AI provider timeout → partial response + BullMQ retry queued
- [ ] Embedding API down → memory saved without embedding, retrieval degrades gracefully
- [ ] Database write failure → transaction rollback, error returned to agent

**Deliverables — Phase 4**:
- [ ] `prisma/seed.ts` — company, user, knowledge, goal, campaign, tasks
- [ ] `docker-compose.yml` — verified working locally
- [ ] `backend/README.md` — setup: Docker → migrate → seed → run
- [ ] `frontend/README.md` — setup instructions
- [ ] End-to-end manual test checklist: all 14 items verified
- [ ] Error scenario test results documented

---

## Package Summary

### Backend

```json
{
  "dependencies": {
    "@nestjs/common": "^11",
    "@nestjs/core": "^11",
    "@nestjs/config": "^3",
    "@nestjs/jwt": "^10",
    "@nestjs/passport": "^10",
    "@nestjs/platform-express": "^11",
    "@prisma/client": "^6",
    "@anthropic-ai/sdk": "^0.36",
    "bullmq": "^5",
    "ioredis": "^5",
    "bcrypt": "^5",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "passport-jwt": "^4",
    "uuid": "^10"
  },
  "devDependencies": {
    "prisma": "^6",
    "@types/bcrypt": "^5",
    "@types/express": "^5",
    "typescript": "^5",
    "ts-jest": "^29",
    "@nestjs/testing": "^11"
  }
}
```

Voyage AI: use `axios` to call their REST API directly (no SDK dependency needed).

### Frontend

```json
{
  "dependencies": {
    "next": "15",
    "react": "19",
    "react-dom": "19",
    "@tanstack/react-query": "^5",
    "axios": "^1",
    "zustand": "^5",
    "tailwindcss": "^3",
    "clsx": "^2",
    "lucide-react": "latest"
  }
}
```

---

## Timeline Summary

| Phase | Focus | Days | Cumulative |
|-------|-------|------|-----------|
| Pre-impl | Security credential rotation | Day 0 | Day 0 |
| 0 | Repo cleanup, scaffolding, Docker | Day 1 | Day 1 |
| 0.5 | Agent Engine (providers, memory, approval, observability) | Days 2–3 | Day 3 |
| 1 | Auth, Company, core API infrastructure | Days 4–5 | Day 5 |
| 2 | Director Agent, conversations, tools, BullMQ jobs | Days 6–8 | Day 8 |
| 3 | Frontend dashboard, chat UI, approvals inbox | Days 9–10 | Day 10 |
| 4 | Integration, seed, validation, documentation | Days 11–12 | Day 12 |

**Total**: 12 working days to a functional, production-ready first vertical slice.

---

## Definition of Done (First Slice)

The first slice is complete when all of the following are true:

- [ ] A new user can register a company and log in
- [ ] JWT auth works with refresh token rotation
- [ ] The Marketing Director Agent holds a real multi-turn conversation with memory
- [ ] The agent creates real goals, campaigns, and tasks in the database
- [ ] Every agent turn writes to `agent_executions` and `tool_call_logs`
- [ ] Token usage and cost are tracked per conversation
- [ ] SSE streaming delivers agent output token-by-token to the browser
- [ ] Approval Engine is wired in (even if no tools currently require it)
- [ ] All 5 memory tiers are injected into each agent turn
- [ ] The frontend shows chat, goals list, campaign list, and approvals inbox
- [ ] All data is isolated by `companyId` — no cross-tenant access possible
- [ ] No credentials committed to git
- [ ] `docker compose up && pnpm prisma migrate dev && pnpm prisma db seed` produces a working local environment
