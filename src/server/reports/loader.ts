import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const scanReportInclude = {
  brand: { select: { id: true, name: true } },
  scoreSnapshot: true,
  riskFindings: {
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
  },
  recommendations: { orderBy: { createdAt: "desc" } },
  opportunities: {
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      promptVersion: true,
      optimizationExperiment: { select: { id: true } },
    },
  },
  observations: {
    orderBy: { createdAt: "asc" },
    include: { promptVersion: true, mentions: true, citations: true },
  },
} satisfies Prisma.ScanInclude;

export function loadScanReportForUser(
  userId: string,
  scanId: string,
  database: Pick<typeof db, "scan"> = db,
) {
  return database.scan.findFirst({
    where: { id: scanId, brand: { ownerId: userId } },
    include: scanReportInclude,
  });
}
