import { buildActionAlerts, buildRankMatrix, buildSentimentSnapshot, groupCitationSources } from "@/lib/intelligence";
import { db } from "@/lib/db";

function latestByBrand<T extends { brandId: string; completedAt: Date | null }>(items: T[]) {
  const latest = new Map<string, T>();
  for (const item of items) {
    const current = latest.get(item.brandId);
    if (!current || (item.completedAt?.getTime() ?? 0) > (current.completedAt?.getTime() ?? 0)) {
      latest.set(item.brandId, item);
    }
  }
  return [...latest.values()];
}

export async function loadIntelligenceOverviewForUser(userId: string) {
  const scans = await db.scan.findMany({
    where: { status: "COMPLETED", brand: { ownerId: userId } },
    orderBy: { completedAt: "desc" },
    include: { brand: { select: { id: true, name: true } }, scoreSnapshot: true },
  });
  const latestScans = latestByBrand(scans);
  const latestScanIds = latestScans.map((scan) => scan.id);
  const [risks, opportunities, experiments, brandCount, quota] = await Promise.all([
    db.riskFinding.findMany({
      where: { brand: { ownerId: userId }, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    db.opportunity.findMany({
      where: {
        scanId: { in: latestScanIds },
        status: { in: ["OPEN", "IN_PROGRESS"] },
        brand: { ownerId: userId },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.optimizationExperiment.count({
      where: { brand: { ownerId: userId }, status: { in: ["ACTIVE", "VERIFYING"] } },
    }),
    db.brand.count({ where: { ownerId: userId } }),
    db.quotaAccount.findUnique({ where: { userId } }),
  ]);
  const alerts = buildActionAlerts({ risks, opportunities });
  const scored = latestScans.filter((scan) => scan.scoreSnapshot !== null);
  const averageScore = scored.length
    ? scored.reduce((sum, scan) => sum + (scan.scoreSnapshot?.score ?? 0), 0) / scored.length
    : null;
  return {
    latestScans,
    alerts,
    summary: {
      brandCount,
      quotaBalance: quota?.balance ?? 0,
      averageScore,
      activeExperiments: experiments,
      p0Count: alerts.filter((alert) => alert.priority === "P0").length,
      p1Count: alerts.filter((alert) => alert.priority === "P1").length,
      p2Count: alerts.filter((alert) => alert.priority === "P2").length,
    },
  };
}

export async function loadRankingsForUser(userId: string) {
  const scans = await db.scan.findMany({
    where: { status: "COMPLETED", brand: { ownerId: userId } },
    orderBy: { completedAt: "desc" },
    include: { brand: { select: { id: true, name: true } } },
  });
  const latestScans = latestByBrand(scans);
  const observations = await db.observation.findMany({
    where: { scanId: { in: latestScans.map((scan) => scan.id) } },
    include: { promptVersion: true, mentions: true, scan: { select: { brandId: true } } },
  });
  return latestScans.map((scan) => ({
    brand: scan.brand,
    scan,
    rows: buildRankMatrix(observations
      .filter((observation) => observation.scan.brandId === scan.brandId)
      .map((observation) => ({
        prompt: observation.promptVersion.text,
        platformId: observation.platformId,
        mentions: observation.mentions.map((mention) => ({
          isTarget: mention.isTarget,
          position: mention.position,
          brandName: mention.brandName,
        })),
      }))),
  }));
}

export async function loadReputationForUser(userId: string) {
  const [mentions, risks] = await Promise.all([
    db.mention.findMany({
      where: { isTarget: true, observation: { scan: { status: "COMPLETED", brand: { ownerId: userId } } } },
      take: 300,
      include: { observation: { include: { promptVersion: true, scan: { select: { id: true, brand: { select: { name: true } } } } } } },
    }),
    db.riskFinding.findMany({
      where: { brand: { ownerId: userId }, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);
  const snapshot = buildSentimentSnapshot({
    mentions: mentions.map((mention) => ({
      sentiment: mention.sentiment,
      evidence: mention.evidence,
      platformId: mention.observation.platformId,
      prompt: mention.observation.promptVersion.text,
    })),
    risks,
  });
  return { ...snapshot, totalMentions: mentions.length };
}

export async function loadCitationSourcesForUser(userId: string) {
  const [citations, ownedSources] = await Promise.all([
    db.citation.findMany({
      where: { observation: { scan: { status: "COMPLETED", brand: { ownerId: userId } } } },
      take: 500,
      include: { observation: { select: { platformId: true, scan: { select: { brandId: true, brand: { select: { name: true } } } } } } },
    }),
    db.ownedSource.findMany({
      where: { brand: { ownerId: userId } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const brandIds = [...new Set(citations.map((citation) => citation.observation.scan.brandId))];
  return brandIds.map((brandId) => {
    const currentCitations = citations.filter((citation) => citation.observation.scan.brandId === brandId);
    const brandName = currentCitations[0]?.observation.scan.brand.name ?? "品牌";
    const currentOwned = ownedSources.filter((source) => source.brandId === brandId);
    return {
      brandId,
      brandName,
      sources: groupCitationSources({
        citations: currentCitations.map((citation) => ({
          url: citation.url,
          domain: citation.domain,
          platformId: citation.observation.platformId,
          sourceQuality: citation.sourceQuality,
          title: citation.title,
        })),
        owned: currentOwned,
      }).map((source) => ({
        ...source,
        ownedSourceId: currentOwned.find((item) => item.domain === source.domain)?.id ?? null,
        representativeUrl: currentCitations.find((item) => item.domain === source.domain)?.url ?? "",
      })),
    };
  });
}

export async function loadEvidenceSnapshotsForUser(userId: string) {
  return db.observation.findMany({
    where: { scan: { status: "COMPLETED", brand: { ownerId: userId } } },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      promptVersion: true,
      mentions: true,
      citations: true,
      scan: { select: { id: true, completedAt: true, dataMode: true, brand: { select: { id: true, name: true } } } },
    },
  });
}
