import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingPage from "./page";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findQuota: vi.fn(),
  findSubscription: vi.fn(),
  findOrders: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/db", () => ({
  db: {
    quotaAccount: { findUnique: mocks.findQuota },
    subscription: { findFirst: mocks.findSubscription },
    order: { findMany: mocks.findOrders },
  },
}));

vi.mock("@/components/billing/purchase-button", () => ({
  PurchaseButton: ({ planCode }: { planCode: string }) => (
    <button type="button">选择{planCode}套餐</button>
  ),
}));

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.findQuota.mockResolvedValue({ balance: 10 });
  mocks.findSubscription.mockResolvedValue(null);
  mocks.findOrders.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("套餐与额度页", () => {
  it("优先说明增长验证价值和用户手动发起边界", async () => {
    render(await BillingPage());

    expect(
      screen.getByRole("heading", { name: "为下一轮扫描与增长验证补充额度" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/扫描和实验复测均由你手动发起/)).toBeInTheDocument();
    expect(screen.getByText(/当前套餐：免费体检 · 剩余 10 次 AI 回答/)).toBeInTheDocument();
  });

  it("为付费套餐提供稳定标识并把回答额度作为次级信息", async () => {
    render(await BillingPage());

    const starter = screen.getByRole("article", { name: "基础版套餐" });
    expect(starter).toHaveAttribute("data-plan-code", "STARTER");
    expect(starter).toHaveTextContent("¥99");
    expect(within(starter).getByText("问题级抢位机会")).toBeInTheDocument();
    expect(within(starter).getByText("增长实验与手动同配置复测")).toBeInTheDocument();
    expect(within(starter).getByText("本次购买发放 500 次回答额度")).toHaveClass(
      "pricing-quota-note",
    );
  });

  it("不展示尚未实现的套餐承诺", async () => {
    const { container } = render(await BillingPage());

    expect(container).not.toHaveTextContent(
      /自动复测|自动调度|定时监测|团队协作|报告导出/,
    );
  });
});
