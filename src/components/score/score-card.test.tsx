import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreCard } from "./score-card";

describe("评分卡", () => {
  it("展示总分、初步评分、置信度和风险", () => {
    render(<ScoreCard score={72} confidence={48} provisional riskLevel="WARNING" />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("初步评分")).toBeInTheDocument();
    expect(screen.getByText("置信度 48")).toBeInTheDocument();
    expect(screen.getByText("需要关注")).toBeInTheDocument();
  });
});
