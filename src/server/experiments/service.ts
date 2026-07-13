import { db } from "@/lib/db";
import { calculateExperimentResult } from "@/domain/experiments/calculate-experiment-result";
import { createScanForUser, executeScanForUser } from "@/server/scans/service";

export type ExperimentServiceErrorCode =
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "PAYMENT_REQUIRED";

export class ExperimentServiceError extends Error {
  constructor(
    message: string,
    readonly code: ExperimentServiceErrorCode,
  ) {
    super(message);
    this.name = "ExperimentServiceError";
  }
}

export async function createExperimentForUser(
  userId: string,
  opportunityId: string,
) {
  const opportunity = await db.opportunity.findFirst({
    where: { id: opportunityId, brand: { ownerId: userId } },
    include: {
      scan: { select: { id: true, status: true } },
      optimizationExperiment: true,
    },
  });
  if (!opportunity) {
    throw new ExperimentServiceError("抢位机会不存在", "NOT_FOUND");
  }
  if (opportunity.optimizationExperiment) {
    return opportunity.optimizationExperiment;
  }
  if (opportunity.scan.status !== "COMPLETED") {
    throw new ExperimentServiceError("机会基线扫描尚未完成", "CONFLICT");
  }
  if (opportunity.status !== "OPEN") {
    throw new ExperimentServiceError("当前机会状态不能创建实验", "CONFLICT");
  }

  try {
    return await db.$transaction(async (tx) => {
      const claimed = await tx.opportunity.updateMany({
        where: { id: opportunity.id, status: "OPEN" },
        data: { status: "IN_PROGRESS" },
      });
      if (claimed.count !== 1) {
        const existing = await tx.optimizationExperiment.findUnique({
          where: { opportunityId: opportunity.id },
        });
        if (existing) return existing;
        throw new ExperimentServiceError("当前机会状态不能创建实验", "CONFLICT");
      }

      return tx.optimizationExperiment.create({
        data: {
          brandId: opportunity.brandId,
          opportunityId: opportunity.id,
          baselineScanId: opportunity.scanId,
          title: `抢位实验：${opportunity.title}`,
          hypothesis: `若执行机会建议，可改善“${opportunity.summary}”对应的 AI 推荐表现。`,
          actionPlan: opportunity.recommendedAction,
          status: "DRAFT",
        },
      });
    });
  } catch (error) {
    const existing = await db.optimizationExperiment.findFirst({
      where: {
        opportunityId: opportunity.id,
        brand: { ownerId: userId },
      },
    });
    if (existing) return existing;
    throw error;
  }
}

export type PublishExperimentInput = {
  actionPlan: string;
  targetUrl?: string;
};

function normalizeTargetUrl(value: string | undefined) {
  if (value === undefined) return undefined;
  const raw = value.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ExperimentServiceError("目标网址格式不正确", "INVALID_INPUT");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExperimentServiceError("目标网址只支持 HTTP 或 HTTPS", "INVALID_INPUT");
  }
  return url.toString().replace(/\/$/, "");
}

export async function publishExperimentForUser(
  userId: string,
  experimentId: string,
  input: PublishExperimentInput,
) {
  const experiment = await db.optimizationExperiment.findFirst({
    where: { id: experimentId, brand: { ownerId: userId } },
  });
  if (!experiment) {
    throw new ExperimentServiceError("行动实验不存在", "NOT_FOUND");
  }
  if (experiment.status !== "DRAFT" && experiment.status !== "ACTIVE") {
    throw new ExperimentServiceError("当前实验状态不能发布", "CONFLICT");
  }
  const actionPlan = input.actionPlan.trim();
  if (actionPlan.length < 10) {
    throw new ExperimentServiceError("行动计划至少需要 10 个字符", "INVALID_INPUT");
  }
  const targetUrl = normalizeTargetUrl(input.targetUrl);
  const targetUrlData = targetUrl === undefined ? {} : { targetUrl };

  return db.$transaction(async (tx) => {
    if (experiment.status === "DRAFT") {
      const publishedAt = new Date();
      const activated = await tx.optimizationExperiment.updateMany({
        where: { id: experiment.id, status: "DRAFT" },
        data: {
          status: "ACTIVE",
          actionPlan,
          ...targetUrlData,
          publishedAt,
          nextCheckAt: new Date(publishedAt.getTime() + 7 * 86_400_000),
        },
      });
      if (activated.count === 1) {
        return tx.optimizationExperiment.findUniqueOrThrow({
          where: { id: experiment.id },
        });
      }
    }

    const updated = await tx.optimizationExperiment.updateMany({
      where: { id: experiment.id, status: "ACTIVE" },
      data: { actionPlan, ...targetUrlData },
    });
    if (updated.count !== 1) {
      throw new ExperimentServiceError("当前实验状态不能发布", "CONFLICT");
    }
    return tx.optimizationExperiment.findUniqueOrThrow({
      where: { id: experiment.id },
    });
  });
}

function asUniqueStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => (
    typeof item === "string" && item.length > 0
  )))];
}

async function calculateObservationMetrics(
  scanId: string,
  promptVersionId: string,
  platformId: string,
) {
  const observations = await db.observation.findMany({
    where: { scanId, promptVersionId, platformId },
    include: {
      mentions: { where: { isTarget: true } },
      citations: { where: { isOfficial: true } },
    },
  });
  if (!observations.length) {
    throw new ExperimentServiceError("缺少可比的实验观察数据", "CONFLICT");
  }
  return {
    mentionRate: observations.filter((item) => item.mentions.length > 0).length
      / observations.length * 100,
    recommendationScore: observations.reduce(
      (sum, item) => sum + (item.mentions[0]?.recommendationStrength ?? 0),
      0,
    ) / observations.length * 100,
    citationRate: observations.filter((item) => item.citations.length > 0).length
      / observations.length * 100,
  };
}

export async function verifyExperimentForUser(
  userId: string,
  experimentId: string,
) {
  const experiment = await db.optimizationExperiment.findFirst({
    where: { id: experimentId, brand: { ownerId: userId } },
    include: {
      opportunity: true,
      baselineScan: { include: { scoreSnapshot: true } },
    },
  });
  if (!experiment) {
    throw new ExperimentServiceError("行动实验不存在", "NOT_FOUND");
  }
  if (experiment.status === "VERIFIED" || experiment.status === "INCONCLUSIVE") {
    return experiment;
  }
  if (experiment.status === "VERIFYING") {
    throw new ExperimentServiceError("实验正在复扫验证", "CONFLICT");
  }
  if (experiment.status === "DRAFT") {
    throw new ExperimentServiceError("实验尚未发布，不能复扫", "CONFLICT");
  }
  if (experiment.status !== "ACTIVE") {
    throw new ExperimentServiceError("当前实验状态不能复扫", "CONFLICT");
  }

  const claimed = await db.optimizationExperiment.updateMany({
    where: { id: experiment.id, status: "ACTIVE" },
    data: { status: "VERIFYING" },
  });
  if (claimed.count !== 1) {
    const current = await db.optimizationExperiment.findFirst({
      where: { id: experiment.id, brand: { ownerId: userId } },
    });
    if (current?.status === "VERIFIED" || current?.status === "INCONCLUSIVE") {
      return current;
    }
    throw new ExperimentServiceError("实验正在复扫验证", "CONFLICT");
  }

  try {
    let promptVersionIds = asUniqueStringArray(experiment.baselineScan.promptVersionIds);
    if (!promptVersionIds.length) {
      const historicalObservations = await db.observation.findMany({
        where: { scanId: experiment.baselineScanId },
        select: { promptVersionId: true },
        orderBy: { createdAt: "asc" },
      });
      promptVersionIds = [...new Set(
        historicalObservations.map((item) => item.promptVersionId),
      )];
    }
    if (!promptVersionIds.length) {
      throw new ExperimentServiceError("基线扫描缺少固定问题版本", "CONFLICT");
    }
    const providerIds = asUniqueStringArray(experiment.baselineScan.providerIds);
    if (!providerIds.length) {
      throw new ExperimentServiceError("基线扫描缺少 AI 平台", "CONFLICT");
    }

    let followUpScan = await db.scan.findFirst({
      where: {
        brandId: experiment.brandId,
        verificationExperimentId: experiment.id,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      include: { scoreSnapshot: true },
    });
    if (!followUpScan) {
      const verificationScan = await createScanForUser(
        userId,
        experiment.brandId,
        providerIds,
        {
          repeatCount: experiment.baselineScan.repeatCount,
          promptVersionIds,
          verificationExperimentId: experiment.id,
        },
      );
      followUpScan = await executeScanForUser(userId, verificationScan.id);
    }
    if (!experiment.baselineScan.scoreSnapshot || !followUpScan.scoreSnapshot) {
      throw new ExperimentServiceError("扫描缺少可比的评分快照", "CONFLICT");
    }

    const [baselineMetrics, followUpMetrics, baselineRiskCount, followUpRiskCount] = await Promise.all([
      calculateObservationMetrics(
        experiment.baselineScanId,
        experiment.opportunity.promptVersionId,
        experiment.opportunity.platformId,
      ),
      calculateObservationMetrics(
        followUpScan.id,
        experiment.opportunity.promptVersionId,
        experiment.opportunity.platformId,
      ),
      db.riskFinding.count({ where: { scanId: experiment.baselineScanId } }),
      db.riskFinding.count({ where: { scanId: followUpScan.id } }),
    ]);
    const result = calculateExperimentResult({
      baseline: {
        overallScore: experiment.baselineScan.scoreSnapshot.score,
        ...baselineMetrics,
        baselineRisk: baselineRiskCount > 0,
      },
      followUp: {
        overallScore: followUpScan.scoreSnapshot.score,
        ...followUpMetrics,
        followUpRisk: followUpRiskCount > 0,
      },
    });
    const status = result.verified ? "VERIFIED" : "INCONCLUSIVE";

    await db.$transaction(async (tx) => {
      const linkedScan = await tx.scan.updateMany({
        where: { id: followUpScan.id, brandId: experiment.brandId },
        data: { verificationExperimentId: experiment.id },
      });
      if (linkedScan.count !== 1) {
        throw new ExperimentServiceError("验证扫描关联失败", "CONFLICT");
      }
      const finalized = await tx.optimizationExperiment.updateMany({
        where: { id: experiment.id, status: "VERIFYING" },
        data: {
          followUpScanId: followUpScan.id,
          status,
          resultSummary: result.summary,
          scoreDelta: result.scoreDelta,
          mentionDelta: result.mentionDelta,
          recommendationDelta: result.recommendationDelta,
          citationDelta: result.citationDelta,
        },
      });
      if (finalized.count !== 1) {
        throw new ExperimentServiceError("实验状态已变化，无法提交验证结果", "CONFLICT");
      }
      await tx.opportunity.updateMany({
        where: { id: experiment.opportunityId, brandId: experiment.brandId },
        data: { status: result.verified ? "COMPLETED" : "IN_PROGRESS" },
      });
    });

    return db.optimizationExperiment.findUniqueOrThrow({
      where: { id: experiment.id },
    });
  } catch (error) {
    await db.optimizationExperiment.updateMany({
      where: { id: experiment.id, status: "VERIFYING" },
      data: { status: "ACTIVE" },
    });
    const message = error instanceof Error ? error.message : "实验复扫失败";
    if (message.includes("额度不足")) {
      throw new ExperimentServiceError(message, "PAYMENT_REQUIRED");
    }
    throw error;
  }
}
