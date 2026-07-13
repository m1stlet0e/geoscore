import { calculateComponents, calculateConfidence, calculateGeoScore, SCORING_VERSION, type ParsedObservation } from "@/domain/scoring/calculate";
import { buildOpportunities, type OpportunitySample } from "@/domain/opportunities/build-opportunities";
import { db } from "@/lib/db";
import { getAiProvider, listAiProviders, type AiProviderEnvironment } from "@/server/ai";

export type CreateScanOptions = {
  repeatCount?: number;
  env?: AiProviderEnvironment;
};

export type RepeatConsistencySample = {
  promptVersionId: string;
  platformId: string;
  targetMentioned: boolean;
};

export function calculateRepeatConsistency(samples: RepeatConsistencySample[]) {
  if (!samples.length) return 0;
  const groups = new Map<string, boolean[]>();
  for (const sample of samples) {
    const key = `${sample.promptVersionId}\u0000${sample.platformId}`;
    const outcomes = groups.get(key) ?? [];
    outcomes.push(sample.targetMentioned);
    groups.set(key, outcomes);
  }
  const consistencyTotal = [...groups.values()].reduce((sum, outcomes) => {
    if (outcomes.length < 2) return sum;
    const mentionedCount = outcomes.filter(Boolean).length;
    return sum + Math.max(mentionedCount, outcomes.length - mentionedCount) / outcomes.length;
  }, 0);
  return Math.min(1, Math.max(0, consistencyTotal / groups.size));
}

export async function createScanForUser(
  userId: string,
  brandId: string,
  platformIds: string[],
  options: CreateScanOptions = {},
) {
  const repeatCount = options.repeatCount ?? 1;
  if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > 3) {
    throw new Error("重复采样次数必须是 1 到 3 之间的整数");
  }
  if (new Set(platformIds).size !== platformIds.length) {
    throw new Error("AI 平台不能重复选择");
  }
  const env = options.env ?? process.env;
  const brand = await db.brand.findFirst({
    where: { id: brandId, ownerId: userId },
    include: { prompts: { where: { active: true } } },
  });
  if (!brand) throw new Error("品牌不存在");
  if (!platformIds.length) throw new Error("至少选择一个 AI 平台");
  const registrations = new Map(
    listAiProviders(env).map((provider) => [provider.id, provider] as const),
  );
  const dataModes = new Set(platformIds.map((id) => {
    getAiProvider(id, env);
    return registrations.get(id)!.dataMode;
  }));
  if (dataModes.size > 1) throw new Error("一次扫描不能混合真实与模拟 AI 平台");
  const dataMode = [...dataModes][0];
  const requestedCount = brand.prompts.length * platformIds.length * repeatCount;
  if (!requestedCount) throw new Error("品牌没有可扫描的问题");

  return db.$transaction(async (tx) => {
    const quota = await tx.quotaAccount.findUnique({ where: { userId } });
    if (!quota || quota.balance < requestedCount) throw new Error(`额度不足，本次需要 ${requestedCount} 次`);
    const scan = await tx.scan.create({
      data: { brandId, providerIds: platformIds, requestedCount, repeatCount, dataMode },
    });
    const debited = await tx.quotaAccount.updateMany({
      where: { userId, balance: { gte: requestedCount } },
      data: { balance: { decrement: requestedCount } },
    });
    if (debited.count !== 1) throw new Error(`额度不足，本次需要 ${requestedCount} 次`);
    const updated = await tx.quotaAccount.findUniqueOrThrow({ where: { userId } });
    await tx.quotaLedger.create({
      data: {
        userId, type: "CONSUME", amount: -requestedCount, balanceAfter: updated.balance,
        referenceType: "SCAN", referenceId: scan.id, idempotencyKey: `scan:${scan.id}:consume`,
      },
    });
    return scan;
  });
}

async function refundFailedScan(userId: string, scanId: string, amount: number) {
  await db.$transaction(async (tx) => {
    const existing = await tx.quotaLedger.findUnique({ where: { idempotencyKey: `scan:${scanId}:refund` } });
    if (existing) return;
    const updated = await tx.quotaAccount.update({ where: { userId }, data: { balance: { increment: amount } } });
    await tx.quotaLedger.create({
      data: { userId, type: "REFUND", amount, balanceAfter: updated.balance, referenceType: "SCAN", referenceId: scanId, idempotencyKey: `scan:${scanId}:refund` },
    });
  });
}

export async function executeScanForUser(userId: string, scanId: string) {
  const scan = await db.scan.findFirst({
    where: { id: scanId, brand: { ownerId: userId } },
    include: {
      brand: {
        include: {
          aliases: true, competitors: true,
          prompts: { where: { active: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
        },
      },
      observations: true,
      scoreSnapshot: true,
    },
  });
  if (!scan) throw new Error("扫描任务不存在");
  if (scan.status === "COMPLETED") return scan;
  if (scan.status === "FAILED") throw new Error("扫描已失败，请重新创建");
  if (scan.status === "RUNNING") throw new Error("扫描正在执行");
  const platformIds = scan.providerIds as string[];
  const claimed = await db.scan.updateMany({
    where: { id: scan.id, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
  });
  if (claimed.count !== 1) throw new Error("扫描正在执行");

  const scoring: ParsedObservation[] = [];
  const repeatSignals: RepeatConsistencySample[] = [];
  const opportunitySamples: OpportunitySample[] = [];
  try {
    for (const prompt of scan.brand.prompts) {
      const version = prompt.versions[0];
      if (!version) continue;
      for (const platformId of platformIds) {
        const provider = getAiProvider(platformId);
        for (let runIndex = 1; runIndex <= scan.repeatCount; runIndex += 1) {
          const answer = await provider.query({
            prompt: version.text,
            brand: { name: scan.brand.name, website: scan.brand.website, aliases: scan.brand.aliases.map((item) => item.value) },
            competitors: scan.brand.competitors.map((item) => item.name),
          });
          const target = answer.mentions.find((item) => item.isTarget);
          const competitorMentions = answer.mentions.filter((item) => !item.isTarget);
          const officialCitation = answer.citations.find((item) => item.isOfficial);
          await db.observation.create({
            data: {
              scanId: scan.id, promptVersionId: version.id, platformId: answer.platformId, modelId: answer.modelId,
              requestId: answer.requestId, rawResponse: answer.rawResponse, latencyMs: answer.latencyMs, runIndex,
              mentions: { create: answer.mentions }, citations: { create: answer.citations },
            },
          });
          scoring.push({
            weight: version.weight, platformId, targetMentioned: Boolean(target),
            recommendationStrength: target?.recommendationStrength ?? 0, position: target?.position,
            competitorMentions: answer.mentions.filter((item) => !item.isTarget).length,
            trackedCompetitorCount: scan.brand.competitors.length,
            targetCitationQuality: officialCitation?.sourceQuality ?? null,
            sentiment: target?.sentiment ?? null,
          });
          repeatSignals.push({
            promptVersionId: version.id,
            platformId,
            targetMentioned: Boolean(target),
          });
          opportunitySamples.push({
            brandName: scan.brand.name,
            promptVersionId: version.id,
            promptText: version.text,
            promptCategory: prompt.category,
            promptWeight: version.weight,
            platformId: answer.platformId,
            rawResponse: answer.rawResponse,
            targetMentioned: Boolean(target),
            targetPosition: target?.position ?? null,
            targetRecommendationStrength: target?.recommendationStrength ?? 0,
            competitorNames: competitorMentions.map((item) => item.brandName),
            competitorPositions: competitorMentions.map((item) => item.position),
            competitorRecommendationStrengths: competitorMentions.map(
              (item) => item.recommendationStrength,
            ),
            hasOfficialCitation: Boolean(officialCitation),
          });
        }
      }
    }
    const opportunities = buildOpportunities(opportunitySamples);
    const riskOpportunities = opportunities.filter(
      (opportunity) => opportunity.type === "BRAND_RISK",
    );
    const components = calculateComponents(scoring);
    const confidence = calculateConfidence({
      sampleCount: scoring.length,
      platformCount: new Set(scoring.map((item) => item.platformId)).size,
      repeatConsistency: calculateRepeatConsistency(repeatSignals),
    });
    const total = calculateGeoScore({
      ...components,
      confidenceScore: confidence.score,
      hasCriticalRisk: riskOpportunities.length > 0,
    });
    const recommendations = [
      {
        score: components.mentionScore, title: "补齐未覆盖的高价值问题",
        finding: `当前品牌提及度为 ${components.mentionScore.toFixed(0)} 分，部分用户问题中尚未稳定出现品牌。`,
        action: "围绕未提及品牌的问题，新增能直接回答用户决策疑问的官网专题页，并清晰写明适用对象、核心能力与使用场景。",
        evidence: `本次共分析 ${scoring.length} 条回答，品牌提及度 ${components.mentionScore.toFixed(0)} 分。`, impact: 90, confidence: 88, effort: 55,
      },
      {
        score: components.citationScore, title: "加强官网内容的可引用性",
        finding: `当前内容引用度为 ${components.citationScore.toFixed(0)} 分，AI 对品牌官方信息的引用仍有提升空间。`,
        action: "为产品能力、价格、案例和常见问题提供独立、结构清晰且可公开访问的页面，并补充更新时间与可信来源。",
        evidence: `本次扫描的内容引用度为 ${components.citationScore.toFixed(0)} 分。`, impact: 85, confidence: 84, effort: 60,
      },
      {
        score: components.recommendationScore, title: "强化产品选择证据",
        finding: `当前品牌推荐度为 ${components.recommendationScore.toFixed(0)} 分，AI 的推荐强度还有提升空间。`,
        action: "补充可验证的客户案例、量化效果、适用边界和竞品差异，帮助 AI 在推荐时形成明确依据。",
        evidence: `本次扫描的品牌推荐度为 ${components.recommendationScore.toFixed(0)} 分。`, impact: 88, confidence: 82, effort: 65,
      },
    ].sort((left, right) => left.score - right.score).slice(0, 3);
    await db.$transaction(async (tx) => {
      await tx.scoreSnapshot.create({
        data: {
          scanId: scan.id, brandId: scan.brandId, algorithmVersion: SCORING_VERSION, score: total.score,
          ...components, confidenceScore: confidence.score, isProvisional: confidence.isProvisional, riskLevel: total.riskLevel,
        },
      });
      if (riskOpportunities.length) {
        await tx.riskFinding.create({
          data: {
            brandId: scan.brandId, scanId: scan.id, level: "CRITICAL", title: "AI 回答包含高风险品牌描述",
            description: "监测回答中出现倒闭、违法或诈骗等可能严重影响品牌信任的描述，请尽快核查事实并处理信息源。",
            evidence: riskOpportunities.slice(0, 3).map((opportunity) => opportunity.evidence).join("\n\n"),
          },
        });
      }
      if (opportunities.length) {
        await tx.opportunity.createMany({
          data: opportunities.map((opportunity) => ({
            brandId: scan.brandId,
            scanId: scan.id,
            ...opportunity,
          })),
        });
      }
      await tx.recommendation.createMany({ data: recommendations.map((item) => ({
        brandId: scan.brandId, scanId: scan.id, title: item.title, finding: item.finding, action: item.action,
        evidence: item.evidence, impact: item.impact, confidence: item.confidence, effort: item.effort,
      })) });
      const completed = await tx.scan.updateMany({
        where: { id: scan.id, status: "RUNNING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (completed.count !== 1) throw new Error("扫描状态已变化，无法提交结果");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "扫描执行失败";
    await db.scan.update({ where: { id: scan.id }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
    await refundFailedScan(userId, scan.id, scan.requestedCount);
    throw error;
  }

  return db.scan.findUniqueOrThrow({
    where: { id: scan.id },
    include: { observations: { include: { mentions: true, citations: true } }, scoreSnapshot: true },
  });
}
