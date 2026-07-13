-- CreateEnum
CREATE TYPE "ScanDataMode" AS ENUM ('REAL', 'SIMULATED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('MENTION_GAP', 'COMPETITOR_ADVANTAGE', 'CITATION_GAP', 'BRAND_RISK');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'VERIFYING', 'VERIFIED', 'INCONCLUSIVE');

-- AlterTable
ALTER TABLE "Scan"
ADD COLUMN "repeatCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "dataMode" "ScanDataMode" NOT NULL DEFAULT 'REAL',
ADD COLUMN "verificationExperimentId" TEXT;

-- AlterTable
ALTER TABLE "RiskFinding" ADD COLUMN "scanId" TEXT;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN "scanId" TEXT;

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "priority" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "targetContentType" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationExperiment" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "baselineScanId" TEXT NOT NULL,
    "followUpScanId" TEXT,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "actionPlan" TEXT NOT NULL,
    "targetUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "resultSummary" TEXT,
    "scoreDelta" DOUBLE PRECISION,
    "mentionDelta" DOUBLE PRECISION,
    "recommendationDelta" DOUBLE PRECISION,
    "citationDelta" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizationExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_scanId_promptVersionId_platformId_type_key" ON "Opportunity"("scanId", "promptVersionId", "platformId", "type");

-- CreateIndex
CREATE INDEX "Opportunity_brandId_status_priority_idx" ON "Opportunity"("brandId", "status", "priority");

-- CreateIndex
CREATE INDEX "Opportunity_promptVersionId_idx" ON "Opportunity"("promptVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationExperiment_opportunityId_key" ON "OptimizationExperiment"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationExperiment_followUpScanId_key" ON "OptimizationExperiment"("followUpScanId");

-- CreateIndex
CREATE INDEX "OptimizationExperiment_brandId_status_createdAt_idx" ON "OptimizationExperiment"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_verificationExperimentId_idx" ON "Scan"("verificationExperimentId");

-- CreateIndex
CREATE INDEX "RiskFinding_scanId_idx" ON "RiskFinding"("scanId");

-- CreateIndex
CREATE INDEX "Recommendation_scanId_idx" ON "Recommendation"("scanId");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_verificationExperimentId_fkey" FOREIGN KEY ("verificationExperimentId") REFERENCES "OptimizationExperiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_baselineScanId_fkey" FOREIGN KEY ("baselineScanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_followUpScanId_fkey" FOREIGN KEY ("followUpScanId") REFERENCES "Scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFinding" ADD CONSTRAINT "RiskFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
