-- CreateEnum
CREATE TYPE "FlyerStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "flyers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "companyId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "FlyerStatus" NOT NULL DEFAULT 'DRAFT',
    "designData" JSONB NOT NULL DEFAULT '{}',
    "thumbnail" TEXT,
    "campaignId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flyer_products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "flyerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "displayPrice" DOUBLE PRECISION,
    "originalPrice" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flyer_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flyers_companyId_status_idx" ON "flyers"("companyId", "status");

-- CreateIndex
CREATE INDEX "flyers_campaignId_idx" ON "flyers"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "flyers_companyId_slug_key" ON "flyers"("companyId", "slug");

-- CreateIndex
CREATE INDEX "flyer_products_flyerId_sortOrder_idx" ON "flyer_products"("flyerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "flyer_products_flyerId_productId_key" ON "flyer_products"("flyerId", "productId");

-- AddForeignKey
ALTER TABLE "flyers" ADD CONSTRAINT "flyers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyers" ADD CONSTRAINT "flyers_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyer_products" ADD CONSTRAINT "flyer_products_flyerId_fkey" FOREIGN KEY ("flyerId") REFERENCES "flyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyer_products" ADD CONSTRAINT "flyer_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
