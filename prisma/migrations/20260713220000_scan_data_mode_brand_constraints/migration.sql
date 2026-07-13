-- BackfillData
UPDATE "Scan"
SET "dataMode" = 'SIMULATED'
WHERE "providerIds" @> '["mock"]'::jsonb
  AND "dataMode" <> 'SIMULATED';

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_scanId_fkey";

-- DropForeignKey
ALTER TABLE "OptimizationExperiment" DROP CONSTRAINT "OptimizationExperiment_baselineScanId_fkey";

-- DropForeignKey
ALTER TABLE "OptimizationExperiment" DROP CONSTRAINT "OptimizationExperiment_followUpScanId_fkey";

-- DropForeignKey
ALTER TABLE "OptimizationExperiment" DROP CONSTRAINT "OptimizationExperiment_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_scanId_fkey";

-- DropForeignKey
ALTER TABLE "RiskFinding" DROP CONSTRAINT "RiskFinding_scanId_fkey";

-- DropForeignKey
ALTER TABLE "Scan" DROP CONSTRAINT "Scan_verificationExperimentId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_id_brandId_key" ON "Opportunity"("id", "brandId");

-- CreateIndex
CREATE INDEX "OptimizationExperiment_baselineScanId_idx" ON "OptimizationExperiment"("baselineScanId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationExperiment_id_brandId_key" ON "OptimizationExperiment"("id", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationExperiment_opportunityId_brandId_key" ON "OptimizationExperiment"("opportunityId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationExperiment_followUpScanId_brandId_key" ON "OptimizationExperiment"("followUpScanId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Scan_id_brandId_key" ON "Scan"("id", "brandId");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_verificationExperimentId_brandId_fkey" FOREIGN KEY ("verificationExperimentId", "brandId") REFERENCES "OptimizationExperiment"("id", "brandId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_scanId_brandId_fkey" FOREIGN KEY ("scanId", "brandId") REFERENCES "Scan"("id", "brandId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_opportunityId_brandId_fkey" FOREIGN KEY ("opportunityId", "brandId") REFERENCES "Opportunity"("id", "brandId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_baselineScanId_brandId_fkey" FOREIGN KEY ("baselineScanId", "brandId") REFERENCES "Scan"("id", "brandId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationExperiment" ADD CONSTRAINT "OptimizationExperiment_followUpScanId_brandId_fkey" FOREIGN KEY ("followUpScanId", "brandId") REFERENCES "Scan"("id", "brandId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFinding" ADD CONSTRAINT "RiskFinding_scanId_brandId_fkey" FOREIGN KEY ("scanId", "brandId") REFERENCES "Scan"("id", "brandId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_scanId_brandId_fkey" FOREIGN KEY ("scanId", "brandId") REFERENCES "Scan"("id", "brandId") ON DELETE NO ACTION ON UPDATE CASCADE;
