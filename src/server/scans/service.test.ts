import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createBrandForUser, updatePromptForUser } from "@/server/brands/service";
import {
  calculateRepeatConsistency,
  createScanForUser,
  executeScanForUser,
} from "./service";

const userIds: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

async function createReadyUser(balance = 30) {
  const free = await db.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const user = await db.user.create({ data: { name: "扫描测试", email: `scan-${randomUUID()}@test.local` } });
  userIds.push(user.id);
  await db.quotaAccount.create({ data: { userId: user.id, balance } });
  await db.subscription.create({ data: { userId: user.id, planId: free.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) } });
  return user;
}

async function createVerifyingExperimentFixture() {
  const user = await createReadyUser(500);
  const brand = await createBrandForUser(user.id, {
    name: `验证配置品牌-${randomUUID()}`,
    website: "verification-config.example.cn",
    industry: "企业服务",
    product: "品牌监测软件",
    targetAudience: "品牌团队",
    aliases: [],
    competitors: [],
  });
  const originalVersionId = brand.prompts[0].versions[0].id;
  const updatedPrompt = await updatePromptForUser(user.id, brand.prompts[0].id, {
    text: "验证扫描必须固定使用的新版问题",
    active: true,
  });
  const promptVersionIds = brand.prompts.map((prompt, index) => (
    index === 0 ? updatedPrompt.versions[0].id : prompt.versions[0].id
  ));
  const baselineScan = await db.scan.create({
    data: {
      brandId: brand.id,
      status: "COMPLETED",
      providerIds: ["mock"],
      promptVersionIds,
      requestedCount: promptVersionIds.length * 2,
      repeatCount: 2,
      dataMode: "SIMULATED",
      completedAt: new Date(),
    },
  });
  const opportunity = await db.opportunity.create({
    data: {
      brandId: brand.id,
      scanId: baselineScan.id,
      promptVersionId: promptVersionIds[0],
      platformId: "mock",
      type: "MENTION_GAP",
      priority: 80,
      title: "验证配置机会",
      summary: "验证配置摘要",
      evidence: "验证配置证据",
      recommendedAction: "发布一篇完整的官网验证内容",
      targetContentType: "官网指南",
    },
  });
  const experiment = await db.optimizationExperiment.create({
    data: {
      brandId: brand.id,
      opportunityId: opportunity.id,
      baselineScanId: baselineScan.id,
      title: "验证配置实验",
      hypothesis: "验证扫描必须严格复用基线配置",
      actionPlan: "发布一篇完整的官网验证内容",
      status: "VERIFYING",
      actionRevision: 1,
      verificationLeaseToken: "verification-fixture-owner",
      verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
    },
  });
  return {
    user,
    brand,
    baselineScan,
    experiment,
    promptVersionIds,
    originalVersionId,
  };
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
      verificationLeaseToken: "draft-verification-owner",
    })).rejects.toThrow("验证实验执行权不匹配或已过期");

    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(50);
    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(1);
  });

  it.each([
    {
      label: "缺失 owner token 参数",
      databaseToken: "current-verification-owner",
      passedToken: undefined,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      label: "错误 owner token",
      databaseToken: "current-verification-owner",
      passedToken: "wrong-verification-owner",
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      label: "过期 owner token",
      databaseToken: "expired-verification-owner",
      passedToken: "expired-verification-owner",
      expiresAt: new Date(Date.now() - 60_000),
    },
  ])("实验 $label 时拒绝创建验证扫描且不扣费", async ({
    databaseToken,
    passedToken,
    expiresAt,
  }) => {
    const fixture = await createVerifyingExperimentFixture();
    await db.optimizationExperiment.update({
      where: { id: fixture.experiment.id },
      data: {
        verificationLeaseToken: databaseToken,
        verificationLeaseExpiresAt: expiresAt,
      },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;

    const options = {
      repeatCount: fixture.baselineScan.repeatCount,
      promptVersionIds: fixture.promptVersionIds,
      verificationExperimentId: fixture.experiment.id,
      verificationLeaseToken: passedToken,
      env: { AI_PROVIDER: "mock" },
    } as Parameters<typeof createScanForUser>[3] & {
      verificationLeaseToken?: string;
    };

    await expect(createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      options,
    )).rejects.toThrow("验证实验执行权不匹配或已过期");

    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore);
  });

  it("旧 owner A 在 B 接管后不能借用 B 的 lease 创建扫描或扣费", async () => {
    const fixture = await createVerifyingExperimentFixture();
    const tokenA = fixture.experiment.verificationLeaseToken!;
    await db.optimizationExperiment.update({
      where: { id: fixture.experiment.id },
      data: {
        verificationLeaseToken: "verification-owner-b",
        verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;

    await expect(createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: fixture.promptVersionIds,
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken: tokenA,
        env: { AI_PROVIDER: "mock" },
      } as Parameters<typeof createScanForUser>[3] & { verificationLeaseToken: string },
    )).rejects.toThrow("验证实验执行权不匹配或已过期");

    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore);
  });

  it("外层校验后 owner 被接管时事务内再次拒绝且不创建、不扣费", async () => {
    const fixture = await createVerifyingExperimentFixture();
    const tokenA = fixture.experiment.verificationLeaseToken!;
    const delegate = db.optimizationExperiment as unknown as {
      findFirst: (args: unknown) => Promise<unknown>;
    };
    const originalFindFirst = delegate.findFirst.bind(delegate);
    vi.spyOn(delegate, "findFirst").mockImplementationOnce(async (args) => {
      const staleOwner = await originalFindFirst(args);
      await db.optimizationExperiment.update({
        where: { id: fixture.experiment.id },
        data: {
          verificationLeaseToken: "verification-owner-b-after-read",
          verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
        },
      });
      return staleOwner;
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;

    await expect(createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: fixture.promptVersionIds,
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken: tokenA,
        env: { AI_PROVIDER: "mock" },
      } as Parameters<typeof createScanForUser>[3] & { verificationLeaseToken: string },
    )).rejects.toThrow("验证实验执行权不匹配或已过期");

    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore);
  });

  it("A/B 并发看到无候选时只有当前 owner B 能创建一条扫描并扣一次", async () => {
    const fixture = await createVerifyingExperimentFixture();
    const tokenA = fixture.experiment.verificationLeaseToken!;
    const tokenB = "concurrent-verification-owner-b";
    await db.optimizationExperiment.update({
      where: { id: fixture.experiment.id },
      data: {
        verificationLeaseToken: tokenB,
        verificationLeaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;
    const createWithToken = (verificationLeaseToken: string) => createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: fixture.promptVersionIds,
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken,
        env: { AI_PROVIDER: "mock" },
      } as Parameters<typeof createScanForUser>[3] & { verificationLeaseToken: string },
    );

    const results = await Promise.allSettled([
      createWithToken(tokenA),
      createWithToken(tokenB),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(2);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore - fixture.baselineScan.requestedCount);
    expect(await db.quotaLedger.count({
      where: {
        userId: fixture.user.id,
        referenceType: "SCAN",
        type: "CONSUME",
        referenceId: { not: fixture.baselineScan.id },
      },
    })).toBe(1);
  });

  it.each([
    "省略问题版本",
    "缺少基线版本",
    "增加同品牌版本",
    "替换为同品牌旧版本",
    "篡改平台",
    "篡改重复次数",
  ])("验证扫描%s时拒绝且不扣额度、不创建扫描", async (scenario) => {
    const fixture = await createVerifyingExperimentFixture();
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;
    const options: Parameters<typeof createScanForUser>[3] = {
      repeatCount: fixture.baselineScan.repeatCount,
      promptVersionIds: fixture.promptVersionIds,
      verificationExperimentId: fixture.experiment.id,
      verificationLeaseToken: fixture.experiment.verificationLeaseToken!,
    };
    let platformIds = fixture.baselineScan.providerIds as string[];

    if (scenario === "省略问题版本") delete options.promptVersionIds;
    if (scenario === "缺少基线版本") {
      options.promptVersionIds = fixture.promptVersionIds.slice(0, -1);
    }
    if (scenario === "增加同品牌版本") {
      options.promptVersionIds = [...fixture.promptVersionIds, fixture.originalVersionId];
    }
    if (scenario === "替换为同品牌旧版本") {
      options.promptVersionIds = [
        fixture.originalVersionId,
        ...fixture.promptVersionIds.slice(1),
      ];
    }
    if (scenario === "篡改平台") platformIds = ["deepseek"];
    if (scenario === "篡改重复次数") options.repeatCount = 1;

    await expect(createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      platformIds,
      {
        ...options,
        env: scenario === "篡改平台"
          ? { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "test-key" }
          : { AI_PROVIDER: "mock" },
      },
    )).rejects.toThrow("验证扫描必须完整复用基线配置");

    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore);
  });

  it("验证实验的基线扫描未完成时拒绝且不扣额度、不创建扫描", async () => {
    const fixture = await createVerifyingExperimentFixture();
    await db.scan.update({
      where: { id: fixture.baselineScan.id },
      data: { status: "PENDING", completedAt: null },
    });
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;

    await expect(createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: fixture.promptVersionIds,
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken: fixture.experiment.verificationLeaseToken!,
        env: { AI_PROVIDER: "mock" },
      },
    )).rejects.toThrow("验证实验的基线扫描必须已完成且属于当前品牌");

    expect(await db.scan.count({ where: { brandId: fixture.brand.id } })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore);
  });

  it("验证扫描参数与已完成基线完全一致时创建并按基线配置扣额度", async () => {
    const fixture = await createVerifyingExperimentFixture();
    const balanceBefore = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance;

    const verificationScan = await createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: [...fixture.promptVersionIds].reverse(),
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken: fixture.experiment.verificationLeaseToken!,
        env: { AI_PROVIDER: "mock" },
      },
    );

    expect(new Set(verificationScan.promptVersionIds as string[]))
      .toEqual(new Set(fixture.promptVersionIds));
    expect(verificationScan.providerIds).toEqual(fixture.baselineScan.providerIds);
    expect(verificationScan.repeatCount).toBe(fixture.baselineScan.repeatCount);
    expect(verificationScan.verificationExperimentId).toBe(fixture.experiment.id);
    expect(verificationScan.verificationActionRevision).toBe(1);
    expect(verificationScan.verificationAttemptToken).toBe("verification-fixture-owner");
    expect(verificationScan.requestedCount).toBe(fixture.baselineScan.requestedCount);
    expect((await db.quotaAccount.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })).balance).toBe(balanceBefore - fixture.baselineScan.requestedCount);
  });

  it("验证扫描心跳至少续期两分钟且不会缩短实验恢复窗口", async () => {
    const fixture = await createVerifyingExperimentFixture();
    const verificationScan = await createScanForUser(
      fixture.user.id,
      fixture.brand.id,
      fixture.baselineScan.providerIds as string[],
      {
        repeatCount: fixture.baselineScan.repeatCount,
        promptVersionIds: fixture.promptVersionIds,
        verificationExperimentId: fixture.experiment.id,
        verificationLeaseToken: fixture.experiment.verificationLeaseToken!,
        env: { AI_PROVIDER: "mock" },
      },
    );
    const beforeExecution = Date.now();

    await executeScanForUser(fixture.user.id, verificationScan.id);

    const experiment = await db.optimizationExperiment.findUniqueOrThrow({
      where: { id: fixture.experiment.id },
    });
    expect(experiment.verificationLeaseExpiresAt!.getTime())
      .toBeGreaterThanOrEqual(beforeExecution + 119_000);
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

  it("创建响应丢失式二次调用复用同一扫描、单流水且只扣一次", async () => {
    const user = await createReadyUser(100);
    const brand = await createBrandForUser(user.id, {
      name: `幂等创建品牌-${randomUUID()}`,
      website: "idempotent-create.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const creationKey = randomUUID();
    const options = {
      repeatCount: 1,
      env: { AI_PROVIDER: "mock" },
      creationKey,
    };

    const first = await createScanForUser(user.id, brand.id, ["mock"], options);
    const second = await createScanForUser(user.id, brand.id, ["mock"], options);

    expect(second.id).toBe(first.id);
    expect(await db.scan.count({ where: { brandId: brand.id, creationKey } })).toBe(1);
    expect(await db.quotaLedger.count({
      where: { referenceType: "SCAN", referenceId: first.id, type: "CONSUME" },
    })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(100 - first.requestedCount);
  });

  it("并发同 creationKey 由唯一约束收敛为一次扫描和一次扣费", async () => {
    const user = await createReadyUser(100);
    const brand = await createBrandForUser(user.id, {
      name: `并发幂等品牌-${randomUUID()}`,
      website: "concurrent-idempotent.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const creationKey = randomUUID();
    const create = () => createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount: 1,
      env: { AI_PROVIDER: "mock" },
      creationKey,
    });

    const [first, second] = await Promise.all([create(), create()]);

    expect(second.id).toBe(first.id);
    expect(await db.scan.count({ where: { brandId: brand.id, creationKey } })).toBe(1);
    expect(await db.quotaLedger.count({
      where: { referenceType: "SCAN", referenceId: first.id, type: "CONSUME" },
    })).toBe(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(100 - first.requestedCount);
  });

  it("同 creationKey 改变扫描配置时拒绝且不产生第二次副作用", async () => {
    const user = await createReadyUser(100);
    const brand = await createBrandForUser(user.id, {
      name: `幂等冲突品牌-${randomUUID()}`,
      website: "idempotent-conflict.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const creationKey = randomUUID();
    const first = await createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount: 1,
      env: { AI_PROVIDER: "mock" },
      creationKey,
    });
    const balanceAfterFirst = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const ledgerCountAfterFirst = await db.quotaLedger.count({ where: { userId: user.id } });

    await expect(createScanForUser(user.id, brand.id, ["mock"], {
      repeatCount: 2,
      env: { AI_PROVIDER: "mock" },
      creationKey,
    })).rejects.toThrow("幂等键已用于不同扫描配置");

    expect(await db.scan.count({ where: { brandId: brand.id, creationKey } })).toBe(1);
    expect(await db.quotaLedger.count({ where: { userId: user.id } })).toBe(ledgerCountAfterFirst);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceAfterFirst);
    expect(first.repeatCount).toBe(1);
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

  it("退款流水写入失败时失败状态与余额一起回滚，lease 过期后可再次结算", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: `退款原子性品牌-${randomUUID()}`,
      website: "atomic-refund.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    await db.scan.update({ where: { id: scan.id }, data: { providerIds: ["unknown"] } });
    const balanceAfterDebit = (await db.quotaAccount.findUniqueOrThrow({
      where: { userId: user.id },
    })).balance;
    const suffix = randomUUID().replaceAll("-", "");
    const functionName = `fail_refund_${suffix}`;
    const triggerName = `fail_refund_trigger_${suffix}`;
    const safeScanId = scan.id.replaceAll("'", "''");
    let functionCreated = false;
    let triggerCreated = false;

    try {
      await db.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW."referenceId" = '${safeScanId}' AND NEW."type" = 'REFUND' THEN
            RAISE EXCEPTION 'injected refund failure';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      functionCreated = true;
      await db.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "QuotaLedger"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
      `);
      triggerCreated = true;

      await expect(executeScanForUser(user.id, scan.id))
        .rejects.toThrow("injected refund failure");

      const rolledBack = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
      expect(rolledBack.status).toBe("RUNNING");
      expect(rolledBack.executionLeaseToken).not.toBeNull();
      expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
        .toBe(balanceAfterDebit);
      expect(await db.quotaLedger.count({
        where: { referenceId: scan.id, type: "REFUND" },
      })).toBe(0);
    } finally {
      if (triggerCreated) {
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "QuotaLedger"`);
      }
      if (functionCreated) {
        await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
      }
    }

    await db.scan.update({
      where: { id: scan.id },
      data: { executionLeaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow("未知 AI 平台");

    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status).toBe("FAILED");
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(30);
    expect(await db.quotaLedger.count({
      where: { referenceId: scan.id, type: "REFUND" },
    })).toBe(1);
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

  it.each([
    { label: "历史空 lease", token: null, expiresAt: null },
    {
      label: "过期 lease",
      token: "stale-scan-worker",
      expiresAt: new Date(Date.now() - 60_000),
    },
  ])("恢复 $label 的部分扫描且只补齐缺失逻辑槽位", async ({ token, expiresAt }) => {
    const user = await createReadyUser(50);
    const brand = await createBrandForUser(user.id, {
      name: `部分恢复品牌-${randomUUID()}`,
      website: "partial-resume.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const promptVersionIds = brand.prompts.slice(0, 2).map((prompt) => prompt.versions[0].id);
    const scan = await createScanForUser(user.id, brand.id, ["mock"], {
      promptVersionIds,
      env: { AI_PROVIDER: "mock" },
    });
    const persisted = await db.observation.create({
      data: {
        scanId: scan.id,
        promptVersionId: promptVersionIds[0],
        platformId: "mock",
        modelId: "crashed-worker-model",
        runIndex: 1,
        rawResponse: "崩溃前已经持久化的回答",
      },
    });
    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(Date.now() - 120_000),
        executionLeaseToken: token,
        executionLeaseExpiresAt: expiresAt,
      },
    });
    const balanceBeforeResume = (
      await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })
    ).balance;

    const completed = await executeScanForUser(user.id, scan.id);

    expect(completed.status).toBe("COMPLETED");
    expect(completed.observations).toHaveLength(2);
    expect(completed.observations.some((item) => item.id === persisted.id)).toBe(true);
    expect(new Set(completed.observations.map((item) => (
      `${item.promptVersionId}:${item.platformId}:${item.runIndex}`
    ))).size).toBe(2);
    expect(completed.scoreSnapshot).not.toBeNull();
    const stored = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(stored.executionLeaseToken).toBeNull();
    expect(stored.executionLeaseExpiresAt).toBeNull();
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceBeforeResume);
    expect(await db.quotaLedger.count({ where: { referenceId: scan.id, type: "REFUND" } }))
      .toBe(0);
  });

  it("活动中的扫描 lease 拒绝抢占且不改写任务", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: `活动租约品牌-${randomUUID()}`,
      website: "active-lease.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const promptVersionId = brand.prompts[0].versions[0].id;
    const scan = await createScanForUser(user.id, brand.id, ["mock"], {
      promptVersionIds: [promptVersionId],
      env: { AI_PROVIDER: "mock" },
    });
    const activeUntil = new Date(Date.now() + 60_000);
    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "RUNNING",
        executionLeaseToken: "active-worker",
        executionLeaseExpiresAt: activeUntil,
      },
    });

    await expect(executeScanForUser(user.id, scan.id)).rejects.toThrow("扫描正在执行");

    const unchanged = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(unchanged.status).toBe("RUNNING");
    expect(unchanged.executionLeaseToken).toBe("active-worker");
    expect(unchanged.executionLeaseExpiresAt).toEqual(activeUntil);
    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(0);
  });

  it("旧 worker 丢失 lease 后不能写回答、完结或退款", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "lease-test-key");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://lease-test.deepseek.invalid");
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: `旧 Worker 品牌-${randomUUID()}`,
      website: "old-worker.example.cn",
      industry: "企业服务",
      product: "监测软件",
      targetAudience: "品牌团队",
      aliases: [],
      competitors: [],
    });
    const promptVersionId = brand.prompts[0].versions[0].id;
    const scan = await createScanForUser(user.id, brand.id, ["deepseek"], {
      promptVersionIds: [promptVersionId],
      env: process.env,
    });
    const balanceAfterDebit = (
      await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })
    ).balance;
    let callCount = 0;
    let releaseFirst!: (response: Response) => void;
    let notifyFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => { notifyFirstStarted = resolve; });
    const deepSeekResponse = () => new Response(JSON.stringify({
      id: `request-${randomUUID()}`,
      model: "deepseek-chat",
      choices: [{ message: { content: "这是一条普通的真实平台测试回答。" } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        notifyFirstStarted();
        return new Promise<Response>((resolve) => { releaseFirst = resolve; });
      }
      return deepSeekResponse();
    }));

    const oldWorkerOutcome = executeScanForUser(user.id, scan.id)
      .then((value) => ({ value, error: null }))
      .catch((error: unknown) => ({ value: null, error }));
    await firstStarted;
    const firstClaim = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(firstClaim.executionLeaseToken).not.toBeNull();
    await db.scan.update({
      where: { id: scan.id },
      data: { executionLeaseExpiresAt: new Date(Date.now() - 1_000) },
    });

    const newWorkerOutcome = await executeScanForUser(user.id, scan.id)
      .then((value) => ({ value, error: null }))
      .catch((error: unknown) => ({ value: null, error }));
    releaseFirst(deepSeekResponse());
    const oldWorkerResult = await oldWorkerOutcome;

    expect(newWorkerOutcome.error).toBeNull();
    expect(newWorkerOutcome.value?.status).toBe("COMPLETED");
    expect(oldWorkerResult.value).toBeNull();
    expect(oldWorkerResult.error).toMatchObject({ message: "扫描执行权已转移" });
    expect(await db.observation.count({ where: { scanId: scan.id } })).toBe(1);
    expect((await db.scan.findUniqueOrThrow({ where: { id: scan.id } })).status)
      .toBe("COMPLETED");
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance)
      .toBe(balanceAfterDebit);
    expect(await db.quotaLedger.count({ where: { referenceId: scan.id, type: "REFUND" } }))
      .toBe(0);
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
