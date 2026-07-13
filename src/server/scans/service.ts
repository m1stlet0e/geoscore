import { randomUUID } from "node:crypto";
import { calculateComponents, calculateConfidence, calculateGeoScore, SCORING_VERSION, type ParsedObservation } from "@/domain/scoring/calculate";
import { buildOpportunities, type OpportunitySample } from "@/domain/opportunities/build-opportunities";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getAiProvider, listAiProviders, type AiProviderEnvironment } from "@/server/ai";
import type { AiAnswer } from "@/server/ai/types";

const SCAN_EXECUTION_LEASE_MS = 60_000;
const EXPERIMENT_VERIFICATION_LEASE_HEARTBEAT_MS = 120_000;

class ScanLeaseLostError extends Error {
  constructor() {
    super("扫描执行权已转移");
    this.name = "ScanLeaseLostError";
  }
}

export type CreateScanOptions = {
  repeatCount?: number;
  env?: AiProviderEnvironment;
  promptVersionIds?: string[];
  verificationExperimentId?: string;
  /** 仅供实验验证服务内部传递，HTTP 扫描接口不得接收。 */
  verificationLeaseToken?: string;
};

export type RepeatConsistencySample = {
  promptVersionId: string;
  platformId: string;
  targetMentioned: boolean;
};

export type ScanExecutionConfig = {
  promptVersionIds: string[];
  providerIds: string[];
  repeatCount: number;
};

type VerificationBaselineConfig = ScanExecutionConfig & {
  baselineScanId: string;
  actionRevision: number;
  verificationAttemptToken: string;
};

type LockedVerificationBaselineRow = {
  baselineScanId: string;
  baselineStatus: string;
  providerIds: unknown;
  promptVersionIds: unknown;
  repeatCount: number;
};

type ScanLeaseContext = {
  scanId: string;
  executionLeaseToken: string;
  verificationExperimentId: string | null;
  verificationAttemptToken: string | null;
};

function asUniqueStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => (
    typeof item === "string" && item.length > 0
  )))];
}

function hasSameStringSet(left: string[], right: string[]) {
  return left.length === right.length
    && left.every((item) => right.includes(item));
}

export function scanExecutionConfigMatches(
  scan: { promptVersionIds: unknown; providerIds: unknown; repeatCount: number },
  expected: ScanExecutionConfig,
) {
  return scan.repeatCount === expected.repeatCount
    && hasSameStringSet(asUniqueStringArray(scan.promptVersionIds), expected.promptVersionIds)
    && hasSameStringSet(asUniqueStringArray(scan.providerIds), expected.providerIds);
}

async function loadVerificationBaselineConfig(
  verificationExperimentId: string,
  brandId: string,
  verificationLeaseToken: string,
): Promise<VerificationBaselineConfig> {
  const now = new Date();
  const verificationExperiment = await db.optimizationExperiment.findFirst({
    where: {
      id: verificationExperimentId,
      brandId,
      status: "VERIFYING",
      verificationLeaseToken,
      verificationLeaseExpiresAt: { gt: now },
    },
    select: {
      actionRevision: true,
      baselineScan: {
        select: {
          id: true,
          brandId: true,
          status: true,
          promptVersionIds: true,
          providerIds: true,
          repeatCount: true,
        },
      },
    },
  });
  if (!verificationExperiment) throw new Error("验证实验执行权不匹配或已过期");
  if (
    verificationExperiment.baselineScan.brandId !== brandId
    || verificationExperiment.baselineScan.status !== "COMPLETED"
  ) {
    throw new Error("验证实验的基线扫描必须已完成且属于当前品牌");
  }

  let promptVersionIds = asUniqueStringArray(
    verificationExperiment.baselineScan.promptVersionIds,
  );
  if (!promptVersionIds.length) {
    const historicalObservations = await db.observation.findMany({
      where: { scanId: verificationExperiment.baselineScan.id },
      select: { promptVersionId: true },
      orderBy: { createdAt: "asc" },
    });
    promptVersionIds = [...new Set(
      historicalObservations.map((item) => item.promptVersionId),
    )];
  }
  if (!promptVersionIds.length) throw new Error("基线扫描缺少固定问题版本");
  const providerIds = asUniqueStringArray(verificationExperiment.baselineScan.providerIds);
  if (!providerIds.length) throw new Error("基线扫描缺少 AI 平台");

  return {
    baselineScanId: verificationExperiment.baselineScan.id,
    promptVersionIds,
    providerIds,
    repeatCount: verificationExperiment.baselineScan.repeatCount,
    actionRevision: verificationExperiment.actionRevision,
    verificationAttemptToken: verificationLeaseToken,
  };
}

async function lockVerificationScanCreation(
  tx: Prisma.TransactionClient,
  verificationExperimentId: string,
  brandId: string,
  verificationLeaseToken: string,
  expected: VerificationBaselineConfig,
) {
  const now = new Date();
  const rows = await tx.$queryRaw<LockedVerificationBaselineRow[]>`
    SELECT
      baseline."id" AS "baselineScanId",
      baseline."status"::text AS "baselineStatus",
      baseline."providerIds" AS "providerIds",
      baseline."promptVersionIds" AS "promptVersionIds",
      baseline."repeatCount" AS "repeatCount"
    FROM "OptimizationExperiment" AS experiment
    JOIN "Scan" AS baseline
      ON baseline."id" = experiment."baselineScanId"
      AND baseline."brandId" = experiment."brandId"
    WHERE experiment."id" = ${verificationExperimentId}
      AND experiment."brandId" = ${brandId}
      AND experiment."status" = 'VERIFYING'
      AND experiment."verificationLeaseToken" = ${verificationLeaseToken}
      AND experiment."verificationLeaseExpiresAt" > ${now}
      AND experiment."actionRevision" = ${expected.actionRevision}
      AND experiment."baselineScanId" = ${expected.baselineScanId}
    FOR UPDATE OF experiment, baseline
  `;
  const baseline = rows[0];
  if (!baseline) throw new Error("验证实验执行权不匹配或已过期");
  if (baseline.baselineStatus !== "COMPLETED") {
    throw new Error("验证实验的基线扫描必须已完成且属于当前品牌");
  }

  let promptVersionIds = asUniqueStringArray(baseline.promptVersionIds);
  if (!promptVersionIds.length) {
    const historicalObservations = await tx.observation.findMany({
      where: { scanId: baseline.baselineScanId },
      select: { promptVersionId: true },
      orderBy: { createdAt: "asc" },
    });
    promptVersionIds = [...new Set(
      historicalObservations.map((item) => item.promptVersionId),
    )];
  }
  if (!scanExecutionConfigMatches(
    {
      promptVersionIds,
      providerIds: baseline.providerIds,
      repeatCount: baseline.repeatCount,
    },
    expected,
  )) {
    throw new Error("验证扫描必须完整复用基线配置");
  }
}

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
  if (
    (options.verificationExperimentId && !options.verificationLeaseToken)
    || (!options.verificationExperimentId && options.verificationLeaseToken)
  ) {
    throw new Error("验证实验执行权不匹配或已过期");
  }
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
    include: {
      prompts: {
        where: { active: true },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
    },
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
  const verificationBaselineConfig = options.verificationExperimentId
    ? await loadVerificationBaselineConfig(
      options.verificationExperimentId,
      brandId,
      options.verificationLeaseToken as string,
    )
    : null;
  if (verificationBaselineConfig && options.promptVersionIds === undefined) {
    throw new Error("验证扫描必须完整复用基线配置");
  }
  const promptVersionIds = options.promptVersionIds === undefined
    ? brand.prompts.flatMap((prompt) => prompt.versions[0]?.id ?? [])
    : [...new Set(options.promptVersionIds.map((id) => id.trim()).filter(Boolean))];
  if (!promptVersionIds.length) throw new Error("固定问题版本不能为空");
  if (options.promptVersionIds !== undefined) {
    const ownedVersionCount = await db.promptVersion.count({
      where: {
        id: { in: promptVersionIds },
        prompt: { brandId },
      },
    });
    if (ownedVersionCount !== promptVersionIds.length) {
      throw new Error("固定问题版本不属于当前品牌");
    }
  }
  if (verificationBaselineConfig && !scanExecutionConfigMatches(
    { promptVersionIds, providerIds: platformIds, repeatCount },
    verificationBaselineConfig,
  )) {
    throw new Error("验证扫描必须完整复用基线配置");
  }
  const requestedCount = promptVersionIds.length * platformIds.length * repeatCount;
  if (!requestedCount) throw new Error("品牌没有可扫描的问题");

  return db.$transaction(async (tx) => {
    if (
      verificationBaselineConfig
      && options.verificationExperimentId
      && options.verificationLeaseToken
    ) {
      await lockVerificationScanCreation(
        tx,
        options.verificationExperimentId,
        brandId,
        options.verificationLeaseToken,
        verificationBaselineConfig,
      );
    }
    const quota = await tx.quotaAccount.findUnique({ where: { userId } });
    if (!quota || quota.balance < requestedCount) throw new Error(`额度不足，本次需要 ${requestedCount} 次`);
    const scan = await tx.scan.create({
      data: {
        brandId,
        providerIds: platformIds,
        promptVersionIds,
        requestedCount,
        repeatCount,
        dataMode,
        verificationExperimentId: options.verificationExperimentId,
        verificationActionRevision: verificationBaselineConfig?.actionRevision,
        verificationAttemptToken: verificationBaselineConfig?.verificationAttemptToken,
      },
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

function nextScanLeaseExpiry() {
  return new Date(Date.now() + SCAN_EXECUTION_LEASE_MS);
}

async function assertAndExtendScanLease(
  tx: Prisma.TransactionClient,
  lease: ScanLeaseContext,
) {
  const expiresAt = nextScanLeaseExpiry();
  const scanHeartbeat = await tx.scan.updateMany({
    where: {
      id: lease.scanId,
      status: "RUNNING",
      executionLeaseToken: lease.executionLeaseToken,
    },
    data: { executionLeaseExpiresAt: expiresAt },
  });
  if (scanHeartbeat.count !== 1) throw new ScanLeaseLostError();

  if (lease.verificationExperimentId && lease.verificationAttemptToken) {
    const verificationLeaseExpiresAt = new Date(
      Date.now() + EXPERIMENT_VERIFICATION_LEASE_HEARTBEAT_MS,
    );
    const experimentHeartbeat = await tx.optimizationExperiment.updateMany({
      where: {
        id: lease.verificationExperimentId,
        status: "VERIFYING",
        verificationLeaseToken: lease.verificationAttemptToken,
      },
      data: { verificationLeaseExpiresAt },
    });
    if (experimentHeartbeat.count !== 1) throw new ScanLeaseLostError();
  }
}

async function heartbeatScanLease(lease: ScanLeaseContext) {
  await db.$transaction((tx) => assertAndExtendScanLease(tx, lease));
}

function logicalObservationKey(
  promptVersionId: string,
  platformId: string,
  runIndex: number,
) {
  return `${promptVersionId}\u0000${platformId}\u0000${runIndex}`;
}

async function persistObservationWithLease(
  lease: ScanLeaseContext,
  input: {
    promptVersionId: string;
    platformId: string;
    runIndex: number;
    answer: AiAnswer;
  },
) {
  await db.$transaction(async (tx) => {
    await assertAndExtendScanLease(tx, lease);
    const existing = await tx.observation.findFirst({
      where: {
        scanId: lease.scanId,
        promptVersionId: input.promptVersionId,
        platformId: input.platformId,
        runIndex: input.runIndex,
      },
      select: { id: true },
    });
    if (existing) return;
    await tx.observation.create({
      data: {
        scanId: lease.scanId,
        promptVersionId: input.promptVersionId,
        platformId: input.platformId,
        modelId: input.answer.modelId,
        requestId: input.answer.requestId,
        rawResponse: input.answer.rawResponse,
        latencyMs: input.answer.latencyMs,
        runIndex: input.runIndex,
        mentions: { create: input.answer.mentions },
        citations: { create: input.answer.citations },
      },
    });
  });
}

export async function executeScanForUser(userId: string, scanId: string) {
  const initialScan = await db.scan.findFirst({
    where: { id: scanId, brand: { ownerId: userId } },
    include: {
      brand: {
        include: {
          aliases: true,
          competitors: true,
        },
      },
      verificationExperiment: { include: { opportunity: true } },
      observations: true,
      scoreSnapshot: true,
    },
  });
  if (!initialScan) throw new Error("扫描任务不存在");
  if (initialScan.status === "COMPLETED") return initialScan;
  if (initialScan.status === "FAILED") throw new Error("扫描已失败，请重新创建");

  const executionLeaseToken = randomUUID();
  const claimTime = new Date();
  const claimed = await db.scan.updateMany({
    where: {
      id: initialScan.id,
      OR: [
        { status: "PENDING" },
        {
          status: "RUNNING",
          OR: [
            { executionLeaseExpiresAt: null },
            { executionLeaseExpiresAt: { lte: claimTime } },
          ],
        },
      ],
    },
    data: {
      status: "RUNNING",
      executionLeaseToken,
      executionLeaseExpiresAt: nextScanLeaseExpiry(),
      startedAt: initialScan.startedAt ?? claimTime,
      errorMessage: null,
      completedAt: null,
    },
  });
  if (claimed.count !== 1) throw new Error("扫描正在执行");

  const scan = await db.scan.findUniqueOrThrow({
    where: { id: initialScan.id },
    include: {
      brand: {
        include: {
          aliases: true,
          competitors: true,
        },
      },
      verificationExperiment: { include: { opportunity: true } },
    },
  });
  const lease: ScanLeaseContext = {
    scanId: scan.id,
    executionLeaseToken,
    verificationExperimentId: scan.verificationExperimentId,
    verificationAttemptToken: scan.verificationAttemptToken,
  };
  const platformIds = asUniqueStringArray(scan.providerIds);

  try {
    const pinnedIds = Array.isArray(scan.promptVersionIds)
      ? scan.promptVersionIds.filter((id): id is string => typeof id === "string")
      : [];
    const promptVersions = pinnedIds.length
      ? await db.promptVersion.findMany({
        where: { id: { in: pinnedIds }, prompt: { brandId: scan.brandId } },
        include: { prompt: { select: { category: true } } },
      }).then((versions) => {
        const byId = new Map(versions.map((version) => [version.id, version]));
        return pinnedIds.flatMap((id) => byId.get(id) ?? []);
      })
      : await db.prompt.findMany({
        where: { brandId: scan.brandId, active: true },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      }).then((prompts) => prompts.flatMap((prompt) => prompt.versions.map((version) => ({
        ...version,
        prompt: { category: prompt.category },
      }))));
    if (pinnedIds.length && promptVersions.length !== pinnedIds.length) {
      throw new Error("扫描固定的问题版本已失效");
    }
    if (!promptVersions.length) throw new Error("品牌没有可扫描的问题");

    const persistedObservations = await db.observation.findMany({
      where: { scanId: scan.id },
      select: {
        promptVersionId: true,
        platformId: true,
        runIndex: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const persistedLogicalSlots = new Set(persistedObservations.map((observation) => (
      logicalObservationKey(
        observation.promptVersionId,
        observation.platformId,
        observation.runIndex,
      )
    )));

    for (const version of promptVersions) {
      for (const platformId of platformIds) {
        const provider = getAiProvider(platformId);
        for (let runIndex = 1; runIndex <= scan.repeatCount; runIndex += 1) {
          const logicalSlot = logicalObservationKey(version.id, platformId, runIndex);
          if (persistedLogicalSlots.has(logicalSlot)) continue;
          await heartbeatScanLease(lease);
          const answer = await provider.query({
            prompt: version.text,
            brand: { name: scan.brand.name, website: scan.brand.website, aliases: scan.brand.aliases.map((item) => item.value) },
            competitors: scan.brand.competitors.map((item) => item.name),
            simulationContext: scan.dataMode === "SIMULATED"
              && scan.verificationExperiment?.opportunity.promptVersionId === version.id
              ? {
                optimizationApplied: true,
                targetUrl: scan.verificationExperiment.targetUrl ?? undefined,
              }
              : undefined,
          });
          await heartbeatScanLease(lease);
          if (answer.platformId !== platformId) {
            throw new Error(`AI 平台返回标识不一致：预期 ${platformId}，实际 ${answer.platformId}`);
          }
          await persistObservationWithLease(lease, {
            promptVersionId: version.id,
            platformId,
            runIndex,
            answer,
          });
          persistedLogicalSlots.add(logicalSlot);
        }
      }
    }

    await heartbeatScanLease(lease);
    const allPersistedObservations = await db.observation.findMany({
      where: { scanId: scan.id },
      include: { mentions: true, citations: true },
      orderBy: { createdAt: "asc" },
    });
    const observationByLogicalSlot = new Map<string, typeof allPersistedObservations[number]>();
    for (const observation of allPersistedObservations) {
      const key = logicalObservationKey(
        observation.promptVersionId,
        observation.platformId,
        observation.runIndex,
      );
      if (!observationByLogicalSlot.has(key)) observationByLogicalSlot.set(key, observation);
    }
    const expectedObservations = promptVersions.flatMap((version) => (
      platformIds.flatMap((platformId) => (
        Array.from({ length: scan.repeatCount }, (_, index) => {
          const runIndex = index + 1;
          const observation = observationByLogicalSlot.get(
            logicalObservationKey(version.id, platformId, runIndex),
          );
          if (!observation) throw new Error("扫描仍有未完成的采样槽位");
          return { observation, version, platformId };
        })
      ))
    ));
    const scoring: ParsedObservation[] = [];
    const repeatSignals: RepeatConsistencySample[] = [];
    const opportunitySamples: OpportunitySample[] = [];
    for (const { observation, version, platformId } of expectedObservations) {
      const target = observation.mentions.find((item) => item.isTarget);
      const competitorMentions = observation.mentions.filter((item) => !item.isTarget);
      const officialCitation = observation.citations.find((item) => item.isOfficial);
      scoring.push({
        weight: version.weight,
        platformId,
        targetMentioned: Boolean(target),
        recommendationStrength: target?.recommendationStrength ?? 0,
        position: target?.position,
        competitorMentions: competitorMentions.length,
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
        promptCategory: version.prompt.category,
        promptWeight: version.weight,
        platformId,
        rawResponse: observation.rawResponse,
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
      await assertAndExtendScanLease(tx, lease);
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
        where: {
          id: scan.id,
          status: "RUNNING",
          executionLeaseToken,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          executionLeaseToken: null,
          executionLeaseExpiresAt: null,
          errorMessage: null,
        },
      });
      if (completed.count !== 1) throw new ScanLeaseLostError();
    });
  } catch (error) {
    if (error instanceof ScanLeaseLostError) throw error;
    const message = error instanceof Error ? error.message : "扫描执行失败";
    const failed = await db.scan.updateMany({
      where: {
        id: scan.id,
        status: "RUNNING",
        executionLeaseToken,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
        executionLeaseToken: null,
        executionLeaseExpiresAt: null,
      },
    });
    if (failed.count === 1) {
      await refundFailedScan(userId, scan.id, scan.requestedCount);
    }
    throw error;
  }

  return db.scan.findUniqueOrThrow({
    where: { id: scan.id },
    include: { observations: { include: { mentions: true, citations: true } }, scoreSnapshot: true },
  });
}
