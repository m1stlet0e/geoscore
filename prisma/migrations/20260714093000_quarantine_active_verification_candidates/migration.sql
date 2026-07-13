-- 已发布实验可能关联旧版本验证扫描；在缺少可靠动作版本证据时保守隔离。
-- 仅处理迁移执行时仍为 ACTIVE 的实验，VERIFYING 与终态实验保持不变。
UPDATE "Scan" AS scan
SET "verificationActionRevision" = NULL
FROM "OptimizationExperiment" AS experiment
WHERE scan."verificationExperimentId" = experiment."id"
  AND scan."brandId" = experiment."brandId"
  AND experiment."status" = 'ACTIVE';
