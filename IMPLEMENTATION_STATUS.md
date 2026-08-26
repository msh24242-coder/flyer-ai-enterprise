# Implementation Status — SH Marketing

**Last updated:** 2026-08-26  
**Current state:** All phases complete — 447 tests passing. See [Production Audit — 2026-08-26](#production-audit--2026-08-26) for bugs found and fixed since the previous update.

---

## Build & Test Status

| Check | Status |
|-------|--------|
| Backend tests | ✅ 447/447 passing (36 suites) |
| Backend TypeScript | ✅ Clean |
| Backend ESLint | ✅ Clean |
| Backend build | ✅ `nest build` success |
| Frontend TypeScript | ✅ Clean |
| Frontend build | ✅ `next build` success |

---

## Completed Functionality

### Phase 0 — Foundation
- [x] Monorepo scaffold (`apps/backend`, `apps/frontend`, `packages/shared`)
- [x] Docker Compose (PostgreSQL 16 + pgvector, Redis 7)
- [x] `docker-compose.prod.yml` for production
- [x] Prisma schema with all core models and relations
- [x] Migrations applied
- [x] Helmet, CORS, rate limiting, global validation pipe
- [x] JWT access tokens (15m) + refresh tokens (7d, bcrypt-hashed)
- [x] Health endpoint (`/api/v1/health`)
- [x] Swagger/OpenAPI at `/api/v1/docs`
- [x] `.env.example` committed (no secrets)
- [x] GitHub Actions CI (`ci.yml`)

### Phase 0.5 — Agent Engine
- [x] `AgentEngine` abstract base class with agentic loop (MAX_AGENT_ITERATIONS=10)
- [x] `AnthropicProvider` — complete() + stream()
- [x] `VoyageProvider` embedding adapter
- [x] `MemoryService` — pgvector semantic search + company knowledge + BullMQ write queue
- [x] `ApprovalEngineService` — READ/WRITE/APPROVAL_REQUIRED/ADMIN_ONLY policy
- [x] `ObservabilityTracerService` — AgentExecution + ToolCallLog persistence
- [x] `AgentOrchestratorService` — BullMQ dispatch with retry
- [x] `AgentTaskProcessor` — queue processor for all 7 agent types
- [x] BullMQ queues: `memory-writes`, `agent-tasks`

### Phase 1 — Auth + Company
- [x] Registration, login, refresh token, logout, `/auth/me`
- [x] Refresh token rotation with reuse detection (revoke-all on reuse)
- [x] `CompanyModule`: profile, member management, knowledge CRUD
- [x] AI config management (GET/PUT `ai/config`)
- [x] AI usage aggregation (GET `ai/usage` with date range)
- [x] Audit log endpoint (GET `audit`)
- [x] `RolesGuard` + `@Roles()` decorator
- [x] Tenant isolation in all company service methods
- [x] Tests: AuthService, AuthRepository, CompanyService, CompanyRepository, CompanyController, tenant isolation

### Phase 2 — Marketing Director
- [x] `MarketingDirectorAgent` (REQUEST-scoped, 10 tools, tenant-safe)
- [x] `MarketingAgentService` — full conversation lifecycle, cost tracking, budget enforcement
- [x] `MarketingAgentController` — POST /run, SSE /run/stream, GET /conversations, rename/archive/delete
- [x] `ConversationRepository` — full CRUD
- [x] `MarketingRepository` — goals, campaigns, tasks CRUD with tenant isolation
- [x] `MarketingController` — goals/campaigns/tasks REST endpoints with status filtering
- [x] Tests: MarketingDirectorAgent, MarketingAgentService, MarketingController, ConversationRepository, MarketingRepository, tenant isolation

### Phase 3 — Sub-Agents & Orchestration
- [x] `StrategyAgent` (6 tools: list_goals, list_campaigns, search_memory, store_strategy, create_campaign, update_goal_status)
- [x] `ResearchAgent` (5 tools: web search context, search_memory, store_research, analyze_trends, competitor_insights)
- [x] `ContentAgent` (8 tools: get_campaign, create_content, list_content, search_memory, store_insight, update_content, get_brand_voice, create_social_post)
- [x] `SocialMediaAgent` (6 tools: create_social_post, schedule_post, get_campaign_content, analyze_engagement, get_brand_guidelines, list_scheduled_posts)
- [x] `PerformanceAgent` (6 tools: get_campaign_metrics, calculate_roi, list_campaigns, store_insight, create_alert, get_analytics_summary)
- [x] `AnalyticsAgent` (7 tools: aggregate_metrics, trend_analysis, cohort_analysis, store_insight, create_report, get_funnel_data, compare_periods)
- [x] `CreativeAgent` (6 tools: generate_copy, generate_headlines, analyze_brand_voice, get_campaign_brief, store_content, list_creative_assets)
- [x] `AgentDispatchProcessor` — handles all 7 agent types from BullMQ queue
- [x] `AgentWorkflowService` — full_campaign, content_sprint, research_then_strategy
- [x] `AgentWorkflowController` — POST /workflows, GET /workflows/tasks/:taskId
- [x] Cross-agent contract test suite (42 tests verifying identity/prompt/tools)
- [x] Individual agent spec suites (strategy, research, content, social, performance, analytics, creative)
- [x] AgentDispatchProcessor test suite
- [x] AgentWorkflowService test suite

### Phase 4 — Frontend Shell
- [x] Authentication UI (login, register)
- [x] Auth context with JWT + refresh token management
- [x] Typed API client (`api.*` covering all endpoints)
- [x] Sidebar navigation with all routes
- [x] Top header component
- [x] Design system components (Button, Input, Modal, Card, Badge, Table, Toast, Skeleton, etc.)

### Phase 5 — Core Feature Pages
- [x] `/dashboard` — live stats (goals, campaigns, tasks)
- [x] `/campaigns` — full CRUD with status filter
- [x] `/goals` — full CRUD with status selector
- [x] `/tasks` — full CRUD with priority/status
- [x] `/knowledge` — grouped by category, upsert/delete

### Phase 6 — Additional Content
- [x] `/content` — list with filter by contentType, expand/collapse, clipboard copy
- [x] All agent content persisted via `GeneratedContent` model
- [x] `ContentRepository` + `ContentController`

### Phase 7 — Analytics & Approvals
- [x] `/approvals` — approve/deny with filter by status
- [x] `ApprovalsService` + `ApprovalsController`
- [x] `/usage` — AI usage page with token/cost breakdown by agent
- [x] `/chat` — AI Director chat with conversation history sidebar

### Phase 8 — Settings & Configuration
- [x] `/settings` — AI config form (defaultModel, monthlyBudgetUsd, maxExecutionCostUsd, approvalRequired)
- [x] `/company` — company profile + member management (role updates, deactivation)
- [x] Budget enforcement in `MarketingAgentService.run()` (30-day rolling spend check)

### Phase 9 — Workflows & Polish
- [x] `/workflows` — multi-agent workflow trigger UI (full_campaign, content_sprint, research_then_strategy)
- [x] `api.workflows.trigger()` + `api.workflows.getTaskStatus()` in frontend API client
- [x] `TriggerWorkflowDto` with class-validator decorators (workflowType, message, conversationId, model)
- [x] `ResolveApprovalDto` with class-validator decorators (reviewNote, max 1000 chars)
- [x] Sidebar navigation includes Workflows link

### Infrastructure
- [x] `.env.example` (no real secrets committed)
- [x] GitHub Actions CI (`ci.yml`) — lint + typecheck + test + build for backend and frontend
- [x] Swagger/OpenAPI at `/api/v1/docs`
- [x] Production `Dockerfile` for backend and frontend
- [x] `docker-compose.prod.yml`
- [x] `Makefile` with common dev commands
- [x] `AuditService` — fire-and-forget with DB-down resilience

---

## Technical Debt / Known Limitations

1. **No E2E / integration tests** — unit tests only; real DB/Redis integration tests would need a test container setup with Testcontainers or a dedicated test database

---

## Test Coverage Summary (36 suites, 435 tests)

| Module | Test File | Tests |
|--------|-----------|-------|
| Auth | auth.service.spec | 11 |
| Auth | auth.repository.spec | 14 |
| Auth | auth.controller.spec | 6 |
| Company | company.service.spec | 17 |
| Company | company.repository.spec | 11 |
| Company | company.controller.spec | 15 |
| Company | tenant-isolation.spec | 6 |
| Marketing Director | marketing-director.agent.spec | 6 |
| Marketing Director | marketing-agent.service.spec | 24 |
| Marketing Director | marketing-agent.controller.spec | 6 |
| Marketing Director | marketing.controller.spec | 24 |
| Marketing Director | marketing.repository.spec | 23 |
| Marketing Director | marketing-tenant-isolation.spec | 6 |
| Marketing Director | conversation.repository.spec | 13 |
| Agents | agent-contracts.spec | 42 |
| Agents | agent-dispatch.processor.spec | 12 |
| Agents | agent-workflow.controller.spec | 7 |
| Agents | strategy.agent.spec | 5 |
| Agents | research.agent.spec | 5 |
| Agents | content.agent.spec | 11 |
| Agents | social-media.agent.spec | 5 |
| Agents | performance.agent.spec | 5 |
| Agents | analytics.agent.spec | 5 |
| Agents | creative.agent.spec | 5 |
| Agents/Workflow | agent-workflow.service.spec | 9 |
| Agent Engine | agent-orchestrator.service.spec | 8 |
| Agent Engine | memory.service.spec | 11 |
| Agent Engine | approval-engine.service.spec | 12 |
| Agent Engine | observability-tracer.service.spec | 10 |
| Agent Engine | ai-provider.factory.spec | 4 |
| Approvals | approvals.service.spec | 12 |
| Approvals | approvals.controller.spec | 6 |
| Approvals | approvals.repository.spec | 8 |
| Audit | audit.service.spec | 6 |
| Content | content.repository.spec | 8 |
| Content | content.controller.spec | 7 |

---

## Production Audit — 2026-08-26

A full production audit of the live VPS deployment found and fixed several bugs that the checklists above didn't catch (unit tests mocked past them). Fixed and deployed to `sh-marketing-backend`:

- **Critical — login/register were completely broken in production.** `AuthService` requires `REFRESH_TOKEN_SECRET` (`getOrThrow`), but `docker-compose.prod.yml` only ever supplied `JWT_REFRESH_SECRET` — a name the code never reads. Every register/login call threw a 500. Fixed the compose env mapping; confirmed live via register→login round-trip.
- **Critical — 4 cross-tenant authorization holes.** `ContentController`, `ApprovalsController`, and `AgentWorkflowController` (`triggerWorkflow` and `getTaskStatus`) never verified the authenticated user belongs to the `:companyId` in the URL — any authenticated user of any company could read/write another company's content, approve/deny another company's approvals, trigger workflows (real LLM spend) as another company, and poll another company's task status by ID. Added the same `assertMembership` pattern already used in `MarketingController`. Verified live with two throwaway companies: cross-tenant requests now return 403, same-tenant requests still return 200.
- **pgvector memory system was non-functional.** `MemoryService.searchSemanticMemory` and `MemoryWriteProcessor` used snake_case raw-SQL column names (`company_id`, `memory_type`, `created_at`) and referenced `conversation_id`/`agent_execution_id` columns that don't exist on `agent_memory`. The actual table uses quoted camelCase columns and has no conversation/execution columns. Every read and write would throw `column does not exist`. Fixed and validated against the live schema via `EXPLAIN` (both statements now plan cleanly).
- **Production secrets were dev placeholders.** `.env` had `JWT_SECRET`/`JWT_REFRESH_SECRET` (now `REFRESH_TOKEN_SECRET`) literally set to `dev-jwt-secret-change-before-production` / `dev-refresh-secret-change-before-production`, plus several duplicate keys from a copy-paste (`NEXT_PUBLIC_API_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`). Rotated both JWT secrets to random 128-char values and deduplicated the file.
- **Content DTO had no runtime validation.** `CreateGeneratedContentDto` was a plain TypeScript `interface` (no metadata for Nest's `ValidationPipe`) despite being used as `@Body()`. Converted to a `class` with `class-validator` decorators.
- Frontend: added a missing `eslint.config.mjs` (`next lint` had no config at all and would hang on an interactive prompt in CI/non-interactive contexts), fixed 2 real lint errors (empty-interface types), removed a dead import, and fixed the `next.config.ts` `typedRoutes` deprecation warning.

**Gaps found in this pass — fixed in [Frontend Production Integration — 2026-08-26](#frontend-production-integration--2026-08-26) below:** SSE consumption, 401/refresh handling, rename/archive UI, workflow budget enforcement.

**Still open** — `sh-marketing-frontend`'s container is stuck in `Created` (never started) because host port 3000 is already bound by `q-syria-platform`'s frontend (`127.0.0.1:3000`, routed via the shared Traefik instance). Not resolved — needs a domain + Traefik hostname-routing decision, out of scope per the standing instruction not to touch shared Traefik config without explicit sign-off.

---

## Frontend Production Integration — 2026-08-26

Second pass the same day: took the frontend from "functionally built" to actually using the backend's real capabilities, plus two backend contract bugs that blocked it.

**Backend fixes required to make real streaming possible at all:**
- `POST .../marketing-director/run/stream` was registered as a **GET** route (NestJS's `@Sse` default) while the handler reads `@Body()` — a browser `fetch()` cannot send a body with `method: 'GET'`, so this endpoint was uncallable as designed by any real client. Fixed via `@Sse('run/stream', { [METHOD_METADATA]: RequestMethod.POST })`.
- No SSE event ever carried the new conversation's ID, so a client starting a fresh chat (no `conversationId` in the request) had no way to learn which conversation was created. Added `conversationId` to the `agent_start` event.
- `AnthropicProvider` accepted an empty API key silently (the SDK doesn't validate at construction) and would only fail once a real request hit Anthropic's servers, surfacing as an opaque error deep inside the tool-use loop. Added a fail-fast guard: `ServiceUnavailableException('AI provider is not configured for this environment.')`.
- Budget enforcement (`monthlyBudgetUsd` circuit breaker) existed only on the non-streaming `run()` path. Extracted into a shared `BudgetGuardService` and added it to `runStream()` (the path the frontend now actually uses), `AgentWorkflowController.triggerWorkflow()`, and `AgentDispatchProcessor.process()` (defense in depth for queued sub-tasks).

**Frontend changes:**
- `lib/api.ts` rewritten: typed `ApiError` (status/code/details), single-flight refresh-and-retry on 401 (concurrent 401s share one refresh call, exempt paths prevent a refresh loop), a `friendlyMessage()` mapper so every page shows consistent non-technical error text, and `api.agent.stream()` — a real SSE client using `fetch()` + `ReadableStream` (not browser `EventSource`, which can't send the required `Authorization` header) that parses the backend's exact event contract.
- `context/auth.tsx` wires the API client's refresh/session-expired callbacks into the stored session. An expired refresh token now clears the session and redirects to `/login?reason=session_expired` with a visible banner, instead of silently failing on the next API call.
- `/chat` rewritten: real token-by-token rendering, collapsible tool-activity cards ("Searching campaigns…" etc., derived from real tool names — no fabricated activity), an inline approval modal when `agent_done.result.pendingApprovalId` is set (there is no separate `approval_required` stream event — the backend only surfaces this on the final event), stop-generation via `AbortController`, conversation rename (inline edit) and archive (delete already existed), local conversation search, and a "Try again" affordance on failed sends that doesn't duplicate messages.
- New `context/theme.tsx` (System/Light/Dark, persisted to `localStorage`, wired into `globals.css` via a `data-theme` attribute) and `context/toast.tsx` (lightweight toast notifications), both mounted in the root layout. Theme switcher lives in Settings → Appearance.
- `/workflows` now polls `getTaskStatus` every 3s until every task reaches a terminal state, instead of only ever showing the initial `QUEUED` snapshot from the trigger response.
- Global (`app/error.tsx`) and app-shell (`app/(app)/error.tsx`) error boundaries — no raw stack traces, a "Try again" reset.
- Added the frontend's first `eslint.config.mjs` (there was none — `next lint` would hang on an interactive prompt outside a TTY) and fixed every warning it surfaced: 2 real errors (empty-interface types), a dead import, and 7 `react-hooks/exhaustive-deps` warnings (shared load functions wrapped in `useCallback` in approvals/campaigns/goals/knowledge; effect dep arrays corrected elsewhere). Frontend lint is now 100% clean.

**What's verified vs. not:** all of the above passed backend unit tests (459/459), frontend typecheck, frontend lint (0 warnings), and frontend production build (18/18 pages). The rebuilt frontend image was smoke-tested via a temporary container on an isolated port — every route returns the expected HTTP status and the page shell renders correctly. **None of this was verified interactively in a real browser** (this session has terminal-only access, no browser) — the actual token-by-token rendering, tool-activity animation, approval modal, and theme switching have not been visually confirmed, and `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY` are still empty in production, so no real end-to-end AI response has been observed either. Please click through `/chat` in a real browser (with a real Anthropic key configured) before treating streaming as done.

**Still not done, by design** — flagged as follow-up rather than rushed: a pre-execution cost *estimate* before a workflow runs (the existing budget check, and the new one added here, are both post-hoc circuit breakers on 30-day spend, consistent with the pre-existing pattern — not a predictive estimator, since this codebase has no cost-estimation model to build on); toast notifications are wired into the app shell but not yet called from every mutation (campaign/goal/task create-delete, approval submit); a full accessibility pass (ARIA audit, screen-reader testing) and responsive-breakpoint testing (375px–1440px) — both need a real browser/screen reader to verify, not just code review.
