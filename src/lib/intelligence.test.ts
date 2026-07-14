import { describe, expect, it } from "vitest";
import {
  buildActionAlerts,
  buildRankMatrix,
  buildSentimentSnapshot,
  groupCitationSources,
} from "./intelligence";

describe("情报中心聚合", () => {
  it("按 P0/P1/P2 排出必须处理的风险和机会", () => {
    const alerts = buildActionAlerts({
      risks: [
        { id: "risk-1", level: "WARNING", title: "负面描述", description: "售后响应慢", scanId: "scan-1" },
        { id: "risk-2", level: "CRITICAL", title: "错误价格", description: "价格过时", scanId: "scan-1" },
      ],
      opportunities: [
        { id: "opp-1", type: "MENTION_GAP", priority: 92, title: "核心问题未提及", summary: "AI 未推荐", scanId: "scan-1" },
        { id: "opp-2", type: "CITATION_GAP", priority: 68, title: "官网未被引用", summary: "引用缺口", scanId: "scan-1" },
      ],
    });

    expect(alerts.map((item) => [item.priority, item.title])).toEqual([
      ["P0", "错误价格"],
      ["P0", "核心问题未提及"],
      ["P1", "负面描述"],
      ["P2", "官网未被引用"],
    ]);
  });

  it("把同一问题在不同模型的目标排名和头号竞品排成矩阵", () => {
    const rows = buildRankMatrix([
      {
        prompt: "哪款 AI 品牌监测工具值得推荐？",
        platformId: "deepseek",
        mentions: [
          { isTarget: true, position: 2, brandName: "GeoScore" },
          { isTarget: false, position: 1, brandName: "竞品甲" },
        ],
      },
      {
        prompt: "哪款 AI 品牌监测工具值得推荐？",
        platformId: "mock",
        mentions: [{ isTarget: false, position: 1, brandName: "竞品乙" }],
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      prompt: "哪款 AI 品牌监测工具值得推荐？",
      mentionRate: 0.5,
      primaryCompetitor: "竞品甲",
      platforms: {
        deepseek: { state: "RANKED", rank: 2, competitor: "竞品甲" },
        mock: { state: "MISSING", rank: null, competitor: "竞品乙" },
      },
    });
  });

  it("汇总目标品牌情感，并保留负面证据与风险", () => {
    const snapshot = buildSentimentSnapshot({
      mentions: [
        { sentiment: "POSITIVE", evidence: "功能清晰", platformId: "deepseek", prompt: "品牌怎么样" },
        { sentiment: "NEGATIVE", evidence: "价格偏高，响应慢", platformId: "mock", prompt: "品牌怎么样" },
        { sentiment: "NEUTRAL", evidence: "提供监测能力", platformId: "deepseek", prompt: "品牌怎么样" },
      ],
      risks: [{ id: "risk-1", level: "WARNING", title: "负面词", description: "出现价格偏高", evidence: "原始回答", scanId: "scan-1" }],
    });

    expect(snapshot.distribution).toEqual({ positive: 1, neutral: 1, mixed: 0, negative: 1 });
    expect(snapshot.negativeEvidence[0]).toMatchObject({ evidence: "价格偏高，响应慢", platformId: "mock" });
    expect(snapshot.risks[0]).toMatchObject({ title: "负面词", level: "WARNING" });
  });

  it("按域名汇总引用源，并合并自有内容标记", () => {
    const sources = groupCitationSources({
      citations: [
        { url: "https://docs.example.com/a", domain: "docs.example.com", platformId: "deepseek", sourceQuality: 0.9, title: "文档 A" },
        { url: "https://docs.example.com/b", domain: "docs.example.com", platformId: "mock", sourceQuality: 0.7, title: "文档 B" },
        { url: "https://news.example.net/a", domain: "news.example.net", platformId: "deepseek", sourceQuality: 0.8, title: "新闻" },
      ],
      owned: [{ url: "https://docs.example.com/a", domain: "docs.example.com" }],
    });

    expect(sources[0]).toMatchObject({
      domain: "docs.example.com",
      citationCount: 2,
      platformCount: 2,
      isOwned: true,
    });
    expect(sources[1]).toMatchObject({ domain: "news.example.net", isOwned: false });
  });
});
