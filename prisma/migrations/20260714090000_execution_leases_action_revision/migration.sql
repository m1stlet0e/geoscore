-- AlterTable
ALTER TABLE "Scan"
ADD COLUMN "executionLeaseToken" TEXT,
ADD COLUMN "executionLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "verificationAttemptToken" TEXT,
ADD COLUMN "verificationActionRevision" INTEGER;

-- AlterTable
ALTER TABLE "OptimizationExperiment"
ADD COLUMN "actionRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "verificationLeaseToken" TEXT,
ADD COLUMN "verificationLeaseExpiresAt" TIMESTAMP(3);

-- 历史已发布及终态实验均视为第一版动作，草稿保持 revision 0。
UPDATE "OptimizationExperiment"
SET "actionRevision" = 1
WHERE "status" <> 'DRAFT';

-- CreateIndex
CREATE INDEX "Scan_status_executionLeaseExpiresAt_idx"
ON "Scan"("status", "executionLeaseExpiresAt");

-- CreateIndex
CREATE INDEX "OptimizationExperiment_status_verificationLeaseExpiresAt_idx"
ON "OptimizationExperiment"("status", "verificationLeaseExpiresAt");
