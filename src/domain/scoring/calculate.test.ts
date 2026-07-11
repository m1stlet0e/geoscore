import { describe, expect, it } from "vitest";
import { calculateConfidence, calculateGeoScore, positionFactor } from "./calculate";

describe("GeoScore 评分", () => {
  it("按 30/25/20/15/10 计算五项总分", () => {
    const result = calculateGeoScore({
      mentionScore: 80,
      recommendationScore: 60,
      shareOfVoiceScore: 50,
      citationScore: 40,
      sentimentScore: 90,
      confidenceScore: 80,
      hasCriticalRisk: false,
    });
    expect(result.score).toBe(64);
    expect(result.isProvisional).toBe(false);
  });

  it("重大事实风险将最终分数限制在 59", () => {
    const result = calculateGeoScore({
      mentionScore: 100,
      recommendationScore: 100,
      shareOfVoiceScore: 100,
      citationScore: 100,
      sentimentScore: 100,
      confidenceScore: 90,
      hasCriticalRisk: true,
    });
    expect(result.score).toBe(59);
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("排名越靠后推荐折损越大", () => {
    expect(positionFactor(1)).toBe(1);
    expect(positionFactor(3)).toBe(0.65);
    expect(positionFactor(8)).toBe(0.35);
  });

  it("样本不足 120 条时标记初步评分", () => {
    const confidence = calculateConfidence({ sampleCount: 30, platformCount: 3, repeatConsistency: 1 });
    expect(confidence.score).toBe(62.5);
    expect(confidence.isProvisional).toBe(true);
  });
});
