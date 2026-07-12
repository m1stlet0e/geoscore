import { calculateComponents, calculateConfidence, calculateGeoScore, SCORING_VERSION, type ParsedObservation } from "@/domain/scoring/calculate";
import { db } from "@/lib/db";
import { getAiProvider } from "@/server/ai";

export async function createScanForUser(userId: string, brandId: string, platformIds: string[]) {
  const brand = await db.brand.findFirst({
    where: { id: brandId, ownerId: userId },
    include: { prompts: { where: { active: true } } },
  });
  if (!brand) throw new Error("品牌不存在");
  if (!platformIds.length) throw new Error("至少选择一个 AI 平台");
  platformIds.forEach((id) => getAiProvider(id));
  const requestedCount = brand.prompts.length * platformIds.length;
  if (!requestedCount) throw new Error("品牌没有可扫描的问题");

  return db.$transaction(async (tx) => {
    const quota = await tx.quotaAccount.findUnique({ where: { userId } });
    if (!quota || quota.balance < requestedCount) throw new Error(`额度不足，本次需要 ${requestedCount} 次`);
    const scan = await tx.scan.create({ data: { brandId, providerIds: platformIds, requestedCount } });
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
  if (scan.status === "RUNNING") throw new Error("扫描正在执行");
  const platformIds = scan.providerIds as string[];
  await db.scan.update({ where: { id: scan.id }, data: { status: "RUNNING", startedAt: new Date(), errorMessage: null } });

  const scoring: ParsedObservation[] = [];
  const criticalEvidence: string[] = [];
  try {
    for (const prompt of scan.brand.prompts) {
      const version = prompt.versions[0];
      if (!version) continue;
      for (const platformId of platformIds) {
        const provider = getAiProvider(platformId);
        const answer = await provider.query({
          prompt: version.text,
          brand: { name: scan.brand.name, website: scan.brand.website, aliases: scan.brand.aliases.map((item) => item.value) },
          competitors: scan.brand.competitors.map((item) => item.name),
        });
        const target = answer.mentions.find((item) => item.isTarget);
        const officialCitation = answer.citations.find((item) => item.isOfficial);
        if (/已倒闭|停止运营|诈骗|违法|被查处/.test(answer.rawResponse)) criticalEvidence.push(answer.rawResponse);
        await db.observation.create({
          data: {
            scanId: scan.id, promptVersionId: version.id, platformId: answer.platformId, modelId: answer.modelId,
            requestId: answer.requestId, rawResponse: answer.rawResponse, latencyMs: answer.latencyMs, runIndex: 1,
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
      }
    }
    const components = calculateComponents(scoring);
    const confidence = calculateConfidence({ sampleCount: scoring.length, platformCount: new Set(scoring.map((item) => item.platformId)).size, repeatConsistency: 1 });
    const total = calculateGeoScore({ ...components, confidenceScore: confidence.score, hasCriticalRisk: criticalEvidence.length > 0 });
    await db.scoreSnapshot.create({
      data: {
        scanId: scan.id, brandId: scan.brandId, algorithmVersion: SCORING_VERSION, score: total.score,
        ...components, confidenceScore: confidence.score, isProvisional: confidence.isProvisional, riskLevel: total.riskLevel,
      },
    });
    if (criticalEvidence.length) {
      await db.riskFinding.create({
        data: {
          brandId: scan.brandId, level: "CRITICAL", title: "AI 回答包含高风险品牌描述",
          description: "监测回答中出现倒闭、违法或诈骗等可能严重影响品牌信任的描述，请尽快核查事实并处理信息源。",
          evidence: criticalEvidence.slice(0, 3).join("\n\n"),
        },
      });
    }
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
    await db.recommendation.createMany({ data: recommendations.map((item) => ({
      brandId: scan.brandId, title: item.title, finding: item.finding, action: item.action,
      evidence: item.evidence, impact: item.impact, confidence: item.confidence, effort: item.effort,
    })) });
    await db.scan.update({ where: { id: scan.id }, data: { status: "COMPLETED", completedAt: new Date() } });
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
