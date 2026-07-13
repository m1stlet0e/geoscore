-- 历史验证扫描继承关联实验的动作版本，避免升级后误建验证扫描并重复扣费。
UPDATE "Scan" AS scan
SET "verificationActionRevision" = experiment."actionRevision"
FROM "OptimizationExperiment" AS experiment
WHERE scan."verificationExperimentId" = experiment."id"
  AND scan."brandId" = experiment."brandId"
  AND scan."verificationActionRevision" IS NULL;
