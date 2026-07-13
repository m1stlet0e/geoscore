import { describe, expect, it } from "vitest";
import {
  buildDashboardGrowthSnapshot,
  groupScoreTrends,
  getScanRecoveryAction,
  selectBrandWorkOpportunities,
  selectLatestUnfinishedScan,
} from "./growth-data";

describe("增长工作台纯数据规则", () => {
  it("Dashboard 每个品牌只采用最新已完成扫描的 OPEN 机会，避免历史膨胀", () => {
    const snapshot = buildDashboardGrowthSnapshot([
      {
        id: "brand-1",
        name: "甲品牌",
        scans: [
          {
            id: "scan-new",
            status: "COMPLETED",
            completedAt: "2026-07-12T08:00:00.000Z",
            dataMode: "REAL",
            score: 72,
            opportunities: [
              { id: "opp-new-high", status: "OPEN", priority: 90 },
              { id: "opp-new-dismissed", status: "DISMISSED", priority: 99 },
            ],
          },
          {
            id: "scan-old",
            status: "COMPLETED",
            completedAt: "2026-07-01T08:00:00.000Z",
            dataMode: "REAL",
            score: 51,
            opportunities: [
              { id: "opp-old", status: "OPEN", priority: 100 },
            ],
          },
        ],
      },
      {
        id: "brand-2",
        name: "乙品牌",
        scans: [{
          id: "scan-other",
          status: "COMPLETED",
          completedAt: "2026-07-10T08:00:00.000Z",
          dataMode: "SIMULATED",
          score: 64,
          opportunities: [{ id: "opp-other", status: "OPEN", priority: 70 }],
        }],
      },
    ]);

    expect(snapshot.latestScans.map((scan) => scan.id)).toEqual(["scan-new", "scan-other"]);
    expect(snapshot.opportunities.map((opportunity) => opportunity.id)).toEqual([
      "opp-new-high",
      "opp-other",
    ]);
    expect(snapshot.opportunities[0]).toMatchObject({ brandId: "brand-1", brandName: "甲品牌" });
  });

  it("品牌工作台仅保留最新扫描 OPEN，同时保留历史扫描仍在推进的 IN_PROGRESS", () => {
    const result = selectBrandWorkOpportunities("scan-new", [
      { id: "latest-open", scanId: "scan-new", status: "OPEN", priority: 80 },
      { id: "old-open", scanId: "scan-old", status: "OPEN", priority: 100 },
      { id: "old-progress", scanId: "scan-old", status: "IN_PROGRESS", priority: 60 },
      { id: "latest-completed", scanId: "scan-new", status: "COMPLETED", priority: 90 },
    ]);

    expect(result.map((item) => item.id)).toEqual(["latest-open", "old-progress"]);
  });

  it("评分趋势按真实/模拟模式分轨，并按时间从旧到新排列", () => {
    const result = groupScoreTrends([
      { id: "real-new", dataMode: "REAL", completedAt: "2026-07-12T08:00:00.000Z", score: 75 },
      { id: "simulated", dataMode: "SIMULATED", completedAt: "2026-07-05T08:00:00.000Z", score: 63 },
      { id: "real-old", dataMode: "REAL", completedAt: "2026-07-01T08:00:00.000Z", score: 52 },
      { id: "no-score", dataMode: "REAL", completedAt: "2026-07-13T08:00:00.000Z", score: null },
    ]);

    expect(result.REAL.map((point) => point.scanId)).toEqual(["real-old", "real-new"]);
    expect(result.SIMULATED.map((point) => point.scanId)).toEqual(["simulated"]);
  });

  it("仅在品牌真正最新一条扫描未完成时显示恢复提示", () => {
    const oldFailed = {
      id: "scan-failed",
      status: "FAILED" as const,
      createdAt: "2026-07-01T08:00:00.000Z",
    };
    const newCompleted = {
      id: "scan-completed",
      status: "COMPLETED" as const,
      createdAt: "2026-07-12T08:00:00.000Z",
    };

    expect(selectLatestUnfinishedScan([oldFailed, newCompleted])).toBeNull();
    expect(selectLatestUnfinishedScan([
      newCompleted,
      { id: "scan-running", status: "RUNNING", createdAt: "2026-07-13T08:00:00.000Z" },
    ])).toMatchObject({ id: "scan-running", status: "RUNNING" });
  });

  it("实验验证扫描必须回实验 verify 恢复，普通扫描才直接 execute", () => {
    expect(getScanRecoveryAction({
      id: "scan-verifying",
      status: "RUNNING",
      verificationExperimentId: "exp-1",
    })).toEqual({ kind: "EXPERIMENT", experimentId: "exp-1" });
    expect(getScanRecoveryAction({
      id: "scan-failed-verification",
      status: "FAILED",
      verificationExperimentId: "exp-2",
    })).toEqual({ kind: "EXPERIMENT", experimentId: "exp-2" });
    expect(getScanRecoveryAction({
      id: "scan-normal",
      status: "PENDING",
      verificationExperimentId: null,
    })).toEqual({ kind: "SCAN", scanId: "scan-normal" });
    expect(getScanRecoveryAction({
      id: "scan-failed",
      status: "FAILED",
      verificationExperimentId: null,
    })).toEqual({ kind: "FAILED" });
  });
});
