.PHONY: help install dev build docker-up docker-down db-migrate db-generate db-studio security-check

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install all dependencies
	npm install

dev: ## Start all services in development mode
	npm run dev

build: ## Build all packages and apps
	npm run build

docker-up: ## Start Docker services (postgres + redis)
	docker compose up -d
	@echo "Waiting for services..."
	@sleep 3
	@docker compose ps

docker-down: ## Stop Docker services
	docker compose down

docker-logs: ## Follow Docker service logs
	docker compose logs -f

db-generate: ## Generate Prisma client
	cd apps/backend && npx prisma generate

db-migrate: ## Run Prisma migrations (development)
	cd apps/backend && npx prisma migrate dev

db-migrate-deploy: ## Deploy Prisma migrations (production)
	cd apps/backend && npx prisma migrate deploy

db-studio: ## Open Prisma Studio
	cd apps/backend && npx prisma studio

db-reset: ## Reset database (DESTRUCTIVE — dev only)
	cd apps/backend && npx prisma migrate reset --force

security-check: ## Check for secrets in git history
	@echo "Checking for .env in git history..."
	@git log --all --oneline -- .env .env.local .env.*.local 2>/dev/null || true
	@echo "Checking for common secret patterns in staged files..."
	@git diff --cached --name-only | xargs -I{} sh -c 'grep -l "password\|secret\|api_key\|token" "{}" 2>/dev/null && echo "WARNING: Possible secret in {}"' || true
	@echo "Security check complete"

lint: ## Lint all code
	npm run lint

format: ## Format all code
	npm run format
