import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

type ColumnRow = {
  tableName: string;
  columnName: string;
};

type IndexRow = {
  indexname: string;
};

describe("扫描与实验 lease 数据结构", () => {
  it("持久化扫描和实验 lease、验证 attempt 与动作版本", async () => {
    const columns = await db.$queryRaw<ColumnRow[]>`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('Scan', 'OptimizationExperiment')
    `;
    const namesByTable = new Map<string, Set<string>>();
    for (const column of columns) {
      const names = namesByTable.get(column.tableName) ?? new Set<string>();
      names.add(column.columnName);
      namesByTable.set(column.tableName, names);
    }

    expect([...(namesByTable.get("Scan") ?? [])]).toEqual(expect.arrayContaining([
      "executionLeaseToken",
      "executionLeaseExpiresAt",
      "verificationAttemptToken",
      "verificationActionRevision",
    ]));
    expect([...(namesByTable.get("OptimizationExperiment") ?? [])]).toEqual(expect.arrayContaining([
      "verificationLeaseToken",
      "verificationLeaseExpiresAt",
      "actionRevision",
    ]));
  });

  it("为按状态回收过期 lease 建立索引", async () => {
    const indexes = await db.$queryRaw<IndexRow[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'Scan_status_executionLeaseExpiresAt_idx',
          'OptimizationExperiment_status_verificationLeaseExpiresAt_idx'
        )
    `;

    expect(indexes.map((item) => item.indexname).sort()).toEqual([
      "OptimizationExperiment_status_verificationLeaseExpiresAt_idx",
      "Scan_status_executionLeaseExpiresAt_idx",
    ]);
  });

  it("升级时按关联实验回填历史验证扫描的动作版本", async () => {
    const user = await db.user.create({
      data: { name: "迁移测试", email: `lease-migration-${randomUUID()}@test.local` },
    });

    try {
      const brand = await db.brand.create({
        data: {
          ownerId: user.id,
          name: `迁移品牌-${randomUUID()}`,
          website: "lease-migration.example.cn",
          industry: "企业服务",
          product: "迁移测试产品",
          targetAudience: "品牌团队",
        },
      });
      const prompt = await db.prompt.create({
        data: {
          brandId: brand.id,
          category: "DISCOVERY",
          versions: { create: { version: 1, text: "迁移测试问题" } },
        },
        include: { versions: true },
      });
      const baselineScan = await db.scan.create({
        data: {
          brandId: brand.id,
          status: "COMPLETED",
          providerIds: ["mock"],
          promptVersionIds: [prompt.versions[0].id],
          requestedCount: 1,
          repeatCount: 1,
          dataMode: "SIMULATED",
          completedAt: new Date(),
        },
      });
      const opportunity = await db.opportunity.create({
        data: {
          brandId: brand.id,
          scanId: baselineScan.id,
          promptVersionId: prompt.versions[0].id,
          platformId: "mock",
          type: "MENTION_GAP",
          priority: 80,
          title: "迁移机会",
          summary: "迁移摘要",
          evidence: "迁移证据",
          recommendedAction: "发布验证内容",
          targetContentType: "官网指南",
        },
      });
      const experiment = await db.optimizationExperiment.create({
        data: {
          brandId: brand.id,
          opportunityId: opportunity.id,
          baselineScanId: baselineScan.id,
          title: "历史验证实验",
          hypothesis: "迁移后应继续复用历史扫描",
          actionPlan: "发布验证内容",
          status: "ACTIVE",
          actionRevision: 7,
        },
      });
      const historicalScan = await db.scan.create({
        data: {
          brandId: brand.id,
          status: "COMPLETED",
          providerIds: ["mock"],
          promptVersionIds: [prompt.versions[0].id],
          requestedCount: 1,
          repeatCount: 1,
          dataMode: "SIMULATED",
          verificationExperimentId: experiment.id,
          verificationActionRevision: null,
          completedAt: new Date(),
        },
      });
      const migrationSql = await readFile(
        path.join(
          process.cwd(),
          "prisma/migrations/20260714091500_backfill_verification_action_revision/migration.sql",
        ),
        "utf8",
      );

      await db.$executeRawUnsafe(migrationSql);

      const migrated = await db.scan.findUniqueOrThrow({ where: { id: historicalScan.id } });
      expect(migrated.verificationActionRevision).toBe(7);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
