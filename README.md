# SH Marketing

Intelligent multi-agent marketing operations platform built on an extensible AI provider abstraction.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11, TypeScript 5, Prisma 6 |
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Database | PostgreSQL 16 + pgvector |
| Queue | Redis 7 + BullMQ |
| AI | Provider-agnostic (Anthropic, OpenAI, Gemini) |
| Embeddings | Voyage AI voyage-3-lite (1024 dims) |

## Quick Start

```bash
# 1. Copy and fill environment variables
cp .env.example .env
# Edit .env — add API keys and generate JWT secrets (see .env.example)

# 2. Start infrastructure
make docker-up     # or: docker compose up -d

# 3. Install dependencies
make install       # or: npm install

# 4. Run database migrations
make db-migrate    # or: cd apps/backend && npx prisma migrate dev

# 5. Start development servers
make dev           # or: npm run dev
```

Backend: http://localhost:3001/api/v1/health  
Frontend: http://localhost:3000

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full 8-layer architecture.

## Development Status

| Phase | Status |
|---|---|
| Phase 0 — Security + Scaffold | ✅ Complete |
| Phase 0.5 — Agent Engine Foundation | 🔜 Next |
| Phase 1 — Auth + Company | ⏳ Pending |
| Phase 2 — Director Agent + Conversations | ⏳ Pending |
| Phase 3 — Frontend | ⏳ Pending |
| Phase 4 — Integration + E2E | ⏳ Pending |

## Security

- Never commit `.env` — it is `.gitignore`d
- Generate secrets with `openssl rand -hex 64`
- All Supabase credentials from the original repository have been rotated; see IMPLEMENTATION_PLAN.md
