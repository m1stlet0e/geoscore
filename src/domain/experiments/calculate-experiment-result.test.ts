import { describe, expect, it } from "vitest";
import { calculateExperimentResult } from "./calculate-experiment-result";

describe("实验结果计算", () => {
  it("任一目标指标提升时验证成功并返回四项增量", () => {
    const result = calculateExperimentResult({
      baseline: {
        overallScore: 42,
        mentionRate: 0,
        recommendationScore: 25,
        citationRate: 10,
      },
      followUp: {
        overallScore: 58,
        mentionRate: 100,
        recommendationScore: 25,
        citationRate: 10,
      },
    });

    expect(result).toMatchObject({
      scoreDelta: 16,
      mentionDelta: 100,
      recommendationDelta: 0,
      citationDelta: 0,
      verified: true,
    });
    expect(result.summary).toContain("验证有效");
  });

  it("指标完全无提升时结论不确定", () => {
    const result = calculateExperimentResult({
      baseline: {
        overallScore: 50,
        mentionRate: 50,
        recommendationScore: 50,
        citationRate: 50,
      },
      followUp: {
        overallScore: 50,
        mentionRate: 50,
        recommendationScore: 50,
        citationRate: 50,
      },
    });

    expect(result.verified).toBe(false);
    expect(result.summary).toContain("尚未验证");
  });

  it("所有指标下降时结论不确定并保留负增量", () => {
    const result = calculateExperimentResult({
      baseline: {
        overallScore: 80,
        mentionRate: 75,
        recommendationScore: 60,
        citationRate: 40,
      },
      followUp: {
        overallScore: 70,
        mentionRate: 50,
        recommendationScore: 45,
        citationRate: 20,
      },
    });

    expect(result).toMatchObject({
      scoreDelta: -10,
      mentionDelta: -25,
      recommendationDelta: -15,
      citationDelta: -20,
      verified: false,
    });
  });

  it("风险从有到无时即使指标不变也验证成功", () => {
    const result = calculateExperimentResult({
      baseline: {
        overallScore: 40,
        mentionRate: 20,
        recommendationScore: 30,
        citationRate: 10,
        baselineRisk: true,
      },
      followUp: {
        overallScore: 40,
        mentionRate: 20,
        recommendationScore: 30,
        citationRate: 10,
        followUpRisk: false,
      },
    });

    expect(result.verified).toBe(true);
    expect(result.summary).toContain("风险已解除");
  });

  it("支持在输入顶层传递前后风险状态", () => {
    const unchanged = {
      overallScore: 40,
      mentionRate: 20,
      recommendationScore: 30,
      citationRate: 10,
    };

    const result = calculateExperimentResult({
      baseline: unchanged,
      followUp: unchanged,
      baselineRisk: true,
      followUpRisk: false,
    });

    expect(result.verified).toBe(true);
    expect(result.summary).toContain("风险已解除");
  });

  it("拒绝超出 0 到 100 的指标", () => {
    expect(() => calculateExperimentResult({
      baseline: {
        overallScore: -1,
        mentionRate: 20,
        recommendationScore: 30,
        citationRate: 10,
      },
      followUp: {
        overallScore: 101,
        mentionRate: 20,
        recommendationScore: 30,
        citationRate: 10,
      },
    })).toThrow("实验指标必须在 0 到 100 之间");
  });

  it("增量按两位小数四舍五入", () => {
    const result = calculateExperimentResult({
      baseline: {
        overallScore: 41.111,
        mentionRate: 11.111,
        recommendationScore: 22.222,
        citationRate: 33.333,
      },
      followUp: {
        overallScore: 42.236,
        mentionRate: 12.236,
        recommendationScore: 23.347,
        citationRate: 34.458,
      },
    });

    expect(result).toMatchObject({
      scoreDelta: 1.13,
      mentionDelta: 1.13,
      recommendationDelta: 1.13,
      citationDelta: 1.13,
      verified: true,
    });
  });
});
