-- CreateTable
CREATE TABLE "generated_content" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "companyId" UUID NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "campaignId" UUID,
    "agentExecutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_content_companyId_contentType_idx" ON "generated_content"("companyId", "contentType");

-- CreateIndex
CREATE INDEX "generated_content_companyId_agentType_idx" ON "generated_content"("companyId", "agentType");

-- AddForeignKey
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
