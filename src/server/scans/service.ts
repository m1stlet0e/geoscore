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
    const updated = await tx.quotaAccount.update({ where: { userId }, data: { balance: { decrement: requestedCount } } });
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
    const total = calculateGeoScore({ ...components, confidenceScore: confidence.score, hasCriticalRisk: false });
    await db.scoreSnapshot.create({
      data: {
        scanId: scan.id, brandId: scan.brandId, algorithmVersion: SCORING_VERSION, score: total.score,
        ...components, confidenceScore: confidence.score, isProvisional: confidence.isProvisional, riskLevel: total.riskLevel,
      },
    });
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
