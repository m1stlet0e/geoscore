import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("官网首页", () => {
  it("展示品牌 AI 可见度的核心价值和免费体检入口", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "你的品牌，正在被 AI 推荐吗？" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "免费检测品牌" }),
    ).toHaveAttribute("href", "/register");
  });
});
