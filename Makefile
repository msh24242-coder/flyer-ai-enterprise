.PHONY: help setup dev build test docker-up docker-down clean

help:
	@echo "Flyer AI Enterprise - Available Commands"
	@echo "=========================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make setup              - Complete setup (Docker, dependencies, migrations)"
	@echo "  make setup-backend      - Setup backend only"
	@echo "  make setup-frontend     - Setup frontend only"
	@echo ""
	@echo "Development:"
	@echo "  make dev                - Start both frontend and backend"
	@echo "  make dev-backend        - Start backend only"
	@echo "  make dev-frontend       - Start frontend only"
	@echo ""
	@echo "Build & Production:"
	@echo "  make build              - Build both backend and frontend"
	@echo "  make build-backend      - Build backend only"
	@echo "  make build-frontend     - Build frontend only"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up          - Start Docker services"
	@echo "  make docker-down        - Stop Docker services"
	@echo "  make docker-logs        - View Docker logs"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate         - Run database migrations"
	@echo "  make db-seed            - Seed database"
	@echo "  make db-studio          - Open Prisma Studio"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test               - Run all tests"
	@echo "  make test-backend       - Test backend only"
	@echo "  make test-frontend      - Test frontend only"
	@echo "  make lint               - Run linter"
	@echo "  make format             - Format code"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean              - Remove all generated files"
	@echo "  make clean-deps         - Remove node_modules"

# Setup
setup: docker-up setup-backend setup-frontend
	@echo "✅ Setup complete!"

setup-backend:
	@echo "📦 Setting up backend..."
	cd backend && npm install
	cd backend && npx prisma migrate dev --name init
	cd backend && npx prisma db seed

setup-frontend:
	@echo "📦 Setting up frontend..."
	cd frontend && npm install

# Development
dev:
	@echo "🚀 Starting development servers..."
	@echo "Backend: http://localhost:3001"
	@echo "Frontend: http://localhost:3000"
	@echo ""
	@echo "Run these commands in separate terminals:"
	@echo "  Terminal 1: cd backend && npm run dev"
	@echo "  Terminal 2: cd frontend && npm run dev"

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

# Build
build: build-backend build-frontend
	@echo "✅ Build complete!"

build-backend:
	@echo "🔨 Building backend..."
	cd backend && npm run build

build-frontend:
	@echo "🔨 Building frontend..."
	cd frontend && npm run build

# Docker
docker-up:
	@echo "🐳 Starting Docker services..."
	docker-compose up -d
	@echo "✅ Docker services started"

docker-down:
	@echo "🛑 Stopping Docker services..."
	docker-compose down
	@echo "✅ Docker services stopped"

docker-logs:
	docker-compose logs -f

# Database
db-migrate:
	cd backend && npx prisma migrate dev

db-seed:
	cd backend && npx prisma db seed

db-studio:
	cd backend && npx prisma studio

# Testing
test:
	@echo "🧪 Running tests..."
	cd backend && npm test
	cd frontend && npm test

test-backend:
	cd backend && npm test

test-frontend:
	cd frontend && npm test

# Quality
lint:
	@echo "🔍 Linting code..."
	cd backend && npm run lint
	cd frontend && npm run lint

format:
	@echo "✨ Formatting code..."
	cd backend && npm run format
	cd frontend && npm run format

# Cleanup
clean: clean-deps
	@echo "🧹 Cleaning up..."
	rm -rf backend/dist
	rm -rf frontend/.next
	rm -rf frontend/out

clean-deps:
	@echo "🧹 Removing node_modules..."
	rm -rf backend/node_modules
	rm -rf frontend/node_modules

# Utility
status:
	@echo "Docker services status:"
	docker-compose ps

logs-backend:
	cd backend && npm run dev

logs-frontend:
	cd frontend && npm run dev
