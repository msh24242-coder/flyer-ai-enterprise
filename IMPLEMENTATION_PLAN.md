# AI Marketing OS — Implementation Plan

**Version**: 1.0  
**Status**: Design (awaiting approval)  
**Milestone**: First vertical slice — Marketing Director Agent end-to-end

---

## Overview

This plan covers everything required to deliver a real, working first slice:

- User registers and logs in
- Company is created and configured
- User opens a chat with the Marketing Director Agent
- Agent has a persistent conversation, asks questions, and creates real goals/campaigns/tasks in the database
- User sees the created goals and campaigns on a minimal dashboard
- All data is stored in PostgreSQL; memory uses pgvector

**Definition of Done**:  
A user can sign up, talk to the Marketing Director Agent, and see real campaigns and tasks created in the database — with conversation history persisted across page reloads.

---

## Prerequisites

Before writing any application code:

- [ ] Rotate compromised Supabase credentials (change DB password on Supabase dashboard, or use local PG only)
- [ ] Remove `.env` from git history using `git filter-repo` or BFG
- [ ] Ensure `.env` is in `.gitignore` (already is, but verify it wasn't overridden)
- [ ] Add `ANTHROPIC_API_KEY` to local `.env`
- [ ] Confirm Docker is running and port 5432 + 6379 are free

---

## Phase 0 — Repository Setup (Day 1, ~2 hours)

### Tasks

**0.1 Clean old files**
Remove files that are junk or will cause confusion:
```
COMPLETION_SUMMARY.md        ← delete
START_HERE.md                ← delete
test-backend.sh              ← delete
Makefile                     ← delete (will rewrite)
docker-compose.override.yml  ← delete
structure.txt                ← delete (3MB Windows listing)
package-lock.json (root)     ← delete
```

**0.2 Update `.gitignore`**
Ensure `.env` and `*.env.local` are listed. Add `node_modules/`, `.next/`, `dist/`.

**0.3 Simplify `docker-compose.yml`**
Remove the `backend` service (broken build context). Remove `rabbitmq`, `elasticsearch`, `pgadmin`.
Keep: `postgres`, `redis`.

Add pgvector initialization:
```yaml
postgres:
  image: pgvector/pgvector:pg16    # official pgvector + postgres 16 image
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: ai_marketing_os
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 3s
    retries: 10
```

**0.4 Create `backend/` directory**
Init NestJS project:
```bash
cd backend
npm init -y
# Install core packages (see package list in Phase 1)
```

**0.5 Create `frontend/` directory**
Init Next.js project:
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir
```
Then move existing `tailwind.config.ts` and `next.config.js` into `frontend/`.

**0.6 Create root workspace `package.json`**
```json
{
  "name": "ai-marketing-os",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev:api": "npm run dev --workspace=backend",
    "dev:web": "npm run dev --workspace=frontend",
    "db:migrate": "npm run prisma:migrate --workspace=backend",
    "db:seed": "npm run prisma:seed --workspace=backend",
    "db:studio": "npm run prisma:studio --workspace=backend"
  }
}
```

**0.7 Update `.env.example`**
```
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_marketing_os

REDIS_URL=redis://localhost:6379

JWT_SECRET=
JWT_EXPIRATION=15m
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRATION=7d

ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-5-20251001

VOYAGE_API_KEY=
EMBEDDING_MODEL=voyage-3-lite
EMBEDDING_DIMENSIONS=1024

FRONTEND_URL=http://localhost:3000
```

---

## Phase 1 — Backend Foundation (Days 2–4, ~3 days)

### 1.1 NestJS Project Setup

**`backend/package.json` dependencies**:
```json
{
  "dependencies": {
    "@nestjs/common": "^11",
    "@nestjs/core": "^11",
    "@nestjs/platform-express": "^11",
    "@nestjs/config": "^3",
    "@nestjs/passport": "^10",
    "@nestjs/jwt": "^10",
    "@nestjs/throttler": "^6",
    "@nestjs/bull": "^10",
    "@anthropic-ai/sdk": "^0.30",
    "@prisma/client": "^6",
    "passport": "^0.7",
    "passport-jwt": "^4",
    "passport-local": "^1",
    "bcrypt": "^5",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "bull": "^4",
    "ioredis": "^5",
    "reflect-metadata": "^0.2",
    "rxjs": "^7"
  },
  "devDependencies": {
    "@nestjs/cli": "^11",
    "@nestjs/testing": "^11",
    "@types/bcrypt": "^5",
    "@types/passport-jwt": "^4",
    "@types/passport-local": "^1",
    "prisma": "^6",
    "typescript": "^5.5",
    "ts-node": "^10",
    "@types/node": "^20",
    "jest": "^29",
    "@types/jest": "^29",
    "ts-jest": "^29",
    "supertest": "^7",
    "@types/supertest": "^6"
  }
}
```

**`backend/tsconfig.json`**: Strict TypeScript with NestJS decorators enabled (same settings as existing root tsconfig.json — copy with `rootDir: src`).

### 1.2 Database Setup

- Write `backend/prisma/schema.prisma` (exact schema from DATABASE_DESIGN.md)
- Run: `npx prisma migrate dev --name init`
- Verify pgvector extension is active: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Create HNSW index (raw SQL migration after schema migration)
- Write `backend/prisma/seed.ts` with demo company + user

### 1.3 Core NestJS Modules

**Order of implementation** (each depends on the previous):

1. **`database/`** — PrismaService (extends PrismaClient, adds onModuleInit + enableShutdownHooks)
2. **`common/`** — AllExceptionsFilter, TransformInterceptor, ValidationPipe setup, CurrentUser decorator
3. **`auth/`** — Register + Login + Refresh endpoints, JWT strategy, bcrypt
4. **`companies/`** — GET + PATCH /companies/:id (update settings, name, etc.)
5. **`users/`** — GET /users/me, PATCH /users/me (profile update)
6. **`goals/`** — Full CRUD for MarketingGoal
7. **`campaigns/`** — Full CRUD for Campaign
8. **`tasks/`** — Full CRUD for Task
9. **`memory/`** — MemoryService (write with embedding, read with similarity search)
10. **`agents/`** — BaseAgentService, DirectorAgentService, tools execution
11. **`conversations/`** — Conversation CRUD + message handling + SSE streaming

### 1.4 Auth Module Detail

**Register flow**:
```
POST /api/v1/auth/register
Body: { email, password, firstName, lastName, companyName }

1. Validate DTO (email format, password strength: min 8 chars, 1 upper, 1 number, 1 special)
2. Check email not already registered
3. Create Company (slug = slugify(companyName))
4. Create User (role: OWNER, passwordHash = bcrypt(password, 12))
5. Generate access token + refresh token
6. Store refresh token hash in DB
7. Return { accessToken, refreshToken, user: { id, email, firstName, lastName, role }, company }
```

**Password validation rule**: minimum 8 characters, at least one uppercase, one number, one special character. Applied in DTO using `@Matches()`.

**JWT payload**: `{ sub: userId, companyId, role, iat, exp }`

### 1.5 Conversations + Agent Module Detail

```
POST /api/v1/conversations
→ Create a new conversation record, return { id, title: null, createdAt }

POST /api/v1/conversations/:id/messages
Body: { content: string }
→ 1. Save user message to DB
→ 2. Invoke DirectorAgentService.run(conversationId, content, companyContext)
→ 3. Agent loop (see AGENT_DESIGN.md §5)
→ 4. Save assistant message(s) + tool call records to DB
→ 5. Queue memory storage job (BullMQ)
→ 6. Return { message: assistantText, toolCallsExecuted, tokensUsed }

GET /api/v1/conversations/:id/messages
→ Return paginated message list

GET /api/v1/conversations
→ Return list of conversations for current user

SSE: GET /api/v1/conversations/:id/stream
→ Streams token-by-token as agent generates response
→ Emits: { type: 'token', content: '...' }
→ Emits: { type: 'tool_start', tool: 'create_campaign', input: {...} }
→ Emits: { type: 'tool_end', tool: 'create_campaign', result: {...} }
→ Emits: { type: 'done', tokensUsed: {...} }
```

### 1.6 API Response Format

All success responses:
```json
{
  "data": { ... },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 45 } }
}
```

All error responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  },
  "timestamp": "2026-08-24T10:00:00Z",
  "path": "/api/v1/auth/register"
}
```

---

## Phase 2 — Frontend (Days 5–8, ~4 days)

### 2.1 Project Setup

Next.js 15, App Router, TypeScript, Tailwind, shadcn/ui.

Install shadcn/ui components needed:
```bash
npx shadcn@latest init
npx shadcn@latest add button input label card badge separator avatar dropdown-menu sheet tabs scroll-area textarea toast
```

Install additional frontend packages:
```
zustand          ← state management
@tanstack/react-query  ← server state / data fetching
axios            ← HTTP client
date-fns         ← date formatting
lucide-react     ← icons (included with shadcn)
```

### 2.2 Pages to Build

**Auth pages** (`/login`, `/register`):
- Email + password form
- Error display
- Redirect to `/` on success
- Store access token in `localStorage` (with clear security note: httpOnly cookies preferred for production hardening)

**Dashboard layout** (`/layout.tsx`):
- Left sidebar: logo, nav links (Overview, Chat, Goals, Campaigns)
- Top bar: company name, user menu (profile, logout)
- Content area

**Overview page** (`/`):
- Summary cards: Active Goals, Active Campaigns, Pending Tasks
- Recent conversations list (click to open)
- "Start a conversation" CTA if no conversations yet

**Chat page** (`/chat` and `/chat/[id]`):
- Message list with user/assistant distinction
- Tool call display (collapsible — shows what tool was called and what it created)
- Text input with send button
- Auto-scroll to latest message
- SSE stream integration (shows typing indicator while agent responds)
- Sidebar listing all past conversations

**Goals page** (`/goals`):
- List of marketing goals with status badge
- Click to see campaigns linked to each goal

**Campaigns page** (`/campaigns`):
- List of campaigns with status, channel badges, date range
- Click campaign to see task list
- Task list with status, priority, assignee type

### 2.3 API Client

```typescript
// frontend/lib/api-client.ts
const client = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token expiry: refresh and retry once
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return client(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 2.4 Chat SSE Integration

```typescript
// frontend/hooks/use-conversation-stream.ts
function useConversationStream(conversationId: string) {
  const [streaming, setStreaming] = useState(false);
  const [partialMessage, setPartialMessage] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const sendMessage = async (content: string) => {
    setStreaming(true);
    setPartialMessage('');
    setToolCalls([]);

    const token = localStorage.getItem('access_token');
    const url = `${API_URL}/conversations/${conversationId}/stream`;
    
    // POST with content, then connect to SSE
    await client.post(`/conversations/${conversationId}/messages`, { content });
    
    const eventSource = new EventSource(`${url}?token=${token}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') setPartialMessage(p => p + data.content);
      if (data.type === 'tool_start') setToolCalls(t => [...t, data]);
      if (data.type === 'done') {
        setStreaming(false);
        eventSource.close();
        onComplete(); // refresh message list
      }
    };
  };

  return { sendMessage, streaming, partialMessage, toolCalls };
}
```

---

## Phase 3 — Integration & Testing (Days 9–11, ~3 days)

### 3.1 End-to-End Test Scenarios

These must all work before the milestone is considered done:

**Scenario A — New User Flow**:
1. Register with email/password/company name → receives JWT
2. Redirected to dashboard — sees empty state
3. Opens Chat → starts conversation
4. Sends: "We need to launch a new product in Q1. It's a B2B SaaS tool for logistics teams."
5. Agent asks 1-2 clarifying questions
6. User answers
7. Agent creates: 1 MarketingGoal + 1 Campaign + 3-5 Tasks in DB
8. Dashboard updates: shows the new goal and campaign
9. Refresh page → conversation history preserved, goal still visible

**Scenario B — Returning User**:
1. Login with existing credentials
2. Past conversations appear in sidebar
3. Click a past conversation → full history loads
4. Send a new message that references past context
5. Agent recalls previous context from conversation history
6. Agent uses `search_memory` → retrieves relevant past memories

**Scenario C — Token Refresh**:
1. Access token expires (15 min or simulate with short TTL)
2. Next API request automatically refreshes the token
3. User does not see an error or a redirect

### 3.2 API Tests to Write

```
auth.e2e-spec.ts:
  POST /auth/register → 201 with tokens
  POST /auth/register (duplicate email) → 409
  POST /auth/login (wrong password) → 401
  POST /auth/login (valid) → 200 with tokens
  GET /auth/me (no token) → 401
  GET /auth/me (valid token) → 200 with user data
  POST /auth/refresh (valid) → 200 with new tokens
  POST /auth/refresh (revoked) → 401

conversations.e2e-spec.ts:
  POST /conversations → 201 with conversation
  POST /conversations/:id/messages → 200 with agent response
  GET /conversations/:id/messages → 200 with message list
  Agent creates campaign → campaign exists in DB after tool call
```

### 3.3 Manual QA Checklist

- [ ] Register flow works end-to-end
- [ ] Login flow works end-to-end
- [ ] Logout clears tokens and redirects to login
- [ ] Invalid credentials show correct error messages
- [ ] Chat sends message, agent responds within 15 seconds
- [ ] Tool calls are visibly logged in chat UI
- [ ] Created campaigns appear on Campaigns page without page reload
- [ ] Conversation history loads on page refresh
- [ ] Memory is stored after conversation (verify in DB)
- [ ] Rate limiter triggers after 10 rapid auth requests
- [ ] Wrong company data cannot be accessed (test with two accounts)

---

## Phase 4 — Hardening & Deploy Prep (Day 12, ~1 day)

### 4.1 Security Hardening

- [ ] Verify no `passwordHash` ever appears in API responses (add global response interceptor that strips it)
- [ ] Verify refresh tokens are stored hashed, raw value never logged
- [ ] Add helmet middleware (NestJS: `app.use(helmet())`)
- [ ] Verify CORS allows only `FRONTEND_URL`
- [ ] Add rate limiting: 100 req/15min global, 10/min on `/auth/*`
- [ ] Verify all endpoints require auth except `/auth/login`, `/auth/register`, `/health`
- [ ] Test that companyId scoping prevents cross-tenant reads

### 4.2 Observability

- [ ] Request logging: method, path, status, duration (logging interceptor)
- [ ] Error logging: stack trace in non-production environments only
- [ ] Agent turn logging: `{ conversationId, inputTokens, outputTokens, toolCalls, durationMs }`
- [ ] Health check endpoint: `GET /health` → `{ status: "ok", db: "connected", redis: "connected" }`

### 4.3 Docker Compose Final State

After cleanup, `docker-compose.yml` should start the full dev environment:
```
postgres (pgvector/pgvector:pg16) → port 5432
redis (redis:7-alpine) → port 6379
```

Backend and frontend run locally (not in Docker) for fast hot reload. Add `docker-compose.prod.yml` for production builds later.

---

## File Delivery Checklist

By the end of this milestone, these files must exist and be functional:

**Backend**:
- [ ] `backend/prisma/schema.prisma`
- [ ] `backend/prisma/migrations/` (at least init migration)
- [ ] `backend/prisma/seed.ts`
- [ ] `backend/src/main.ts`
- [ ] `backend/src/app.module.ts`
- [ ] `backend/src/auth/` (complete)
- [ ] `backend/src/companies/` (complete)
- [ ] `backend/src/users/` (complete)
- [ ] `backend/src/goals/` (complete)
- [ ] `backend/src/campaigns/` (complete)
- [ ] `backend/src/tasks/` (complete)
- [ ] `backend/src/conversations/` (complete)
- [ ] `backend/src/agents/director/` (complete)
- [ ] `backend/src/agents/memory/` (complete)
- [ ] `backend/src/database/` (complete)
- [ ] `backend/src/common/` (filters, interceptors, decorators)
- [ ] `backend/test/auth.e2e-spec.ts`
- [ ] `backend/test/conversations.e2e-spec.ts`
- [ ] `backend/.env.example`
- [ ] `backend/package.json`
- [ ] `backend/tsconfig.json`

**Frontend**:
- [ ] `frontend/src/app/(auth)/login/page.tsx`
- [ ] `frontend/src/app/(auth)/register/page.tsx`
- [ ] `frontend/src/app/(dashboard)/layout.tsx`
- [ ] `frontend/src/app/(dashboard)/page.tsx`
- [ ] `frontend/src/app/(dashboard)/chat/page.tsx`
- [ ] `frontend/src/app/(dashboard)/chat/[id]/page.tsx`
- [ ] `frontend/src/app/(dashboard)/goals/page.tsx`
- [ ] `frontend/src/app/(dashboard)/campaigns/page.tsx`
- [ ] `frontend/src/app/(dashboard)/campaigns/[id]/page.tsx`
- [ ] `frontend/src/components/chat/` (message-list, input, tool-call-display)
- [ ] `frontend/src/components/layout/` (sidebar, topbar)
- [ ] `frontend/src/lib/api-client.ts`
- [ ] `frontend/src/hooks/use-auth.ts`
- [ ] `frontend/src/hooks/use-conversation-stream.ts`
- [ ] `frontend/src/store/auth.store.ts`
- [ ] `frontend/package.json`
- [ ] `frontend/next.config.js`
- [ ] `frontend/tailwind.config.ts`

**Root**:
- [ ] `docker-compose.yml` (cleaned)
- [ ] `package.json` (workspace root)
- [ ] `.env.example` (updated)
- [ ] `ARCHITECTURE.md` ✅
- [ ] `DATABASE_DESIGN.md` ✅
- [ ] `AGENT_DESIGN.md` ✅
- [ ] `IMPLEMENTATION_PLAN.md` ✅

---

## Estimated Timeline

| Phase | Duration | Output |
|-------|----------|--------|
| 0 — Repo Setup | Day 1 (2h) | Clean repo, Docker, project init |
| 1 — Backend | Days 2–4 (3 days) | All API endpoints working |
| 2 — Frontend | Days 5–8 (4 days) | Full UI, chat working end-to-end |
| 3 — Integration | Days 9–11 (3 days) | E2E tests passing, QA complete |
| 4 — Hardening | Day 12 (1 day) | Security + observability baseline |
| **Total** | **~12 working days** | **First vertical slice done** |

This assumes one developer working full time. Parallel frontend/backend development with two developers could compress to 7–8 days.
