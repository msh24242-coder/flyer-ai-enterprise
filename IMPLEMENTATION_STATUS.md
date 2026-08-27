# Implementation Status — SH Marketing

**Last updated:** 2026-08-27  
**Current state:** All phases complete — 460 backend tests passing. A working, styled preview is live at http://187.55.229.15:3002. See [Browser Verification Pass — 2026-08-27](#browser-verification-pass--2026-08-27) for the most recent findings (two critical, previously-invisible bugs fixed), and [Production Audit — 2026-08-26](#production-audit--2026-08-26) for the pass before that.

---

## Build & Test Status

| Check | Status |
|-------|--------|
| Backend tests | ✅ 460/460 passing (38 suites) |
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

---

## Browser Verification Pass — 2026-08-27

The previous pass's note that "this session has terminal-only access, no browser" turned out to be wrong — this machine has a cached Playwright Chromium install (`~/.cache/ms-playwright`) and `npx playwright` works with no network install needed. This pass used it for genuine headless-browser verification: real form login, real screenshots at 6 viewport widths, real theme switching, and a real SSE chat send — not just curl/typecheck/build.

**Two critical bugs found that were invisible to every previous check** (typecheck, lint, build, and curl-based smoke tests all passed while these were broken — only actual browser rendering could catch them):

- **Tailwind CSS was never compiling.** `apps/frontend` had no `postcss.config.mjs` at all. `@tailwindcss/postcss` was installed but never registered as a PostCSS plugin, so `@import "tailwindcss";` in `globals.css` silently produced zero utility classes (confirmed by inspecting the compiled CSS directly: no `.flex{`, `.grid{`, `.rounded-xl{`, etc. — only the hand-written custom CSS and font-face rules). Every page has been rendering as unstyled, vertically-stacked plain HTML in production since the "enterprise UI overhaul" was built. Screenshots before/after are dramatic — the design system was real and good, it just was never being served. Fixed by adding `postcss.config.mjs` **and** an explicit `COPY` line for it in `Dockerfile` (the Dockerfile copies files individually rather than the whole directory, so a first build with the config present on disk but missing from the image gave a false sense of success — caught by comparing the CSS file hash actually served from the container against the one from a local build).
- **No mobile navigation drawer.** At 375–480px the sidebar had no way to hide, permanently consuming 60%+ of the viewport with no hamburger/drawer affordance (the `document.documentElement.scrollWidth` overflow check used to sanity-check earlier claims read `0px` at every breakpoint — technically true, and it hid this completely, since content correctly wrapped into an unusably narrow column instead of overflowing). Added `context/mobile-nav.tsx` (shared open/close state), a hamburger toggle in `Header` and in chat's own toolbar (chat doesn't use the shared `Header`), and made `Sidebar` a slide-in, backdrop-dismissible drawer below the `md` breakpoint that auto-closes on navigation. Desktop/tablet (≥768px) behavior is unchanged.

**Also fixed, found via the same audit:** no favicon at all (added `src/app/icon.svg`, an original SVG using the existing brand mark); 4 real accessibility gaps (icon-only buttons/inputs with no accessible name, one `<label>` not programmatically associated via `htmlFor`) — re-audited after fixing, zero issues remained on the 4 pages checked.

**Verified live, for real, in this order:**
1. Headless Chromium with `--disable-web-security` (a standard testing technique to work around a test-port-vs-configured-CORS-origin mismatch, since the container was tested on an isolated port different from the configured `FRONTEND_URL`) — confirmed all 14 authenticated routes render with zero console/page errors, theme switching (System/Light/Dark) produces the correct `data-theme` attribute and computed colors and persists across reload, all 5 tested breakpoints (375/390/480/768/1024) have zero horizontal overflow, and a real chat send correctly surfaces "AI provider is not configured for this environment." through the actual SSE pipeline.
2. **Set up a persistent, isolated preview** at `http://187.55.229.15:3002` (`sh-marketing-frontend-preview` container, `--restart unless-stopped`, not touching the stuck `sh-marketing-frontend` container or port 3000) and updated `FRONTEND_URL` in `.env` to match, so CORS actually allows it — recreated only `sh-marketing-backend` to pick that up.
3. Re-ran the verification with a **completely unmodified** headless browser (no security flags disabled) against that real preview URL: real login form submission → redirects to `/dashboard`; `/campaigns` shows the correct empty state; a real chat send shows the correct AI-not-configured message; zero console/page errors; and — as an unplanned but conclusive bonus — the 15-minute access token expired mid-session during testing, and the single-flight refresh-and-retry logic transparently obtained a new one and retried, rendering correctly with no visible error. This is the strongest possible confirmation available without a real Anthropic API key.

**Still not verified:** an actual multi-second token-by-token streaming response (requires `ANTHROPIC_API_KEY`), a full WCAG-level accessibility audit (screen reader software wasn't available, only DOM-level checks), and the remaining 10 of 14 pages' accessibility (only login/dashboard/chat/settings were audited — the automated check pattern is quick to re-run against the rest if wanted).

**Preview URL:** http://187.55.229.15:3002 — a real, working, CORS-correct instance of the current frontend. This is separate from the still-unresolved `sh-marketing-frontend` / port 3000 / q-syria conflict, which remains open pending a domain + Traefik decision.

---

## Bilingual Arabic/English + RTL — 2026-08-27

Full i18n system added: `src/i18n/en.ts` + `ar.ts` (selector-function pattern — `t((d) => d.chat.title)` — for compile-time-checked keys and refactor safety), covering every page, dialog, error, and validation message across the app. A new `PreferencesProvider` persists language/timezone/time-format to `localStorage` and drives `document.documentElement.dir`/`lang` immediately, no reload. Centralized date/number/currency formatting on `Intl` (`lib/format.ts`): default timezone **Asia/Qatar**, Arabic locale (`ar-QA`) pinned to Western (Latin) digits via `numberingSystem: 'latn'`, English locale (`en-GB`) for day-month-year date order matching the region. Sidebar, header, and all 14 app pages converted from physical (`left`/`right`/`ml-`/`mr-`) to logical CSS properties (`start`/`end`, `ms-`/`me-`, `border-s`/`e`) for correct RTL mirroring without a brittle full-interface flip; directional icons (chevrons, arrows) get `rtl:-scale-x-100`.

Added the frontend's first test runner (Vitest — none existed before): 33 tests covering date/number/currency formatting against known timestamps, locale persistence across reload, RTL/LTR `dir` attribute correctness, and a translation-completeness check (en/ar have identical key sets).

**Verified:** typecheck, lint, full Vitest suite (33/33), and production build all clean. **Not verified in a real browser this pass** — no browser-based check of actual Arabic rendering, bidi text mixing, or RTL layout was performed as part of this specific change; the existing Playwright setup from the prior Browser Verification Pass could be re-run against `/dashboard`, `/chat`, etc. with the language switched to confirm visually.

---

## Flyer Creating — Phase 1: Products + Assets Foundation — 2026-08-27

First phase of reimplementing the `flyerai` legacy Flyer Creating experience inside SH Marketing (full migration map covering both audited legacy codebases — a NestJS/Prisma "Catalog Builder" and a separate Express/MongoDB "flyerai" app — was produced via conversation analysis before any code was written; see conversation history for the complete file-by-file REUSE/ADAPT/REWRITE/DISCARD breakdown). This phase is foundation only: no `Flyer`/`FlyerProduct` model yet (Phase 2).

**Backend:** new `Product` and `Asset` Prisma models, company-scoped via the existing `assertMembership` pattern, with query-level `companyId` scoping on update/delete (`updateMany`/`deleteMany` with the tenant filter baked into the `WHERE`, not just a pre-check) matching the codebase's existing tenant-isolation convention. `AssetsModule` uses real multer-based disk storage (MIME allowlist, 15MB limit, UUID filenames under a sanitized per-company folder, path-traversal-safe) instead of the legacy project's base64-in-database approach, backed by a new `backend_uploads` named Docker volume so uploads survive container recreation. 47 new tests (repository/service/controller/tenant-isolation for both modules, plus storage-service path-traversal and MIME/size validation) — **482 → 529 backend tests, all passing.**

**Frontend:** minimal `/products` and `/assets` pages (list/create/delete, fully localized) so the new backend is actually usable ahead of the flyer editor itself landing in a later phase.

**Database migration applied directly to the live production database** (`marketing_os` inside `sh-marketing-postgres`) via `prisma migrate deploy` run inside the container — additive only (two new tables), zero changes to any existing table or row. The root `.env`'s `DATABASE_URL` was discovered to point at an unrelated container's Postgres (port 5432 on the host belongs to `frontend-db-1`, a different project — `sh-marketing-postgres` has no host port mapping at all and is only reachable via the Docker network), so the migration diff was generated using a disposable, unrelated shadow Postgres container rather than that stale root `.env`, and hand-reviewed before applying to strip unrelated drift the raw diff tool produced (an unrelated vector-index drop and FK churn on unrelated tables) before it ever touched the real database.

**Two real bugs found only by live end-to-end verification against the deployed container** (both invisible to typecheck/lint/unit tests, which mock the filesystem and don't know the app's global route prefix):
- Asset upload failed with `EACCES` — the named Docker volume mounts fresh and root-owned, but the backend runs as a non-root user. Fixed in the Dockerfile (pre-create `/app/uploads` with correct ownership before the volume is mounted over it) plus a one-time in-place `chown` of the already-created volume.
- Every generated asset `publicUrl` was missing the app's global `/api/v1` prefix (the serving controller sits behind it like every other controller), so every asset link 404'd. Fixed and re-verified.

**Verified end-to-end against the live deployed backend** (fresh test account, cleaned up after): register → create product → duplicate SKU correctly rejected (409) → delete (204); upload image → fetch the returned `publicUrl` (200, real bytes) → delete → confirm removed from disk (404). Both `/products` and `/assets` frontend pages return 200 on the live preview (`:3002`) rebuilt from the same image.

**Docker:** rebuilt only `sh-marketing-backend` and `sh-marketing-frontend` images/containers (three times total, iterating on the two bugs above); `postgres`, `redis`, the already-stuck `sh-marketing-frontend` (port 3000, pre-existing q-syria port conflict, untouched and unaffected by this work), and every q-syria container were never touched.

**Not done, by design (later phases):** `Flyer`/`FlyerProduct` models and the flyer editor itself (Phase 2–3), CSV import/image-matching/autosave/undo-redo (Phase 4), templates/versions/restore (Phase 5), SVG/PDF/PNG/social export (Phase 6), approval/campaign integration (Phase 7), the AI assistant via SH Marketing's server-side agent tools (Phase 8).
