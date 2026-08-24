-- Phase 0.5: Agent Engine Foundation Schema Migration

-- Add AgentExecutionStatus enum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'PENDING_APPROVAL');

-- Rebuild agent_executions table to match Phase 0.5 design
DROP TABLE IF EXISTS "tool_call_logs";
DROP TABLE IF EXISTS "agent_executions";

CREATE TABLE "agent_executions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "traceId" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "conversationId" UUID,
    "agentType" "AgentType" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AgentExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER,
    "iterations" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_executions_traceId_key" ON "agent_executions"("traceId");
CREATE INDEX "agent_executions_companyId_idx" ON "agent_executions"("companyId");
CREATE INDEX "agent_executions_conversationId_idx" ON "agent_executions"("conversationId");
CREATE INDEX "agent_executions_traceId_idx" ON "agent_executions"("traceId");

ALTER TABLE "agent_executions"
    ADD CONSTRAINT "agent_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_executions"
    ADD CONSTRAINT "agent_executions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild tool_call_logs table
CREATE TABLE "tool_call_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "agentExecutionId" UUID NOT NULL,
    "toolCallId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "wasApproved" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tool_call_logs_agentExecutionId_idx" ON "tool_call_logs"("agentExecutionId");
ALTER TABLE "tool_call_logs"
    ADD CONSTRAINT "tool_call_logs_agentExecutionId_fkey" FOREIGN KEY ("agentExecutionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rebuild approval_requests table
DROP TABLE IF EXISTS "approval_requests";

CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "companyId" UUID NOT NULL,
    "conversationId" UUID,
    "requestedById" UUID,
    "agentExecutionId" TEXT,
    "toolName" TEXT NOT NULL,
    "toolInput" JSONB NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_requests_companyId_status_idx" ON "approval_requests"("companyId", "status");
CREATE INDEX "approval_requests_conversationId_status_idx" ON "approval_requests"("conversationId", "status");

ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_requests_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild agent_tasks table
DROP TABLE IF EXISTS "agent_tasks";

CREATE TABLE "agent_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "companyId" UUID NOT NULL,
    "requestedByAgent" "AgentType" NOT NULL,
    "targetAgent" "AgentType" NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "conversationId" UUID,
    "parentTaskId" UUID,
    "result" JSONB,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_tasks_companyId_status_idx" ON "agent_tasks"("companyId", "status");

ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
