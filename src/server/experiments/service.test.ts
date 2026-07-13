import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBrandForUser } from "@/server/brands/service";
import { createScanForUser, executeScanForUser } from "@/server/scans/service";
import {
  createExperimentForUser,
  publishExperimentForUser,
  verifyExperimentForUser,
} from "./service";

const userIds: string[] = [];

afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

async function createReadyUser(balance = 100) {
  const free = await db.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const user = await db.user.create({
    data: {
      name: "实验服务测试",
      email: `experiment-${randomUUID()}@test.local`,
    },
  });
  userIds.push(user.id);
  await db.quotaAccount.create({ data: { userId: user.id, balance } });
  await db.subscription.create({
    data: {
      userId: user.id,
      planId: free.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86_400_000),
    },
  });
  return user;
}

async function createBaselineFixture(balance = 100) {
  const user = await createReadyUser(balance);
  const brand = await createBrandForUser(user.id, {
    name: `实验品牌-${randomUUID()}`,
    website: "experiment.example.cn",
    industry: "企业服务",
    product: "品牌监测软件",
    targetAudience: "品牌团队",
    aliases: [],
    competitors: ["竞品甲"],
  });
  const baselineScan = await createScanForUser(user.id, brand.id, ["mock"], {
    repeatCount: 1,
  });
  await executeScanForUser(user.id, baselineScan.id);
  const opportunity = await db.opportunity.findFirstOrThrow({
    where: {
      scanId: baselineScan.id,
      type: { in: ["MENTION_GAP", "COMPETITOR_ADVANTAGE"] },
    },
    orderBy: { priority: "desc" },
  });
  return { user, brand, baselineScan, opportunity };
}

describe("实验服务", () => {
  it("从机会的已完成扫描创建草稿并推进机会状态", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();

    const experiment = await createExperimentForUser(user.id, opportunity.id);

    expect(experiment).toMatchObject({
      opportunityId: opportunity.id,
      brandId: opportunity.brandId,
      baselineScanId: baselineScan.id,
      status: "DRAFT",
      actionPlan: opportunity.recommendedAction,
    });
    expect(experiment.title).toContain(opportunity.title);
    expect(experiment.hypothesis).toContain(opportunity.summary);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } })).status)
      .toBe("IN_PROGRESS");
  });

  it("重复或并发创建同一机会时返回唯一实验", async () => {
    const { user, opportunity } = await createBaselineFixture();

    const results = await Promise.all([
      createExperimentForUser(user.id, opportunity.id),
      createExperimentForUser(user.id, opportunity.id),
    ]);
    const repeated = await createExperimentForUser(user.id, opportunity.id);

    expect(new Set([...results.map((item) => item.id), repeated.id]).size).toBe(1);
    expect(await db.optimizationExperiment.count({
      where: { opportunityId: opportunity.id },
    })).toBe(1);
  });

  it("机会基线扫描未完成时拒绝创建实验", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    await db.scan.update({
      where: { id: baselineScan.id },
      data: { status: "PENDING", completedAt: null },
    });

    await expect(createExperimentForUser(user.id, opportunity.id))
      .rejects.toThrow("机会基线扫描尚未完成");
    expect(await db.optimizationExperiment.count({
      where: { opportunityId: opportunity.id },
    })).toBe(0);
  });

  it("跨用户创建时返回统一的不存在错误且不改变机会", async () => {
    const { opportunity } = await createBaselineFixture();
    const otherUser = await createReadyUser();

    await expect(createExperimentForUser(otherUser.id, opportunity.id))
      .rejects.toThrow("抢位机会不存在");
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } })).status)
      .toBe("OPEN");
  });

  it("发布草稿时规范化行动和 URL 并设置七天后的复查时间", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const before = Date.now();

    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "  新增一篇包含真实案例和量化数据的官网指南  ",
      targetUrl: " HTTPS://Content.Example.com/guide?from=test ",
    });

    expect(active).toMatchObject({
      status: "ACTIVE",
      actionPlan: "新增一篇包含真实案例和量化数据的官网指南",
      targetUrl: "https://content.example.com/guide?from=test",
    });
    expect(active.publishedAt).not.toBeNull();
    expect(active.nextCheckAt).not.toBeNull();
    expect(active.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(active.nextCheckAt!.getTime() - active.publishedAt!.getTime())
      .toBe(7 * 86_400_000);
  });

  it("ACTIVE 重复发布可更新行动但不重置发布时间", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const first = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第一版包含足够细节的行动计划",
      targetUrl: "https://experiment.example.cn/first",
    });

    const second = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第二版包含更多证据的行动计划",
      targetUrl: "https://experiment.example.cn/second",
    });

    expect(second.status).toBe("ACTIVE");
    expect(second.actionPlan).toBe("发布第二版包含更多证据的行动计划");
    expect(second.targetUrl).toBe("https://experiment.example.cn/second");
    expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
    expect(second.nextCheckAt?.getTime()).toBe(first.nextCheckAt?.getTime());
  });

  it.each([
    { actionPlan: "太短", targetUrl: undefined, message: "行动计划至少需要 10 个字符" },
    { actionPlan: "这是满足十个字符以上的行动计划", targetUrl: "ftp://example.com/file", message: "目标网址只支持 HTTP 或 HTTPS" },
    { actionPlan: "这是满足十个字符以上的行动计划", targetUrl: "not a url", message: "目标网址格式不正确" },
  ])("发布参数非法时拒绝且保持草稿：$message", async ({ actionPlan, targetUrl, message }) => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);

    await expect(publishExperimentForUser(user.id, draft.id, { actionPlan, targetUrl }))
      .rejects.toThrow(message);
    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: draft.id } })).status)
      .toBe("DRAFT");
  });

  it("验证中或终态实验拒绝再次发布", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    await db.optimizationExperiment.update({
      where: { id: draft.id },
      data: { status: "VERIFIED" },
    });

    await expect(publishExperimentForUser(user.id, draft.id, {
      actionPlan: "这是不会被终态实验接受的行动计划",
    })).rejects.toThrow("当前实验状态不能发布");
  });

  it("跨用户发布时返回统一的不存在错误", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const otherUser = await createReadyUser();
    const draft = await createExperimentForUser(user.id, opportunity.id);

    await expect(publishExperimentForUser(otherUser.id, draft.id, {
      actionPlan: "这是不会被其他用户接受的行动计划",
    })).rejects.toThrow("行动实验不存在");
  });

  it("复用完整基线执行参数并用真实观察数据完成增量归因", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布针对目标问题的官网证据和对比指南",
      targetUrl: "https://experiment.example.cn/optimized-guide",
    });
    const baseline = await db.scan.findUniqueOrThrow({
      where: { id: baselineScan.id },
      include: { scoreSnapshot: true },
    });

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.status).toBe("VERIFIED");
    expect(result.followUpScanId).toBeTruthy();
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.mentionDelta).toBeGreaterThan(0);
    expect(result.recommendationDelta).toBeGreaterThan(0);
    expect(result.citationDelta).toBeGreaterThan(0);
    expect(result.resultSummary).toContain("验证有效");

    const followUp = await db.scan.findUniqueOrThrow({
      where: { id: result.followUpScanId! },
      include: {
        scoreSnapshot: true,
        observations: { include: { mentions: true, citations: true } },
      },
    });
    expect(followUp.status).toBe("COMPLETED");
    expect(followUp.providerIds).toEqual(baseline.providerIds);
    expect(followUp.promptVersionIds).toEqual(baseline.promptVersionIds);
    expect(followUp.repeatCount).toBe(baseline.repeatCount);
    expect(followUp.verificationExperimentId).toBe(active.id);
    expect(result.followUpScanId).toBe(followUp.id);

    const targetFollowUps = followUp.observations.filter(
      (item) => item.promptVersionId === opportunity.promptVersionId
        && item.platformId === opportunity.platformId,
    );
    expect(targetFollowUps).not.toHaveLength(0);
    expect(targetFollowUps.every(
      (item) => item.modelId === "mock-deterministic-optimized-v1",
    )).toBe(true);

    const baselineObservations = await db.observation.findMany({
      where: {
        scanId: baseline.id,
        promptVersionId: opportunity.promptVersionId,
        platformId: opportunity.platformId,
      },
      include: { mentions: true, citations: true },
    });
    const metric = (observations: typeof baselineObservations) => ({
      mentionRate: observations.filter((item) => item.mentions.some((mention) => mention.isTarget)).length / observations.length * 100,
      recommendationScore: observations.reduce((sum, item) => sum + (item.mentions.find((mention) => mention.isTarget)?.recommendationStrength ?? 0), 0) / observations.length * 100,
      citationRate: observations.filter((item) => item.citations.some((citation) => citation.isOfficial)).length / observations.length * 100,
    });
    const baselineMetric = metric(baselineObservations);
    const followUpMetric = metric(targetFollowUps);
    expect(result.mentionDelta).toBeCloseTo(followUpMetric.mentionRate - baselineMetric.mentionRate, 2);
    expect(result.recommendationDelta).toBeCloseTo(followUpMetric.recommendationScore - baselineMetric.recommendationScore, 2);
    expect(result.citationDelta).toBeCloseTo(followUpMetric.citationRate - baselineMetric.citationRate, 2);
    expect(result.scoreDelta).toBeCloseTo(
      followUp.scoreSnapshot!.score - baseline.scoreSnapshot!.score,
      2,
    );
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } })).status)
      .toBe("COMPLETED");
  });

  it("已完成实验重复复扫直接返回现有结果且不再次扣费", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布可以验证提及提升的完整行动计划",
    });
    const first = await verifyExperimentForUser(user.id, active.id);
    const balanceAfterFirst = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const scanCountAfterFirst = await db.scan.count({ where: { brandId: opportunity.brandId } });

    const repeated = await verifyExperimentForUser(user.id, active.id);

    expect(repeated.id).toBe(first.id);
    expect(repeated.followUpScanId).toBe(first.followUpScanId);
    expect(await db.scan.count({ where: { brandId: opportunity.brandId } }))
      .toBe(scanCountAfterFirst);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceAfterFirst);
  });

  it("历史基线没有版本快照时从观察记录恢复完整版本集合", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const baselineVersionIds = [...new Set((await db.observation.findMany({
      where: { scanId: baselineScan.id },
      select: { promptVersionId: true },
      orderBy: { createdAt: "asc" },
    })).map((item) => item.promptVersionId))];
    await db.$executeRaw`UPDATE "Scan" SET "promptVersionIds" = NULL WHERE "id" = ${baselineScan.id}`;
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布历史基线场景下的完整验证行动计划",
    });

    const result = await verifyExperimentForUser(user.id, active.id);
    const followUp = await db.scan.findUniqueOrThrow({ where: { id: result.followUpScanId! } });

    expect(new Set(followUp.promptVersionIds as string[]))
      .toEqual(new Set(baselineVersionIds));
  });

  it("已有完成但尚未归因的验证扫描时复用且不重复扣费", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证完成扫描恢复能力的行动计划",
    });
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { status: "VERIFYING" },
    });
    const completedVerification = await createScanForUser(
      user.id,
      opportunity.brandId,
      baselineScan.providerIds as string[],
      {
        repeatCount: baselineScan.repeatCount,
        promptVersionIds: baselineScan.promptVersionIds as string[],
        verificationExperimentId: active.id,
      },
    );
    await executeScanForUser(user.id, completedVerification.id);
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { status: "ACTIVE" },
    });
    const balanceBeforeRecovery = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const scanCountBeforeRecovery = await db.scan.count({
      where: { brandId: opportunity.brandId },
    });

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.followUpScanId).toBe(completedVerification.id);
    expect(await db.scan.count({ where: { brandId: opportunity.brandId } }))
      .toBe(scanCountBeforeRecovery);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeRecovery);
  });

  it.each([
    "问题版本",
    "AI 平台",
    "重复次数",
  ])("不复用%s与基线不一致的已完成验证扫描", async (mismatch) => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证错误扫描隔离能力的行动计划",
    });
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { status: "VERIFYING" },
    });
    const mismatchedScan = await createScanForUser(
      user.id,
      opportunity.brandId,
      baselineScan.providerIds as string[],
      {
        repeatCount: baselineScan.repeatCount,
        promptVersionIds: baselineScan.promptVersionIds as string[],
        verificationExperimentId: active.id,
      },
    );
    await executeScanForUser(user.id, mismatchedScan.id);
    if (mismatch === "问题版本") {
      await db.scan.update({
        where: { id: mismatchedScan.id },
        data: {
          promptVersionIds: (baselineScan.promptVersionIds as string[]).slice(0, -1),
        },
      });
    }
    if (mismatch === "AI 平台") {
      await db.scan.update({
        where: { id: mismatchedScan.id },
        data: { providerIds: ["deepseek"] },
      });
    }
    if (mismatch === "重复次数") {
      await db.scan.update({
        where: { id: mismatchedScan.id },
        data: { repeatCount: baselineScan.repeatCount + 1 },
      });
    }
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { status: "ACTIVE" },
    });

    const result = await verifyExperimentForUser(user.id, active.id);
    const followUp = await db.scan.findUniqueOrThrow({
      where: { id: result.followUpScanId! },
    });

    expect(result.followUpScanId).not.toBe(mismatchedScan.id);
    expect(new Set(followUp.promptVersionIds as string[]))
      .toEqual(new Set(baselineScan.promptVersionIds as string[]));
    expect(followUp.providerIds).toEqual(baselineScan.providerIds);
    expect(followUp.repeatCount).toBe(baselineScan.repeatCount);
    expect(await db.scan.count({
      where: { verificationExperimentId: active.id },
    })).toBe(2);
  });

  it("DRAFT 与 VERIFYING 状态拒绝复扫", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);

    await expect(verifyExperimentForUser(user.id, draft.id))
      .rejects.toThrow("实验尚未发布，不能复扫");
    await db.optimizationExperiment.update({
      where: { id: draft.id },
      data: { status: "VERIFYING" },
    });
    await expect(verifyExperimentForUser(user.id, draft.id))
      .rejects.toThrow("实验正在复扫验证");
  });

  it("额度不足时复扫失败并恢复 ACTIVE", async () => {
    const { user, opportunity } = await createBaselineFixture(20);
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布但当前账户额度不足的完整行动计划",
    });

    await expect(verifyExperimentForUser(user.id, active.id)).rejects.toThrow("额度不足");

    const restored = await db.optimizationExperiment.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(restored.status).toBe("ACTIVE");
    expect(restored.followUpScanId).toBeNull();
    expect(await db.scan.count({
      where: { verificationExperimentId: active.id },
    })).toBe(0);
  });

  it("跨用户复扫返回统一的不存在错误", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const otherUser = await createReadyUser();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布不会允许其他用户验证的完整行动计划",
    });

    await expect(verifyExperimentForUser(otherUser.id, active.id))
      .rejects.toThrow("行动实验不存在");
    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: active.id } })).status)
      .toBe("ACTIVE");
  });
});
