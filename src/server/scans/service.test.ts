import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBrandForUser } from "@/server/brands/service";
import {
  calculateRepeatConsistency,
  createScanForUser,
  executeScanForUser,
} from "./service";

const userIds: string[] = [];
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); });

async function createReadyUser(balance = 30) {
  const free = await db.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const user = await db.user.create({ data: { name: "扫描测试", email: `scan-${Date.now()}@test.local` } });
  userIds.push(user.id);
  await db.quotaAccount.create({ data: { userId: user.id, balance } });
  await db.subscription.create({ data: { userId: user.id, planId: free.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) } });
  return user;
}

describe("扫描服务", () => {
  it("按问题版本和平台计算目标提及结果的一致率", () => {
    expect(calculateRepeatConsistency([
      { promptVersionId: "prompt-1", platformId: "mock", targetMentioned: true },
      { promptVersionId: "prompt-1", platformId: "mock", targetMentioned: true },
      { promptVersionId: "prompt-2", platformId: "mock", targetMentioned: true },
      { promptVersionId: "prompt-2", platformId: "mock", targetMentioned: false },
    ])).toBe(0.75);
    expect(calculateRepeatConsistency([])).toBe(0);
  });

  it("Mock 扫描显式落库为模拟数据", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "模拟扫描品牌", website: "simulated.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    const scan = await createScanForUser(user.id, brand.id, ["mock"]);

    expect(scan.dataMode).toBe("SIMULATED");
  });

  it("repeatCount=2 时预扣 40 次并真实保存两轮回答", async () => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: "重复扫描品牌", website: "repeat.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    const scan = await createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount: 2,
      env: { AI_PROVIDER: "mock" },
    });

    expect(scan.requestedCount).toBe(40);
    expect(scan.repeatCount).toBe(2);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(10);

    const completed = await executeScanForUser(user.id, scan.id);
    expect(completed.observations).toHaveLength(40);
    expect([...new Set(completed.observations.map((item) => item.runIndex))].sort()).toEqual([1, 2]);
    expect(completed.scoreSnapshot?.confidenceScore).toBe(50);
  });

  it.each([0, 4, 1.5])("repeatCount=%s 非法时在扣额度前拒绝", async (repeatCount) => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: `非法重复次数品牌-${repeatCount}`, website: `invalid-repeat-${repeatCount}.example.cn`, industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    await expect(createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount,
      env: { AI_PROVIDER: "mock" },
    })).rejects.toThrow("重复采样次数必须是 1 到 3 之间的整数");
    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(50);
  });

  it("拒绝在同一扫描中混用真实与模拟平台", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "混合扫描品牌", website: "mixed.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    await expect(createScanForUser(
      user.id,
      brand.id,
      ["mock", "deepseek"],
      { env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "test-key" } },
    )).rejects.toThrow("一次扫描不能混合真实与模拟 AI 平台");
    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(30);
  });

  it("预扣额度、保存原始回答并生成评分快照", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "扫描品牌", website: "scan.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: ["Scan Brand"], competitors: ["竞品甲", "竞品乙"],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    const completed = await executeScanForUser(user.id, scan.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.observations).toHaveLength(20);
    expect(completed.scoreSnapshot?.score).toBeGreaterThanOrEqual(0);
    const recommendations = await db.recommendation.findMany({ where: { brandId: brand.id } });
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((item) => item.scanId === scan.id)).toBe(true);
    const opportunities = await db.opportunity.findMany({
      where: { scanId: scan.id },
      orderBy: { priority: "desc" },
    });
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.some((item) => item.type === "MENTION_GAP")).toBe(true);
    for (const opportunity of opportunities) {
      expect(opportunity.brandId).toBe(brand.id);
      expect(opportunity.scanId).toBe(scan.id);
      const relatedResponses = completed.observations.filter(
        (item) => item.promptVersionId === opportunity.promptVersionId
          && item.platformId === opportunity.platformId,
      );
      expect(relatedResponses.some((item) => opportunity.evidence.includes(item.rawResponse))).toBe(true);
    }
    const quota = await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(quota.balance).toBe(10);
  });

  it("额度不足时拒绝创建扫描", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 2 } });
    const brand = await createBrandForUser(user.id, {
      name: "低额度品牌", website: "low.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业", aliases: [], competitors: [],
    });
    await expect(createScanForUser(user.id, brand.id, ["mock"])).rejects.toThrow("额度不足");
  });

  it("扫描执行失败时只退款一次", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "失败退款品牌", website: "refund.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    await db.scan.update({ where: { id: scan.id }, data: { providerIds: ["unknown"] } });

    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow("未知 AI 平台");
    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow("未知 AI 平台");

    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(30);
    expect(await db.quotaLedger.count({
      where: { referenceId: scan.id, type: "REFUND" },
    })).toBe(1);
    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status).toBe("FAILED");
  });

  it("同一品牌连续扫描的建议按 scanId 严格隔离", async () => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: "建议隔离品牌", website: "recommendation-isolation.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });

    const firstScan = await createScanForUser(user.id, brand.id, ["mock"]);
    await executeScanForUser(user.id, firstScan.id);
    const secondScan = await createScanForUser(user.id, brand.id, ["mock"]);
    await executeScanForUser(user.id, secondScan.id);

    const [firstRecommendations, secondRecommendations] = await Promise.all([
      db.recommendation.findMany({ where: { brandId: brand.id, scanId: firstScan.id } }),
      db.recommendation.findMany({ where: { brandId: brand.id, scanId: secondScan.id } }),
    ]);
    expect(firstRecommendations.length).toBeGreaterThan(0);
    expect(secondRecommendations.length).toBeGreaterThan(0);
    expect(firstRecommendations.every((item) => item.scanId === firstScan.id)).toBe(true);
    expect(secondRecommendations.every((item) => item.scanId === secondScan.id)).toBe(true);
    const firstIds = new Set(firstRecommendations.map((item) => item.id));
    expect(secondRecommendations.some((item) => firstIds.has(item.id))).toBe(false);
  });

  it("并发创建扫描时额度不会被超扣", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 20 } });
    const brand = await createBrandForUser(user.id, {
      name: "并发品牌", website: "concurrent.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });
    const results = await Promise.allSettled([
      createScanForUser(user.id, brand.id, ["mock"]),
      createScanForUser(user.id, brand.id, ["mock"]),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(0);
  });
});
