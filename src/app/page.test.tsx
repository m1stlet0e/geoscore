import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

afterEach(cleanup);

describe("产品首页", () => {
  it("以可执行和可验证的增长任务为核心，并展示手动复测旅程", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "把 AI 没有推荐你的原因，变成可以执行和验证的增长任务",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "扫描定位" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "抢位行动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "同配置手动复测" })).toBeInTheDocument();
  });

  it("明确区分报告示例、模拟演示和真实 AI 证据", () => {
    render(<Home />);

    expect(screen.getByText("报告示例")).toBeInTheDocument();
    expect(screen.getByText(/仅用于体验闭环，不代表真实 AI 表现/)).toBeInTheDocument();
    expect(screen.getByText(/真实证据来自真实 AI 数据源/)).toBeInTheDocument();
  });

  it.each([
    ["免费体检", "¥0"],
    ["基础版", "¥99"],
    ["专业版", "¥299"],
    ["商业版", "¥899"],
  ])("公开展示%s的固定价格", (planName, price) => {
    render(<Home />);

    const card = screen.getByRole("article", { name: `${planName}套餐` });
    expect(within(card).getByText(price)).toBeInTheDocument();
  });

  it("按真实到账动作把回答额度作为次级信息", () => {
    render(<Home />);

    const free = screen.getByRole("article", { name: "免费体检套餐" });
    const starter = screen.getByRole("article", { name: "基础版套餐" });
    expect(within(free).getByText("注册后发放 30 次回答额度")).toBeInTheDocument();
    expect(within(starter).getByText("每次购买发放 500 次回答额度")).toBeInTheDocument();
    expect(free).not.toHaveTextContent("每月含");
  });

  it("不承诺尚未实现的产品能力", () => {
    const { container } = render(<Home />);

    expect(container).not.toHaveTextContent(
      /自动复测|自动调度|定时监测|团队协作|报告导出/,
    );
  });
});
