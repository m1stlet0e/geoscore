import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createBrandForUser, updatePromptForUser } from "@/server/brands/service";
import {
  calculateRepeatConsistency,
  createScanForUser,
  executeScanForUser,
} from "./service";

const userIds: string[] = [];
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); });

async function createReadyUser(balance = 30) {
  const free = await db.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const user = await db.user.create({ data: { name: "扫描测试", email: `scan-${randomUUID()}@test.local` } });
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
    expect(calculateRepeatConsistency([
      { promptVersionId: "single", platformId: "mock", targetMentioned: true },
    ])).toBe(0);
    expect(calculateRepeatConsistency([
      { promptVersionId: "consistent", platformId: "mock", targetMentioned: true },
      { promptVersionId: "consistent", platformId: "mock", targetMentioned: true },
    ])).toBe(1);
    expect(calculateRepeatConsistency([
      { promptVersionId: "inconsistent", platformId: "mock", targetMentioned: true },
      { promptVersionId: "inconsistent", platformId: "mock", targetMentioned: false },
    ])).toBe(0.5);
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

  it("创建普通扫描时快照所有启用问题的最新版本", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "版本快照品牌", website: "pin.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
      aliases: [], competitors: [],
    });
    const expectedVersionIds = brand.prompts
      .map((prompt) => prompt.versions[0]?.id)
      .filter((id): id is string => Boolean(id));

    const scan = await createScanForUser(user.id, brand.id, ["mock"]);

    expect(scan.promptVersionIds).toEqual(expectedVersionIds);
    expect(scan.requestedCount).toBe(expectedVersionIds.length);
  });

  it("创建后编辑并停用问题仍按扫描固定的旧版本执行", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "旧版本执行品牌", website: "old-version.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
      aliases: [], competitors: [],
    });
    const prompt = brand.prompts[0];
    const oldVersion = prompt.versions[0];
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    const updated = await updatePromptForUser(user.id, prompt.id, {
      text: "这是扫描创建之后才出现的新问题版本",
      active: false,
    });
    const newVersion = updated.versions[0];

    const completed = await executeScanForUser(user.id, scan.id);

    expect(completed.observations.some((item) => item.promptVersionId === oldVersion.id))
      .toBe(true);
    expect(completed.observations.some((item) => item.promptVersionId === newVersion.id))
      .toBe(false);
    expect(completed.observations.find((item) => item.promptVersionId === oldVersion.id)?.rawResponse)
      .toContain(oldVersion.text);
  });

  it("显式固定其他品牌的问题版本时拒绝且不扣费", async () => {
    const [user, otherUser] = await Promise.all([
      createReadyUser(50),
      createReadyUser(50),
    ]);
    const [brand, otherBrand] = await Promise.all([
      createBrandForUser(user.id, {
        name: "当前品牌", website: "current-brand.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
        aliases: [], competitors: [],
      }),
      createBrandForUser(otherUser.id, {
        name: "其他品牌", website: "other-brand.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
        aliases: [], competitors: [],
      }),
    ]);
    const foreignVersionId = otherBrand.prompts[0].versions[0].id;

    await expect(createScanForUser(user.id, brand.id, ["mock"], {
      promptVersionIds: [foreignVersionId],
    })).rejects.toThrow("固定问题版本不属于当前品牌");

    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(50);
  });

  it("显式固定版本去重并按实际版本数计算额度", async () => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: "指定版本品牌", website: "selected-versions.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
      aliases: [], competitors: [],
    });
    const versionIds = brand.prompts.slice(0, 2).map((prompt) => prompt.versions[0].id);

    const scan = await createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount: 2,
      promptVersionIds: [versionIds[0], versionIds[0], versionIds[1]],
    });

    expect(scan.promptVersionIds).toEqual(versionIds);
    expect(scan.requestedCount).toBe(4);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(46);
  });

  it("拒绝为非 VERIFYING 状态的实验创建验证扫描且不扣费", async () => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: "验证状态品牌", website: "verification-state.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队",
      aliases: [], competitors: [],
    });
    const promptVersionId = brand.prompts[0].versions[0].id;
    const baselineScan = await db.scan.create({
      data: {
        brandId: brand.id,
        providerIds: ["mock"],
        promptVersionIds: [promptVersionId],
        requestedCount: 1,
        dataMode: "SIMULATED",
      },
    });
    const opportunity = await db.opportunity.create({
      data: {
        brandId: brand.id,
        scanId: baselineScan.id,
        promptVersionId,
        platformId: "mock",
        type: "MENTION_GAP",
        priority: 80,
        title: "验证状态机会",
        summary: "验证状态摘要",
        evidence: "验证状态证据",
        recommendedAction: "发布一篇完整的官网验证内容",
        targetContentType: "官网指南",
      },
    });
    const draft = await db.optimizationExperiment.create({
      data: {
        brandId: brand.id,
        opportunityId: opportunity.id,
        baselineScanId: baselineScan.id,
        title: "验证状态实验",
        hypothesis: "验证状态假设",
        actionPlan: "发布一篇完整的官网验证内容",
      },
    });

    await expect(createScanForUser(user.id, brand.id, ["mock"], {
      promptVersionIds: [promptVersionId],
      verificationExperimentId: draft.id,
    })).rejects.toThrow("只有验证中的实验可以创建复扫");

    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(50);
    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(1);
  });

  it("重复选择同一 AI 平台时在创建扫描和扣额度前拒绝", async () => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: "重复平台品牌", website: "duplicate-platform.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });

    await expect(createScanForUser(user.id, brand.id, ["mock", "mock"]))
      .rejects.toThrow("AI 平台不能重复选择");

    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(50);
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

    const completedAgain = await executeScanForUser(user.id, scan.id);
    expect(completedAgain.status).toBe("COMPLETED");
    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(20);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(10);
  });

  it("额度不足时拒绝创建扫描", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 2 } });
    const brand = await createBrandForUser(user.id, {
      name: "低额度品牌", website: "low.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业", aliases: [], competitors: [],
    });
    await expect(createScanForUser(user.id, brand.id, ["mock"])).rejects.toThrow("额度不足");
  });

  it("扫描失败退款后拒绝免费重试且不改变额度和回答", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "失败退款品牌", website: "refund.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    await db.scan.update({ where: { id: scan.id }, data: { providerIds: ["unknown"] } });

    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow("未知 AI 平台");
    const balanceAfterFailure = (await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance;
    const observationCountAfterFailure = await db.observation.count({ where: { scanId: scan.id } });

    await expect(executeScanForUser(user.id, scan.id))
      .rejects.toThrow("扫描已失败，请重新创建");

    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(balanceAfterFailure);
    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(observationCountAfterFailure);
    expect(balanceAfterFailure).toBe(30);
    expect(await db.quotaLedger.count({
      where: { referenceId: scan.id, type: "REFUND" },
    })).toBe(1);
    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status).toBe("FAILED");
  });

  it("最终产物任一写入失败时回滚同批业务产物", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "原子产物品牌", website: "atomic-products.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业", aliases: [], competitors: ["竞品甲"],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    await db.opportunity.createMany({
      data: brand.prompts.map((prompt) => ({
        brandId: brand.id,
        scanId: scan.id,
        promptVersionId: prompt.versions[0].id,
        platformId: "mock",
        type: "MENTION_GAP" as const,
        priority: 50,
        title: "预置冲突机会",
        summary: "用于验证最终业务产物事务回滚",
        evidence: "预置证据",
        recommendedAction: "预置动作",
        targetContentType: "测试页面",
      })),
    });
    const opportunityCountBeforeExecution = await db.opportunity.count({ where: { scanId: scan.id } });

    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow();

    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(20);
    expect(await db.scoreSnapshot.count({ where: { scanId: scan.id } })).toBe(0);
    expect(await db.riskFinding.count({ where: { scanId: scan.id } })).toBe(0);
    expect(await db.recommendation.count({ where: { scanId: scan.id } })).toBe(0);
    expect(await db.opportunity.count({ where: { scanId: scan.id } })).toBe(opportunityCountBeforeExecution);
    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status).toBe("FAILED");
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(30);
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

  it("同一扫描并发执行时只有一个调用取得执行权", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "并发执行品牌", website: "concurrent-execute.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);

    const results = await Promise.allSettled([
      executeScanForUser(user.id, scan.id),
      executeScanForUser(user.id, scan.id),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((item) => item.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected" });
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ message: "扫描正在执行" });
    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(20);
    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status).toBe("COMPLETED");
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(10);
    expect(await db.quotaLedger.count({ where: { referenceId: scan.id, type: "REFUND" } })).toBe(0);
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
