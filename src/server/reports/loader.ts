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

export function loadScanSnapshotForUser(
  userId: string,
  scanId: string,
  database: Pick<typeof db, "scan"> = db,
) {
  return database.scan.findFirst({
    where: { id: scanId, brand: { ownerId: userId } },
    select: {
      id: true,
      dataMode: true,
      providerIds: true,
      promptVersionIds: true,
      requestedCount: true,
      repeatCount: true,
      createdAt: true,
      completedAt: true,
      brand: { select: { id: true, name: true } },
      observations: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          platformId: true,
          modelId: true,
          runIndex: true,
          rawResponse: true,
          rawMetadata: true,
          latencyMs: true,
          createdAt: true,
          promptVersion: { select: { text: true, version: true } },
          mentions: {
            select: { brandName: true, isTarget: true, position: true, recommendationStrength: true, sentiment: true, evidence: true },
          },
          citations: { select: { url: true, domain: true, title: true, sourceQuality: true, isOfficial: true } },
        },
      },
    },
  });
}
