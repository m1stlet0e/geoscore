-- 为公开创建扫描接口增加持久幂等键；NULL 允许内部验证扫描继续按既有流程创建。
ALTER TABLE "Scan"
ADD COLUMN "creationKey" TEXT;

-- 同一品牌内一个创建键只能对应一条扫描，并发重放由数据库唯一约束收敛。
CREATE UNIQUE INDEX "Scan_brandId_creationKey_key"
ON "Scan"("brandId", "creationKey");
