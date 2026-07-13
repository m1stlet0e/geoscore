type DataMode = "REAL" | "SIMULATED";
type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
type OpportunityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";

const aiProviderLabels: Record<string, string> = {
  deepseek: "DeepSeek",
  mock: "模拟 AI",
};

export function formatAiProviderLabel(providerId: string) {
  return aiProviderLabels[providerId] ?? providerId;
}

type DashboardOpportunity = {
  id: string;
  status: OpportunityStatus;
  priority: number;
};

type DashboardScan<T extends DashboardOpportunity> = {
  id: string;
  status: ScanStatus;
  completedAt: string | Date | null;
  dataMode: DataMode;
  score: number | null;
  opportunities: T[];
};

type DashboardBrand<T extends DashboardOpportunity> = {
  id: string;
  name: string;
  scans: DashboardScan<T>[];
};

function timestamp(value: string | Date | null) {
  return value ? new Date(value).getTime() : 0;
}

export function buildDashboardGrowthSnapshot<T extends DashboardOpportunity>(
  brands: DashboardBrand<T>[],
) {
  const latestScans = brands.flatMap((brand) => {
    const latest = brand.scans
      .filter((scan) => scan.status === "COMPLETED")
      .sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt))[0];
    return latest ? [{ ...latest, brandId: brand.id, brandName: brand.name }] : [];
  });
  const opportunities = latestScans
    .flatMap((scan) => scan.opportunities
      .filter((opportunity) => opportunity.status === "OPEN")
      .map((opportunity) => ({
        ...opportunity,
        scanId: scan.id,
        brandId: scan.brandId,
        brandName: scan.brandName,
      })))
    .sort((left, right) => right.priority - left.priority);

  return { latestScans, opportunities };
}

type BrandOpportunity = {
  id: string;
  scanId: string;
  status: OpportunityStatus;
  priority: number;
};

export function selectBrandWorkOpportunities<T extends BrandOpportunity>(
  latestScanId: string | undefined,
  opportunities: T[],
) {
  return opportunities
    .filter((opportunity) => (
      opportunity.status === "IN_PROGRESS"
      || (opportunity.status === "OPEN" && opportunity.scanId === latestScanId)
    ))
    .sort((left, right) => right.priority - left.priority);
}

type TrendScan = {
  id: string;
  dataMode: DataMode;
  completedAt: string | Date | null;
  score: number | null;
};

export function groupScoreTrends(scans: TrendScan[]) {
  const result: Record<DataMode, Array<{
    scanId: string;
    completedAt: string;
    score: number;
  }>> = { REAL: [], SIMULATED: [] };

  for (const scan of scans) {
    if (scan.score === null || !scan.completedAt) continue;
    result[scan.dataMode].push({
      scanId: scan.id,
      completedAt: new Date(scan.completedAt).toISOString(),
      score: scan.score,
    });
  }
  result.REAL.sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt));
  result.SIMULATED.sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt));
  return result;
}

type RecentScan = {
  status: ScanStatus;
  createdAt: string | Date;
};

export function selectLatestUnfinishedScan<T extends RecentScan>(scans: T[]) {
  const latest = [...scans].sort((left, right) => (
    timestamp(right.createdAt) - timestamp(left.createdAt)
  ))[0];
  if (!latest || latest.status === "COMPLETED") return null;
  return latest;
}

type RecoverableScan = {
  id: string;
  status: ScanStatus;
  verificationExperimentId: string | null;
};

export function getScanRecoveryAction(scan: RecoverableScan) {
  if (scan.verificationExperimentId) {
    return {
      kind: "EXPERIMENT" as const,
      experimentId: scan.verificationExperimentId,
    };
  }
  if (scan.status === "PENDING" || scan.status === "RUNNING") {
    return { kind: "SCAN" as const, scanId: scan.id };
  }
  return { kind: "FAILED" as const };
}
