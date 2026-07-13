import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { calculateExperimentResult } from "@/domain/experiments/calculate-experiment-result";
import { SCORING_VERSION } from "@/domain/scoring/calculate";
import {
  createScanForUser,
  executeScanForUser,
  scanExecutionConfigMatches,
} from "@/server/scans/service";

const EXPERIMENT_VERIFICATION_LEASE_MS = 120_000;

class ExperimentLeaseLostError extends Error {
  constructor() {
    super("实验验证执行权已转移");
    this.name = "ExperimentLeaseLostError";
  }
}

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
    let currentExperiment = experiment;
    if (experiment.status === "DRAFT") {
      const publishedAt = new Date();
      const activated = await tx.optimizationExperiment.updateMany({
        where: { id: experiment.id, status: "DRAFT" },
        data: {
          status: "ACTIVE",
          actionPlan,
          ...targetUrlData,
          actionRevision: 1,
          publishedAt,
          nextCheckAt: new Date(publishedAt.getTime() + 7 * 86_400_000),
        },
      });
      if (activated.count === 1) {
        return tx.optimizationExperiment.findUniqueOrThrow({
          where: { id: experiment.id },
        });
      }
      currentExperiment = await tx.optimizationExperiment.findUniqueOrThrow({
        where: { id: experiment.id },
      });
    }
    if (currentExperiment.status !== "ACTIVE") {
      throw new ExperimentServiceError("当前实验状态不能发布", "CONFLICT");
    }

    const effectiveTargetUrl = targetUrl === undefined
      ? currentExperiment.targetUrl
      : targetUrl;
    if (
      currentExperiment.actionPlan === actionPlan
      && currentExperiment.targetUrl === effectiveTargetUrl
    ) {
      return tx.optimizationExperiment.findUniqueOrThrow({
        where: { id: currentExperiment.id },
      });
    }

    const updated = await tx.optimizationExperiment.updateMany({
      where: {
        id: currentExperiment.id,
        status: "ACTIVE",
        actionRevision: currentExperiment.actionRevision,
      },
      data: {
        actionPlan,
        ...targetUrlData,
        actionRevision: { increment: 1 },
        nextCheckAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    if (updated.count !== 1) {
      const concurrentCurrent = await tx.optimizationExperiment.findUniqueOrThrow({
        where: { id: currentExperiment.id },
      });
      if (
        concurrentCurrent.status === "ACTIVE"
        && concurrentCurrent.actionPlan === actionPlan
        && concurrentCurrent.targetUrl === effectiveTargetUrl
      ) {
        return concurrentCurrent;
      }
      throw new ExperimentServiceError("当前实验状态不能发布", "CONFLICT");
    }
    return tx.optimizationExperiment.findUniqueOrThrow({
      where: { id: currentExperiment.id },
    });
  });
}

function nextExperimentLeaseExpiry() {
  return new Date(Date.now() + EXPERIMENT_VERIFICATION_LEASE_MS);
}

async function heartbeatExperimentLease(experimentId: string, leaseToken: string) {
  const heartbeat = await db.optimizationExperiment.updateMany({
    where: {
      id: experimentId,
      status: "VERIFYING",
      verificationLeaseToken: leaseToken,
    },
    data: { verificationLeaseExpiresAt: nextExperimentLeaseExpiry() },
  });
  if (heartbeat.count !== 1) throw new ExperimentLeaseLostError();
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
  const initialExperiment = await db.optimizationExperiment.findFirst({
    where: { id: experimentId, brand: { ownerId: userId } },
    include: {
      opportunity: true,
      baselineScan: { include: { scoreSnapshot: true } },
    },
  });
  if (!initialExperiment) {
    throw new ExperimentServiceError("行动实验不存在", "NOT_FOUND");
  }
  if (
    initialExperiment.status === "VERIFIED"
    || initialExperiment.status === "INCONCLUSIVE"
  ) {
    return initialExperiment;
  }
  if (initialExperiment.status === "DRAFT") {
    throw new ExperimentServiceError("实验尚未发布，不能复扫", "CONFLICT");
  }
  if (
    initialExperiment.status !== "ACTIVE"
    && initialExperiment.status !== "VERIFYING"
  ) {
    throw new ExperimentServiceError("当前实验状态不能复扫", "CONFLICT");
  }

  const claimTime = new Date();
  const initialLeaseIsActive = initialExperiment.status === "VERIFYING"
    && Boolean(initialExperiment.verificationLeaseToken)
    && Boolean(initialExperiment.verificationLeaseExpiresAt)
    && initialExperiment.verificationLeaseExpiresAt! > claimTime;
  if (initialLeaseIsActive) {
    throw new ExperimentServiceError("实验正在复扫验证", "CONFLICT");
  }
  if (
    initialExperiment.status === "ACTIVE"
    && initialExperiment.baselineScan.dataMode === "REAL"
    && initialExperiment.nextCheckAt
    && initialExperiment.nextCheckAt > claimTime
  ) {
    throw new ExperimentServiceError("真实数据实验尚未到复查时间", "CONFLICT");
  }
  if (!initialExperiment.baselineScan.scoreSnapshot) {
    throw new ExperimentServiceError("基线扫描缺少评分快照", "CONFLICT");
  }
  if (
    initialExperiment.baselineScan.scoreSnapshot.algorithmVersion
    !== SCORING_VERSION
  ) {
    if (initialExperiment.status === "VERIFYING") {
      await db.optimizationExperiment.updateMany({
        where: {
          id: initialExperiment.id,
          status: "VERIFYING",
          OR: [
            { verificationLeaseToken: null },
            { verificationLeaseExpiresAt: null },
            { verificationLeaseExpiresAt: { lte: claimTime } },
          ],
        },
        data: {
          status: "ACTIVE",
          verificationLeaseToken: null,
          verificationLeaseExpiresAt: null,
        },
      });
    }
    throw new ExperimentServiceError(
      "基线评分算法版本已过期，请重新扫描后再创建实验",
      "CONFLICT",
    );
  }

  const verificationLeaseToken = randomUUID();
  const initialActionRevision = initialExperiment.actionRevision;
  const claimedFromActive = initialExperiment.status === "ACTIVE";
  const claimData = {
    status: "VERIFYING" as const,
    verificationLeaseToken,
    verificationLeaseExpiresAt: nextExperimentLeaseExpiry(),
  };
  const claimed = claimedFromActive
    ? await db.optimizationExperiment.updateMany({
        where: {
          id: initialExperiment.id,
          status: "ACTIVE",
          actionRevision: initialActionRevision,
          ...(initialExperiment.baselineScan.dataMode === "REAL"
            ? {
                OR: [
                  { nextCheckAt: null },
                  { nextCheckAt: { lte: claimTime } },
                ],
              }
            : {}),
        },
        data: claimData,
      })
    : await db.optimizationExperiment.updateMany({
        where: {
          id: initialExperiment.id,
          status: "VERIFYING",
          actionRevision: initialActionRevision,
          OR: [
            { verificationLeaseToken: null },
            { verificationLeaseExpiresAt: null },
            { verificationLeaseExpiresAt: { lte: claimTime } },
          ],
        },
        data: claimData,
      });
  if (claimed.count !== 1) {
    const current = await db.optimizationExperiment.findFirst({
      where: { id: initialExperiment.id, brand: { ownerId: userId } },
    });
    if (current?.status === "VERIFIED" || current?.status === "INCONCLUSIVE") {
      return current;
    }
    if (
      current
      && (
        current.actionRevision !== initialActionRevision
        || (
          claimedFromActive
          && initialExperiment.baselineScan.dataMode === "REAL"
          && current.status === "ACTIVE"
          && current.nextCheckAt
          && current.nextCheckAt > new Date()
        )
      )
    ) {
      throw new ExperimentServiceError(
        "实验动作或复查时间已变化，请重新发起验证",
        "CONFLICT",
      );
    }
    throw new ExperimentServiceError("实验正在复扫验证", "CONFLICT");
  }

  try {
    const experiment = await db.optimizationExperiment.findUniqueOrThrow({
      where: { id: initialExperiment.id },
      include: {
        opportunity: true,
        baselineScan: { include: { scoreSnapshot: true } },
      },
    });
    if (
      experiment.verificationLeaseToken !== verificationLeaseToken
      || experiment.status !== "VERIFYING"
    ) {
      throw new ExperimentLeaseLostError();
    }
    if (
      experiment.actionRevision !== initialActionRevision
      || (
        claimedFromActive
        && experiment.baselineScan.dataMode === "REAL"
        && experiment.nextCheckAt
        && experiment.nextCheckAt > new Date()
      )
    ) {
      throw new ExperimentServiceError(
        "实验动作或复查时间已变化，请重新发起验证",
        "CONFLICT",
      );
    }
    if (
      !experiment.baselineScan.scoreSnapshot
      || experiment.baselineScan.scoreSnapshot.algorithmVersion !== SCORING_VERSION
    ) {
      throw new ExperimentServiceError(
        "基线评分算法版本已过期，请重新扫描后再创建实验",
        "CONFLICT",
      );
    }

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

    const verificationScans = await db.scan.findMany({
      where: {
        brandId: experiment.brandId,
        verificationExperimentId: experiment.id,
        status: { in: ["PENDING", "RUNNING", "COMPLETED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { scoreSnapshot: true },
    });
    const statusPriority = {
      COMPLETED: 0,
      RUNNING: 1,
      PENDING: 2,
      FAILED: 3,
    } as const;
    const candidate = verificationScans
      .filter((scan) => (
        scan.verificationActionRevision === experiment.actionRevision
        && scanExecutionConfigMatches(scan, {
          promptVersionIds,
          providerIds,
          repeatCount: experiment.baselineScan.repeatCount,
        })
        && (
          scan.status !== "COMPLETED"
          || scan.scoreSnapshot?.algorithmVersion === SCORING_VERSION
        )
      ))
      .sort((left, right) => statusPriority[left.status] - statusPriority[right.status])[0];

    let followUpScanId: string | null = null;
    if (candidate) {
      const rebound = await db.scan.updateMany({
        where: {
          id: candidate.id,
          brandId: experiment.brandId,
          verificationExperimentId: experiment.id,
          verificationActionRevision: experiment.actionRevision,
          status: { in: ["PENDING", "RUNNING", "COMPLETED"] },
        },
        data: { verificationAttemptToken: verificationLeaseToken },
      });
      if (rebound.count === 1) {
        const reboundCandidate = await db.scan.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (reboundCandidate.status === "COMPLETED") {
          followUpScanId = reboundCandidate.id;
        } else {
          const completed = await executeScanForUser(userId, reboundCandidate.id);
          followUpScanId = completed.id;
        }
      }
    }

    if (!followUpScanId) {
      const verificationScan = await createScanForUser(
        userId,
        experiment.brandId,
        providerIds,
        {
          repeatCount: experiment.baselineScan.repeatCount,
          promptVersionIds,
          verificationExperimentId: experiment.id,
          verificationLeaseToken,
        },
      );
      const completed = await executeScanForUser(userId, verificationScan.id);
      followUpScanId = completed.id;
    }

    await heartbeatExperimentLease(experiment.id, verificationLeaseToken);
    const [baselineSnapshot, followUpScan] = await Promise.all([
      db.scoreSnapshot.findUnique({ where: { scanId: experiment.baselineScanId } }),
      db.scan.findUniqueOrThrow({
        where: { id: followUpScanId },
        include: { scoreSnapshot: true },
      }),
    ]);
    if (!baselineSnapshot || !followUpScan.scoreSnapshot) {
      throw new ExperimentServiceError("扫描缺少可比的评分快照", "CONFLICT");
    }
    if (
      baselineSnapshot.algorithmVersion !== SCORING_VERSION
      || followUpScan.scoreSnapshot.algorithmVersion !== SCORING_VERSION
      || baselineSnapshot.algorithmVersion !== followUpScan.scoreSnapshot.algorithmVersion
    ) {
      throw new ExperimentServiceError("扫描评分算法版本不一致，无法归因", "CONFLICT");
    }
    if (
      followUpScan.status !== "COMPLETED"
      || followUpScan.verificationExperimentId !== experiment.id
      || followUpScan.verificationActionRevision !== experiment.actionRevision
      || !scanExecutionConfigMatches(followUpScan, {
        promptVersionIds,
        providerIds,
        repeatCount: experiment.baselineScan.repeatCount,
      })
    ) {
      throw new ExperimentServiceError("验证扫描与当前实验动作不一致", "CONFLICT");
    }

    const targetRiskWhere = {
      promptVersionId: experiment.opportunity.promptVersionId,
      platformId: experiment.opportunity.platformId,
      type: "BRAND_RISK" as const,
    };
    const [baselineMetrics, followUpMetrics, baselineRiskCount, followUpRiskCount] = await Promise.all([
      calculateObservationMetrics(
        experiment.baselineScanId,
        experiment.opportunity.promptVersionId,
        experiment.opportunity.platformId,
      ),
      calculateObservationMetrics(
        followUpScanId,
        experiment.opportunity.promptVersionId,
        experiment.opportunity.platformId,
      ),
      db.opportunity.count({
        where: { scanId: experiment.baselineScanId, ...targetRiskWhere },
      }),
      db.opportunity.count({
        where: { scanId: followUpScanId, ...targetRiskWhere },
      }),
    ]);
    const result = calculateExperimentResult({
      baseline: {
        overallScore: baselineSnapshot.score,
        ...baselineMetrics,
        baselineRisk: baselineRiskCount > 0,
      },
      followUp: {
        overallScore: followUpScan.scoreSnapshot.score,
        ...followUpMetrics,
        followUpRisk: followUpRiskCount > 0,
      },
      riskResolutionEligible: experiment.opportunity.type === "BRAND_RISK",
    });
    const status = result.verified ? "VERIFIED" : "INCONCLUSIVE";

    await db.$transaction(async (tx) => {
      const linkedScan = await tx.scan.updateMany({
        where: {
          id: followUpScanId,
          brandId: experiment.brandId,
          status: "COMPLETED",
          verificationExperimentId: experiment.id,
          verificationActionRevision: experiment.actionRevision,
        },
        data: { verificationAttemptToken: verificationLeaseToken },
      });
      if (linkedScan.count !== 1) {
        throw new ExperimentServiceError("验证扫描关联失败", "CONFLICT");
      }
      const finalized = await tx.optimizationExperiment.updateMany({
        where: {
          id: experiment.id,
          status: "VERIFYING",
          actionRevision: experiment.actionRevision,
          verificationLeaseToken,
        },
        data: {
          followUpScanId,
          status,
          verificationLeaseToken: null,
          verificationLeaseExpiresAt: null,
          resultSummary: result.summary,
          scoreDelta: result.scoreDelta,
          mentionDelta: result.mentionDelta,
          recommendationDelta: result.recommendationDelta,
          citationDelta: result.citationDelta,
        },
      });
      if (finalized.count !== 1) {
        throw new ExperimentLeaseLostError();
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
      where: {
        id: initialExperiment.id,
        status: "VERIFYING",
        verificationLeaseToken,
      },
      data: {
        status: "ACTIVE",
        verificationLeaseToken: null,
        verificationLeaseExpiresAt: null,
      },
    });
    const message = error instanceof Error ? error.message : "实验复扫失败";
    if (message.includes("额度不足")) {
      throw new ExperimentServiceError(message, "PAYMENT_REQUIRED");
    }
    throw error;
  }
}
