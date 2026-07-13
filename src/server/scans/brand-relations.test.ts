import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

const userIds: string[] = [];

afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

async function createBrandGraph() {
  const suffix = crypto.randomUUID();
  const user = await db.user.create({
    data: { name: "品牌关系测试", email: `brand-relations-${suffix}@test.local` },
  });
  userIds.push(user.id);
  const [brandA, brandB] = await Promise.all([
    db.brand.create({
      data: {
        ownerId: user.id,
        name: `品牌甲-${suffix}`,
        website: "brand-a.example.cn",
        industry: "企业服务",
        product: "测试产品甲",
        targetAudience: "品牌团队",
      },
    }),
    db.brand.create({
      data: {
        ownerId: user.id,
        name: `品牌乙-${suffix}`,
        website: "brand-b.example.cn",
        industry: "企业服务",
        product: "测试产品乙",
        targetAudience: "品牌团队",
      },
    }),
  ]);
  const [promptA, promptB] = await Promise.all([
    db.prompt.create({
      data: {
        brandId: brandA.id,
        category: "DISCOVERY",
        versions: { create: { version: 1, text: "品牌甲测试问题" } },
      },
      include: { versions: true },
    }),
    db.prompt.create({
      data: {
        brandId: brandB.id,
        category: "DISCOVERY",
        versions: { create: { version: 1, text: "品牌乙测试问题" } },
      },
      include: { versions: true },
    }),
  ]);
  const [scanA, scanB] = await Promise.all([
    db.scan.create({
      data: {
        brandId: brandA.id,
        providerIds: ["mock"],
        requestedCount: 1,
        dataMode: "SIMULATED",
      },
    }),
    db.scan.create({
      data: {
        brandId: brandB.id,
        providerIds: ["mock"],
        requestedCount: 1,
        dataMode: "SIMULATED",
      },
    }),
  ]);
  return {
    brandA,
    brandB,
    promptVersionA: promptA.versions[0],
    promptVersionB: promptB.versions[0],
    scanA,
    scanB,
  };
}

function opportunityData(
  brandId: string,
  scanId: string,
  promptVersionId: string,
) {
  return {
    brandId,
    scanId,
    promptVersionId,
    platformId: "mock",
    type: "MENTION_GAP" as const,
    priority: 80,
    title: "测试机会",
    summary: "测试摘要",
    evidence: "测试证据",
    recommendedAction: "测试动作",
    targetContentType: "官网内容",
  };
}

function experimentData(
  brandId: string,
  opportunityId: string,
  baselineScanId: string,
  followUpScanId?: string,
) {
  return {
    brandId,
    opportunityId,
    baselineScanId,
    followUpScanId,
    title: "测试实验",
    hypothesis: "测试假设",
    actionPlan: "测试计划",
  };
}

describe("扫描增长实体的品牌一致性约束", () => {
  it("拒绝把机会关联到其他品牌的扫描", async () => {
    const { brandB, promptVersionB, scanA } = await createBrandGraph();

    await expect(db.opportunity.create({
      data: opportunityData(brandB.id, scanA.id, promptVersionB.id),
    })).rejects.toThrow();
  });

  it("拒绝把机会关联到其他品牌的问题版本", async () => {
    const { brandA, promptVersionB, scanA } = await createBrandGraph();

    await expect(db.opportunity.create({
      data: opportunityData(brandA.id, scanA.id, promptVersionB.id),
    })).rejects.toThrow("OPPORTUNITY_PROMPT_VERSION_BRAND_MISMATCH");
  });

  it("拒绝把实验关联到其他品牌的机会", async () => {
    const { brandA, brandB, promptVersionA, scanA, scanB } = await createBrandGraph();
    const opportunity = await db.opportunity.create({
      data: opportunityData(brandA.id, scanA.id, promptVersionA.id),
    });

    await expect(db.optimizationExperiment.create({
      data: experimentData(brandB.id, opportunity.id, scanB.id),
    })).rejects.toThrow();
  });

  it("拒绝把实验基线关联到其他品牌的扫描", async () => {
    const { brandB, promptVersionB, scanA, scanB } = await createBrandGraph();
    const opportunity = await db.opportunity.create({
      data: opportunityData(brandB.id, scanB.id, promptVersionB.id),
    });

    await expect(db.optimizationExperiment.create({
      data: experimentData(brandB.id, opportunity.id, scanA.id),
    })).rejects.toThrow();
  });

  it("拒绝把实验复测关联到其他品牌的扫描", async () => {
    const { brandB, promptVersionB, scanA, scanB } = await createBrandGraph();
    const opportunity = await db.opportunity.create({
      data: opportunityData(brandB.id, scanB.id, promptVersionB.id),
    });

    await expect(db.optimizationExperiment.create({
      data: experimentData(brandB.id, opportunity.id, scanB.id, scanA.id),
    })).rejects.toThrow();
  });

  it("拒绝把验证扫描关联到其他品牌的实验", async () => {
    const { brandA, promptVersionA, scanA, scanB } = await createBrandGraph();
    const opportunity = await db.opportunity.create({
      data: opportunityData(brandA.id, scanA.id, promptVersionA.id),
    });
    const experiment = await db.optimizationExperiment.create({
      data: experimentData(brandA.id, opportunity.id, scanA.id),
    });

    await expect(db.scan.update({
      where: { id: scanB.id },
      data: { verificationExperimentId: experiment.id },
    })).rejects.toThrow();
  });

  it("拒绝把风险发现关联到其他品牌的扫描", async () => {
    const { brandB, scanA } = await createBrandGraph();

    await expect(db.riskFinding.create({
      data: {
        brandId: brandB.id,
        scanId: scanA.id,
        level: "WARNING",
        title: "测试风险",
        description: "测试描述",
        evidence: "测试证据",
      },
    })).rejects.toThrow();
  });

  it("拒绝把建议关联到其他品牌的扫描", async () => {
    const { brandB, scanA } = await createBrandGraph();

    await expect(db.recommendation.create({
      data: {
        brandId: brandB.id,
        scanId: scanA.id,
        title: "测试建议",
        finding: "测试发现",
        action: "测试动作",
        evidence: "测试证据",
        impact: 80,
        confidence: 80,
        effort: 50,
      },
    })).rejects.toThrow();
  });

  it("允许风险发现和建议不关联扫描", async () => {
    const { brandA } = await createBrandGraph();
    const [riskFinding, recommendation] = await Promise.all([
      db.riskFinding.create({
        data: {
          brandId: brandA.id,
          level: "INFO",
          title: "无扫描风险",
          description: "测试可空扫描关系",
          evidence: "测试证据",
        },
      }),
      db.recommendation.create({
        data: {
          brandId: brandA.id,
          title: "无扫描建议",
          finding: "测试发现",
          action: "测试动作",
          evidence: "测试证据",
          impact: 50,
          confidence: 50,
          effort: 50,
        },
      }),
    ]);

    expect(riskFinding.scanId).toBeNull();
    expect(recommendation.scanId).toBeNull();
  });
});
