import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.restoreAllMocks();
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

async function createVerificationCandidate(
  userId: string,
  brandId: string,
  experimentId: string,
  baselineScan: {
    providerIds: unknown;
    promptVersionIds: unknown;
    repeatCount: number;
  },
  verificationLeaseToken: string,
) {
  await db.optimizationExperiment.update({
    where: { id: experimentId },
    data: {
      status: "VERIFYING",
      verificationLeaseToken,
      verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
    },
  });
  return createScanForUser(
    userId,
    brandId,
    baselineScan.providerIds as string[],
    {
      repeatCount: baselineScan.repeatCount,
      promptVersionIds: baselineScan.promptVersionIds as string[],
      verificationExperimentId: experimentId,
      verificationLeaseToken,
    },
  );
}

async function createCompletedVerificationCandidate(
  input: {
    userId: string;
    brandId: string;
    experimentId: string;
    baselineScan: {
      id: string;
      providerIds: unknown;
      promptVersionIds: unknown;
      repeatCount: number;
    };
    promptVersionId: string;
    platformId: string;
    verificationLeaseToken: string;
    scoreDelta?: number;
  },
) {
  const candidate = await createVerificationCandidate(
    input.userId,
    input.brandId,
    input.experimentId,
    input.baselineScan,
    input.verificationLeaseToken,
  );
  const [baselineSnapshot, baselineObservations] = await Promise.all([
    db.scoreSnapshot.findUniqueOrThrow({ where: { scanId: input.baselineScan.id } }),
    db.observation.findMany({
      where: {
        scanId: input.baselineScan.id,
        promptVersionId: input.promptVersionId,
        platformId: input.platformId,
      },
      include: { mentions: true, citations: true },
    }),
  ]);
  for (const observation of baselineObservations) {
    await db.observation.create({
      data: {
        scanId: candidate.id,
        promptVersionId: observation.promptVersionId,
        platformId: observation.platformId,
        modelId: observation.modelId,
        requestId: observation.requestId,
        runIndex: observation.runIndex,
        rawResponse: observation.rawResponse,
        latencyMs: observation.latencyMs,
        mentions: {
          create: observation.mentions.map((mention) => ({
            brandName: mention.brandName,
            isTarget: mention.isTarget,
            position: mention.position,
            recommendationStrength: mention.recommendationStrength,
            sentiment: mention.sentiment,
            evidence: mention.evidence,
          })),
        },
        citations: {
          create: observation.citations.map((citation) => ({
            url: citation.url,
            domain: citation.domain,
            title: citation.title,
            sourceQuality: citation.sourceQuality,
            isOfficial: citation.isOfficial,
          })),
        },
      },
    });
  }
  await db.$transaction([
    db.scoreSnapshot.create({
      data: {
        scanId: candidate.id,
        brandId: input.brandId,
        algorithmVersion: baselineSnapshot.algorithmVersion,
        score: baselineSnapshot.score + (input.scoreDelta ?? 0),
        mentionScore: baselineSnapshot.mentionScore,
        recommendationScore: baselineSnapshot.recommendationScore,
        shareOfVoiceScore: baselineSnapshot.shareOfVoiceScore,
        citationScore: baselineSnapshot.citationScore,
        sentimentScore: baselineSnapshot.sentimentScore,
        confidenceScore: baselineSnapshot.confidenceScore,
        isProvisional: baselineSnapshot.isProvisional,
        riskLevel: baselineSnapshot.riskLevel,
      },
    }),
    db.scan.update({
      where: { id: candidate.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    db.optimizationExperiment.update({
      where: { id: input.experimentId },
      data: {
        status: "ACTIVE",
        verificationLeaseToken: null,
        verificationLeaseExpiresAt: null,
      },
    }),
  ]);
  return candidate;
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
      actionRevision: 0,
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
      actionRevision: 1,
    });
    expect(active.publishedAt).not.toBeNull();
    expect(active.nextCheckAt).not.toBeNull();
    expect(active.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(active.nextCheckAt!.getTime() - active.publishedAt!.getTime())
      .toBe(7 * 86_400_000);
  });

  it("ACTIVE 实质变更动作时保留首次发布时间并从变更时重置七天复查窗口", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const first = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第一版包含足够细节的行动计划",
      targetUrl: "https://experiment.example.cn/first",
    });
    await db.optimizationExperiment.update({
      where: { id: first.id },
      data: { nextCheckAt: new Date(Date.now() + 60_000) },
    });
    const beforeChange = Date.now();

    const second = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第二版包含更多证据的行动计划",
      targetUrl: "https://experiment.example.cn/second",
    });

    expect(second.status).toBe("ACTIVE");
    expect(second.actionPlan).toBe("发布第二版包含更多证据的行动计划");
    expect(second.targetUrl).toBe("https://experiment.example.cn/second");
    expect(first.actionRevision).toBe(1);
    expect(second.actionRevision).toBe(2);
    expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
    expect(second.nextCheckAt!.getTime()).toBeGreaterThanOrEqual(
      beforeChange + 7 * 86_400_000,
    );
    expect(second.nextCheckAt!.getTime()).toBeLessThanOrEqual(
      Date.now() + 7 * 86_400_000,
    );
  });

  it("ACTIVE 发布规范化后内容相同时不递增动作版本也不重置时间", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const first = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "  发布一版包含充分证据的完整行动计划  ",
      targetUrl: "https://experiment.example.cn/same/",
    });

    const repeated = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布一版包含充分证据的完整行动计划",
      targetUrl: " https://experiment.example.cn/same ",
    });

    expect(repeated.actionRevision).toBe(1);
    expect(repeated.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
    expect(repeated.nextCheckAt?.getTime()).toBe(first.nextCheckAt?.getTime());
  });

  it("并发发布相同草稿时只产生第一版动作且两个请求都返回成功", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const input = {
      actionPlan: "发布一版可供并发幂等验证的完整行动计划",
      targetUrl: "https://experiment.example.cn/concurrent-publish",
    };

    const results = await Promise.all([
      publishExperimentForUser(user.id, draft.id, input),
      publishExperimentForUser(user.id, draft.id, input),
    ]);

    expect(results.every((item) => item.status === "ACTIVE")).toBe(true);
    expect(results.every((item) => item.actionRevision === 1)).toBe(true);
    expect(results.every((item) => item.actionPlan === input.actionPlan)).toBe(true);
    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: draft.id } }))
      .actionRevision).toBe(1);
  });

  it("ACTIVE 同一旧版本并发提交相同变更时幂等返回且只递增一次", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const first = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布并发变更前的第一版完整行动计划",
      targetUrl: "https://experiment.example.cn/before-active-race",
    });
    const input = {
      actionPlan: "发布两个并发请求完全相同的第二版行动计划",
      targetUrl: " https://experiment.example.cn/same-active-race/ ",
    };

    const results = await Promise.all([
      publishExperimentForUser(user.id, first.id, input),
      publishExperimentForUser(user.id, first.id, input),
    ]);

    expect(results.every((item) => item.status === "ACTIVE")).toBe(true);
    expect(results.every((item) => item.actionRevision === 2)).toBe(true);
    expect(results.every(
      (item) => item.targetUrl === "https://experiment.example.cn/same-active-race",
    )).toBe(true);
    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: first.id } }))
      .actionRevision).toBe(2);
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

  it("基线评分算法版本过期时保持 ACTIVE 且不创建扫描、不扣额度", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证算法版本门禁的完整行动计划",
    });
    await db.scoreSnapshot.update({
      where: { scanId: baselineScan.id },
      data: { algorithmVersion: "legacy-scoring-v0" },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const scanCountBefore = await db.scan.count({ where: { brandId: opportunity.brandId } });

    await expect(verifyExperimentForUser(user.id, active.id))
      .rejects.toThrow("基线评分算法版本已过期，请重新扫描后再创建实验");

    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: active.id } })).status)
      .toBe("ACTIVE");
    expect(await db.scan.count({ where: { brandId: opportunity.brandId } })).toBe(scanCountBefore);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBefore);
  });

  it("真实数据实验在 nextCheckAt 前拒绝验证且不发起网络请求、不扣额度", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布需要等待真实数据观察窗口的完整行动计划",
    });
    await db.scan.update({
      where: { id: baselineScan.id },
      data: { dataMode: "REAL" },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    await expect(verifyExperimentForUser(user.id, active.id))
      .rejects.toThrow("真实数据实验尚未到复查时间");

    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: active.id } })).status)
      .toBe("ACTIVE");
    expect(await db.scan.count({ where: { verificationExperimentId: active.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBefore);
  });

  it("REAL 验证初读后动作升级并重置窗口时旧请求拒绝且零扫描零扣费", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第一版已到复查时间的真实数据行动计划",
    });
    await Promise.all([
      db.scan.update({
        where: { id: baselineScan.id },
        data: { dataMode: "REAL" },
      }),
      db.optimizationExperiment.update({
        where: { id: active.id },
        data: { nextCheckAt: new Date(Date.now() - 60_000) },
      }),
    ]);
    const delegate = db.optimizationExperiment as unknown as {
      findFirst: (args: unknown) => Promise<unknown>;
    };
    const originalFindFirst = delegate.findFirst.bind(delegate);
    vi.spyOn(delegate, "findFirst").mockImplementationOnce(async (args) => {
      const staleRevision = await originalFindFirst(args);
      await db.optimizationExperiment.update({
        where: { id: active.id },
        data: {
          actionPlan: "发布第二版需要重新等待观察窗口的真实数据行动计划",
          actionRevision: { increment: 1 },
          nextCheckAt: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      return staleRevision;
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const scanCountBefore = await db.scan.count({ where: { brandId: opportunity.brandId } });

    await expect(verifyExperimentForUser(user.id, active.id))
      .rejects.toThrow("实验动作或复查时间已变化，请重新发起验证");

    const current = await db.optimizationExperiment.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(current.status).toBe("ACTIVE");
    expect(current.actionRevision).toBe(2);
    expect(current.verificationLeaseToken).toBeNull();
    expect(await db.scan.count({ where: { brandId: opportunity.brandId } }))
      .toBe(scanCountBefore);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBefore);
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
      data: {
        status: "VERIFYING",
        verificationLeaseToken: "completed-candidate-owner",
        verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const completedVerification = await createScanForUser(
      user.id,
      opportunity.brandId,
      baselineScan.providerIds as string[],
      {
        repeatCount: baselineScan.repeatCount,
        promptVersionIds: baselineScan.promptVersionIds as string[],
        verificationExperimentId: active.id,
        verificationLeaseToken: "completed-candidate-owner",
      },
    );
    await executeScanForUser(user.id, completedVerification.id);
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { verificationLeaseExpiresAt: new Date(Date.now() - 60_000) },
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

  it("VERIFYING 在创建扫描前崩溃后可由过期 lease 接管并仅扣一次", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证无扫描崩溃恢复的完整行动计划",
    });
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: {
        status: "VERIFYING",
        verificationLeaseToken: "crashed-before-scan",
        verificationLeaseExpiresAt: new Date(Date.now() - 60_000),
      },
    });
    const balanceBeforeRecovery = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.followUpScanId).toBeTruthy();
    expect(await db.scan.count({ where: { verificationExperimentId: active.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeRecovery - baselineScan.requestedCount);
  });

  it("VERIFYING 在 PENDING 扫描创建后崩溃可复用同一扫描且不二次扣费", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证待执行扫描恢复的完整行动计划",
    });
    const pendingScan = await createVerificationCandidate(
      user.id,
      opportunity.brandId,
      active.id,
      baselineScan,
      "crashed-pending-owner",
    );
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { verificationLeaseExpiresAt: new Date(Date.now() - 60_000) },
    });
    const balanceBeforeRecovery = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.followUpScanId).toBe(pendingScan.id);
    expect(await db.scan.count({ where: { verificationExperimentId: active.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeRecovery);
  });

  it("VERIFYING 在部分 RUNNING 扫描后崩溃可断点补齐且不二次扣费", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证部分扫描恢复的完整行动计划",
    });
    const partialScan = await createVerificationCandidate(
      user.id,
      opportunity.brandId,
      active.id,
      baselineScan,
      "crashed-running-owner",
    );
    const firstPromptVersionId = (baselineScan.promptVersionIds as string[])[0];
    const firstPlatformId = (baselineScan.providerIds as string[])[0];
    const persisted = await db.observation.create({
      data: {
        scanId: partialScan.id,
        promptVersionId: firstPromptVersionId,
        platformId: firstPlatformId,
        modelId: "partial-verification-model",
        runIndex: 1,
        rawResponse: "验证 worker 崩溃前已持久化的回答",
      },
    });
    await db.scan.update({
      where: { id: partialScan.id },
      data: {
        status: "RUNNING",
        executionLeaseToken: "crashed-scan-owner",
        executionLeaseExpiresAt: new Date(Date.now() - 60_000),
      },
    });
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: { verificationLeaseExpiresAt: new Date(Date.now() - 60_000) },
    });
    const balanceBeforeRecovery = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    const result = await verifyExperimentForUser(user.id, active.id);
    const recoveredObservations = await db.observation.findMany({
      where: { scanId: partialScan.id },
    });

    expect(result.followUpScanId).toBe(partialScan.id);
    expect(recoveredObservations).toHaveLength(partialScan.requestedCount);
    expect(recoveredObservations.some((item) => item.id === persisted.id)).toBe(true);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeRecovery);
  });

  it("动作版本变化后忽略旧版已完成候选并创建当前版本验证扫描", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture(150);
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const firstAction = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布第一版用于候选隔离的完整行动计划",
    });
    const oldCandidate = await createVerificationCandidate(
      user.id,
      opportunity.brandId,
      firstAction.id,
      baselineScan,
      "first-action-owner",
    );
    await executeScanForUser(user.id, oldCandidate.id);
    await db.optimizationExperiment.update({
      where: { id: firstAction.id },
      data: {
        status: "ACTIVE",
        verificationLeaseToken: null,
        verificationLeaseExpiresAt: null,
      },
    });
    const secondAction = await publishExperimentForUser(user.id, firstAction.id, {
      actionPlan: "发布第二版加入更多证据的完整行动计划",
    });
    const balanceBeforeVerification = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    const result = await verifyExperimentForUser(user.id, secondAction.id);
    const followUp = await db.scan.findUniqueOrThrow({ where: { id: result.followUpScanId! } });

    expect(secondAction.actionRevision).toBe(2);
    expect(oldCandidate.verificationActionRevision).toBe(1);
    expect(result.followUpScanId).not.toBe(oldCandidate.id);
    expect(followUp.verificationActionRevision).toBe(2);
    expect(await db.scan.count({ where: { verificationExperimentId: secondAction.id } })).toBe(2);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeVerification - baselineScan.requestedCount);
  });

  it("纠正迁移隔离历史 ACTIVE 完成候选后验证必须新建当前版本扫描", async () => {
    const { user, baselineScan, opportunity } = await createBaselineFixture(150);
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布迁移前无法证明动作一致性的完整行动计划",
    });
    const historicalCandidate = await createVerificationCandidate(
      user.id,
      opportunity.brandId,
      active.id,
      baselineScan,
      "historical-active-candidate-owner",
    );
    await executeScanForUser(user.id, historicalCandidate.id);
    await db.optimizationExperiment.update({
      where: { id: active.id },
      data: {
        status: "ACTIVE",
        verificationLeaseToken: null,
        verificationLeaseExpiresAt: null,
      },
    });
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260714093000_quarantine_active_verification_candidates/migration.sql",
    );
    const migrationExists = await access(migrationPath).then(() => true, () => false);
    expect(migrationExists).toBe(true);
    if (!migrationExists) return;
    await db.$executeRawUnsafe(await readFile(migrationPath, "utf8"));
    const balanceBeforeVerification = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;

    const result = await verifyExperimentForUser(user.id, active.id);
    const quarantined = await db.scan.findUniqueOrThrow({
      where: { id: historicalCandidate.id },
    });

    expect(quarantined.verificationActionRevision).toBeNull();
    expect(result.followUpScanId).not.toBe(historicalCandidate.id);
    expect(await db.scan.count({ where: { verificationExperimentId: active.id } })).toBe(2);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeVerification - baselineScan.requestedCount);
  });

  it("品牌风险机会可仅凭同目标风险解除验证成功", async () => {
    const { user, brand, baselineScan, opportunity } = await createBaselineFixture();
    await db.opportunity.deleteMany({
      where: {
        scanId: baselineScan.id,
        type: "BRAND_RISK",
        id: { not: opportunity.id },
      },
    });
    const riskOpportunity = await db.opportunity.update({
      where: { id: opportunity.id },
      data: { type: "BRAND_RISK" },
    });
    const draft = await createExperimentForUser(user.id, riskOpportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于澄清目标品牌风险的完整事实说明",
    });
    await createCompletedVerificationCandidate({
      userId: user.id,
      brandId: brand.id,
      experimentId: active.id,
      baselineScan,
      promptVersionId: riskOpportunity.promptVersionId,
      platformId: riskOpportunity.platformId,
      verificationLeaseToken: "risk-resolution-candidate",
    });

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.status).toBe("VERIFIED");
    expect(result.scoreDelta).toBe(0);
    expect(result.mentionDelta).toBe(0);
    expect(result.recommendationDelta).toBe(0);
    expect(result.citationDelta).toBe(0);
    expect(result.resultSummary).toContain("品牌风险已解除");
  });

  it("复扫新增同目标品牌风险时即使总分提升也拒绝验证", async () => {
    const { user, brand, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证新增目标风险拦截的完整行动计划",
    });
    const candidate = await createCompletedVerificationCandidate({
      userId: user.id,
      brandId: brand.id,
      experimentId: active.id,
      baselineScan,
      promptVersionId: opportunity.promptVersionId,
      platformId: opportunity.platformId,
      verificationLeaseToken: "new-target-risk-candidate",
      scoreDelta: 1,
    });
    await db.opportunity.create({
      data: {
        brandId: brand.id,
        scanId: candidate.id,
        promptVersionId: opportunity.promptVersionId,
        platformId: opportunity.platformId,
        type: "BRAND_RISK",
        priority: 100,
        title: "复扫新增目标风险",
        summary: "目标问题与平台出现新的品牌风险",
        evidence: "新的目标品牌风险证据",
        recommendedAction: "立即核查并澄清",
        targetContentType: "风险澄清页",
      },
    });

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.status).toBe("INCONCLUSIVE");
    expect(result.scoreDelta).toBe(1);
    expect(result.resultSummary).toContain("新的目标品牌风险");
  });

  it("无关的全局 RiskFinding 不会阻断同目标的正向归因", async () => {
    const { user, brand, baselineScan, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);
    const active = await publishExperimentForUser(user.id, draft.id, {
      actionPlan: "发布用于验证风险归因隔离的完整行动计划",
    });
    const candidate = await createCompletedVerificationCandidate({
      userId: user.id,
      brandId: brand.id,
      experimentId: active.id,
      baselineScan,
      promptVersionId: opportunity.promptVersionId,
      platformId: opportunity.platformId,
      verificationLeaseToken: "unrelated-risk-candidate",
      scoreDelta: 1,
    });
    await db.riskFinding.create({
      data: {
        brandId: brand.id,
        scanId: candidate.id,
        level: "CRITICAL",
        title: "其他问题产生的风险",
        description: "该风险不属于实验目标问题与平台",
        evidence: "无关风险证据",
      },
    });

    const result = await verifyExperimentForUser(user.id, active.id);

    expect(result.status).toBe("VERIFIED");
    expect(result.scoreDelta).toBe(1);
    expect(result.resultSummary).not.toContain("新的目标品牌风险");
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
      data: {
        status: "VERIFYING",
        verificationLeaseToken: `mismatched-candidate-${mismatch}`,
        verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const mismatchedScan = await createScanForUser(
      user.id,
      opportunity.brandId,
      baselineScan.providerIds as string[],
      {
        repeatCount: baselineScan.repeatCount,
        promptVersionIds: baselineScan.promptVersionIds as string[],
        verificationExperimentId: active.id,
        verificationLeaseToken: `mismatched-candidate-${mismatch}`,
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

  it("DRAFT 与持有活动 lease 的 VERIFYING 状态拒绝复扫且不恢复 ACTIVE", async () => {
    const { user, opportunity } = await createBaselineFixture();
    const draft = await createExperimentForUser(user.id, opportunity.id);

    await expect(verifyExperimentForUser(user.id, draft.id))
      .rejects.toThrow("实验尚未发布，不能复扫");
    await db.optimizationExperiment.update({
      where: { id: draft.id },
      data: {
        status: "VERIFYING",
        verificationLeaseToken: "active-verification-owner",
        verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(verifyExperimentForUser(user.id, draft.id))
      .rejects.toThrow("实验正在复扫验证");
    expect((await db.optimizationExperiment.findUniqueOrThrow({ where: { id: draft.id } })).status)
      .toBe("VERIFYING");
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
