import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentPanel } from "./experiment-panel";
import { OpportunityCard } from "./opportunity-card";
import { ScoreTrend } from "./score-trend";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const opportunity = {
  id: "opp-1",
  type: "COMPETITOR_ADVANTAGE" as const,
  priority: 88,
  platformId: "deepseek",
  title: "竞品在采购场景领先",
  summary: "回答更频繁推荐竞品。",
  evidence: "3 次回答中，竞品有 2 次排在首位。",
  recommendedAction: "发布一份采购决策指南，补齐对比证据。",
  targetContentType: "采购指南",
  promptText: "中小企业该如何选择项目管理工具？",
  experimentId: null,
};

const draftExperiment = {
  id: "exp-1",
  updatedAt: "2026-07-14T08:00:00.000Z",
  title: "抢位实验：采购决策指南",
  hypothesis: "补充可验证证据后，推荐率会提升。",
  actionPlan: "先整理采购标准，再发布带数据出处的采购指南。",
  targetUrl: null,
  status: "DRAFT" as const,
  nextCheckAt: null,
  verificationLeaseExpiresAt: null,
  resultSummary: null,
  scoreDelta: null,
  mentionDelta: null,
  recommendationDelta: null,
  citationDelta: null,
  baselineScanId: "scan-base",
  followUpScanId: null,
  baselineDataMode: "REAL" as const,
};
const referenceTimeMs = new Date("2026-07-14T10:00:00.000Z").getTime();

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.unstubAllGlobals();
});

afterEach(cleanup);

describe("GeoScore 趋势", () => {
  it("明确标注真实数据模式，并让图上每个点可从文本列表回到报告", () => {
    render(<ScoreTrend
      mode="REAL"
      points={[
        { scanId: "scan-1", score: 58, completedAt: "2026-07-01T08:00:00.000Z" },
        { scanId: "scan-2", score: 71, completedAt: "2026-07-08T08:00:00.000Z" },
      ]}
    />);

    expect(screen.getByText("真实 AI 数据")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "真实 AI 数据 GeoScore 趋势图" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "真实 AI 数据趋势数据" });
    expect(within(list).getByRole("link", { name: /58 分/ })).toHaveAttribute("href", "/dashboard/scans/scan-1");
    expect(within(list).getByRole("link", { name: /71 分/ })).toHaveAttribute("href", "/dashboard/scans/scan-2");
  });

  it("模拟模式空态仍显示模式与演示免责声明", () => {
    render(<ScoreTrend mode="SIMULATED" points={[]} />);

    expect(screen.getByText("模拟演示数据")).toBeInTheDocument();
    expect(screen.getByText("还没有模拟演示数据趋势")).toBeInTheDocument();
    expect(screen.getByText("仅用于体验闭环，不代表真实 AI 表现")).toBeInTheDocument();
  });

  it("REAL 与 SIMULATED 分别计算同模式最新环比，不跨模式", () => {
    render(<>
      <ScoreTrend mode="REAL" points={[
        { scanId: "real-1", score: 60, completedAt: "2026-07-01T08:00:00.000Z" },
        { scanId: "real-2", score: 73, completedAt: "2026-07-08T08:00:00.000Z" },
      ]} />
      <ScoreTrend mode="SIMULATED" points={[
        { scanId: "sim-1", score: 80, completedAt: "2026-07-02T08:00:00.000Z" },
        { scanId: "sim-2", score: 75, completedAt: "2026-07-09T08:00:00.000Z" },
      ]} />
    </>);

    expect(screen.getByText("较上次 +13.0")).toBeInTheDocument();
    expect(screen.getByText("较上次 -5.0")).toBeInTheDocument();
    expect(screen.queryByText("较上次 +15.0")).not.toBeInTheDocument();
  });
});

describe("机会卡片", () => {
  it("展示中文机会类型、问题、平台、优先级、证据和行动", () => {
    render(<OpportunityCard opportunity={opportunity} />);

    expect(screen.getByText("竞品领先")).toBeInTheDocument();
    expect(screen.getByText(opportunity.promptText)).toBeInTheDocument();
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getByText("优先级 88")).toBeInTheDocument();
    expect(screen.getByText(opportunity.evidence)).toBeInTheDocument();
    expect(screen.getByText(opportunity.recommendedAction)).toBeInTheDocument();
  });

  it("创建实验时显示进行状态并跳转详情", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<OpportunityCard opportunity={opportunity} />);

    await user.click(screen.getByRole("button", { name: "创建增长实验" }));
    expect(screen.getByRole("status")).toHaveTextContent("正在创建实验");
    resolveRequest?.(jsonResponse({ experiment: { id: "exp-created" } }, 201));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/experiments/exp-created"));
    expect(fetchMock).toHaveBeenCalledWith("/api/opportunities/opp-1/experiment", { method: "POST" });
  });

  it("已有实验直接提供查看入口，创建错误可重试", async () => {
    const { rerender } = render(<OpportunityCard opportunity={{ ...opportunity, experimentId: "exp-existing" }} />);
    expect(screen.getByRole("link", { name: "查看增长实验" })).toHaveAttribute(
      "href",
      "/dashboard/experiments/exp-existing",
    );

    const fetchMock = vi.fn(async () => jsonResponse({ message: "当前机会状态不能创建实验" }, 409));
    vi.stubGlobal("fetch", fetchMock);
    rerender(<OpportunityCard opportunity={opportunity} />);
    await userEvent.click(screen.getByRole("button", { name: "创建增长实验" }));

    expect(await screen.findByRole("status")).toHaveTextContent("当前机会状态不能创建实验");
    expect(screen.getByRole("button", { name: "重试创建实验" })).toBeEnabled();
  });

  it("创建接口返回非 JSON 时显示中文兜底，不泄露解析异常", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>error</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    })));
    const user = userEvent.setup();
    render(<OpportunityCard opportunity={opportunity} />);

    await user.click(screen.getByRole("button", { name: "创建增长实验" }));

    expect(await screen.findByRole("status")).toHaveTextContent("实验创建失败，请重试");
    expect(screen.queryByText(/Unexpected token|JSON|SyntaxError/i)).not.toBeInTheDocument();
  });
});

describe("增长实验面板", () => {
  it("DRAFT 可编辑行动计划和网址，并通过 PATCH 发布", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return jsonResponse({
        experiment: {
          ...draftExperiment,
          status: "ACTIVE",
          targetUrl: "https://example.com/guide",
          nextCheckAt: "2026-07-21T08:00:00.000Z",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={draftExperiment} />);

    await user.clear(screen.getByRole("textbox", { name: "行动计划" }));
    await user.type(screen.getByRole("textbox", { name: "行动计划" }), "发布一份包含来源、参数与客户案例的采购指南。");
    await user.type(screen.getByRole("textbox", { name: "目标网址" }), "https://example.com/guide");
    await user.click(screen.getByRole("button", { name: "发布行动实验" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/experiments/exp-1", expect.objectContaining({ method: "PATCH" }));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({
      actionPlan: "发布一份包含来源、参数与客户案例的采购指南。",
      targetUrl: "https://example.com/guide",
    });
  });

  it("ACTIVE 可保存新的行动版本", async () => {
    const active = {
      ...draftExperiment,
      status: "ACTIVE" as const,
      baselineDataMode: "SIMULATED" as const,
    };
    const fetchMock = vi.fn(async () => jsonResponse({ experiment: active }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={active} />);

    await user.clear(screen.getByRole("textbox", { name: "行动计划" }));
    await user.type(screen.getByRole("textbox", { name: "行动计划" }), "更新后的行动计划，包含新的证据来源与发布路径。");
    await user.click(screen.getByRole("button", { name: "保存行动版本" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/experiments/exp-1",
      expect.objectContaining({ method: "PATCH" }),
    ));
    expect(screen.getByRole("status")).toHaveTextContent("行动版本已保存");
  });

  it("模拟实验可立即发起验证，并醒目标识演示数据", async () => {
    const active = {
      ...draftExperiment,
      status: "ACTIVE" as const,
      baselineDataMode: "SIMULATED" as const,
    };
    const fetchMock = vi.fn(async () => jsonResponse({
      experiment: { ...active, status: "VERIFYING" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={active} />);

    expect(screen.getByText("模拟演示数据")).toBeInTheDocument();
    expect(screen.getByText("仅用于体验闭环，不代表真实 AI 表现")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始验证" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/experiments/exp-1/verify",
      { method: "POST" },
    ));
  });

  it("真实实验到 nextCheckAt 前禁用验证并显示日期", () => {
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      status: "ACTIVE",
      nextCheckAt: "2099-01-02T08:00:00.000Z",
    }} />);

    expect(screen.getByText("真实 AI 数据")).toBeInTheDocument();
    expect(screen.getByText(/2099/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "尚未到复查时间" })).toBeDisabled();
  });

  it("验证额度不足时明确给出 402 说明与套餐入口", async () => {
    const active = {
      ...draftExperiment,
      status: "ACTIVE" as const,
      baselineDataMode: "SIMULATED" as const,
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      message: "额度不足，本次需要 10 次",
    }, 402)));
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={active} />);

    await user.click(screen.getByRole("button", { name: "开始验证" }));

    expect(await screen.findByRole("status")).toHaveTextContent("额度不足，本次需要 10 次");
    expect(screen.getByRole("link", { name: "查看套餐与额度" })).toHaveAttribute("href", "/dashboard/billing");
  });

  it("验证请求原生 TypeError 统一转换为中文重试提示", async () => {
    const active = {
      ...draftExperiment,
      status: "ACTIVE" as const,
      baselineDataMode: "SIMULATED" as const,
    };
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={active} />);

    await user.click(screen.getByRole("button", { name: "开始验证" }));

    expect(await screen.findByRole("status")).toHaveTextContent("实验验证失败，请重试");
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("VERIFYING 有效租约显示等待与刷新，不重复发起验证", async () => {
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      status: "VERIFYING",
      baselineDataMode: "SIMULATED",
      verificationLeaseExpiresAt: "2099-01-02T08:00:00.000Z",
    }} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在复扫并计算实验结果");
    expect(screen.queryByRole("button", { name: "开始验证" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复验证" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "刷新验证状态" }));
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("VERIFYING 租约过期后可通过同一 verify API 恢复", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      experiment: {
        ...draftExperiment,
        status: "VERIFYING",
        baselineDataMode: "SIMULATED",
        verificationLeaseExpiresAt: "2099-01-02T08:00:00.000Z",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      status: "VERIFYING",
      baselineDataMode: "SIMULATED",
      verificationLeaseExpiresAt: "2020-01-02T08:00:00.000Z",
    }} />);

    expect(screen.getByRole("status")).toHaveTextContent("验证执行已中断，可以安全恢复");
    await user.click(screen.getByRole("button", { name: "恢复验证" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/experiments/exp-1/verify",
      { method: "POST" },
    ));
  });

  it("服务端刷新后 updatedAt 与状态变化会同步为终态", () => {
    const { rerender } = render(<ExperimentPanel key="2026-07-14T08:00:00.000Z" referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      status: "VERIFYING",
      baselineDataMode: "SIMULATED",
      verificationLeaseExpiresAt: "2099-01-02T08:00:00.000Z",
    }} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在复扫并计算实验结果");

    rerender(<ExperimentPanel key="2026-07-14T09:00:00.000Z" referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      updatedAt: "2026-07-14T09:00:00.000Z",
      status: "VERIFIED",
      resultSummary: "复扫已经完成。",
      scoreDelta: 6,
      mentionDelta: 4,
      recommendationDelta: 8,
      citationDelta: 3,
      followUpScanId: "scan-follow",
    }} />);

    expect(screen.getByText("复扫已经完成。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看复扫报告" })).toBeInTheDocument();
  });

  it("终态展示四项变化、结论和基线/复扫报告链接", () => {
    render(<ExperimentPanel referenceTimeMs={referenceTimeMs} experiment={{
      ...draftExperiment,
      status: "VERIFIED",
      resultSummary: "推荐率和引用率均达到显著提升。",
      scoreDelta: 8.5,
      mentionDelta: 12,
      recommendationDelta: 16,
      citationDelta: 9,
      followUpScanId: "scan-follow",
    }} />);

    expect(screen.getAllByText("已验证提升")).toHaveLength(2);
    expect(screen.getByText("推荐率和引用率均达到显著提升。")).toBeInTheDocument();
    for (const label of ["GeoScore 变化", "提及率变化", "推荐率变化", "引用率变化"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "查看基线报告" })).toHaveAttribute("href", "/dashboard/scans/scan-base");
    expect(screen.getByRole("link", { name: "查看复扫报告" })).toHaveAttribute("href", "/dashboard/scans/scan-follow");
  });
});
