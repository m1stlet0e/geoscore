import { describe, expect, it } from "vitest";
import {
  buildOpportunities,
  type OpportunitySample,
} from "./build-opportunities";

function sample(overrides: Partial<OpportunitySample> = {}): OpportunitySample {
  return {
    brandName: "GeoScore",
    promptVersionId: "prompt-version-1",
    promptText: "哪些 GEO 工具值得购买？",
    promptCategory: "PURCHASE",
    promptWeight: 1.5,
    platformId: "mock",
    rawResponse: "推荐竞品甲，暂未找到 GeoScore 的相关信息。",
    targetMentioned: false,
    targetPosition: null,
    targetRecommendationStrength: 0,
    competitorNames: ["竞品甲"],
    competitorPositions: [1],
    competitorRecommendationStrengths: [0.8],
    hasOfficialCitation: false,
    ...overrides,
  };
}

describe("问题级竞品抢位机会", () => {
  it("目标提及率低于 50% 时按问题和平台聚合为一条提及缺口", () => {
    const opportunities = buildOpportunities([
      sample({ rawResponse: "第一次回答只推荐竞品甲。" }),
      sample({ rawResponse: "第二次回答仍只推荐竞品甲。" }),
    ]);

    const mentionGaps = opportunities.filter((item) => item.type === "MENTION_GAP");
    expect(mentionGaps).toHaveLength(1);
    expect(opportunities.filter((item) => item.type === "COMPETITOR_ADVANTAGE")).toHaveLength(1);
    expect(new Set(opportunities.map((item) => item.type)).size).toBe(opportunities.length);
    expect(mentionGaps[0]).toMatchObject({
      promptVersionId: "prompt-version-1",
      platformId: "mock",
      targetContentType: "选型与采购指南",
    });
    expect(mentionGaps[0].priority).toBeGreaterThanOrEqual(0);
    expect(mentionGaps[0].priority).toBeLessThanOrEqual(100);
    expect(mentionGaps[0].title).toContain("哪些 GEO 工具值得购买");
    expect(mentionGaps[0].summary).toContain("0%");
    expect(mentionGaps[0].evidence).toContain("GeoScore");
    expect(mentionGaps[0].recommendedAction).toContain("选型与采购指南");
  });

  it("竞品出现且目标位置和推荐强度明显落后时生成竞品优势机会", () => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse: "竞品甲排名第一并被优先推荐，GeoScore 排在第四且仅作为备选。",
        targetMentioned: true,
        targetPosition: 4,
        targetRecommendationStrength: 0.2,
        competitorNames: ["竞品甲"],
        competitorPositions: [1],
        competitorRecommendationStrengths: [0.9],
        hasOfficialCitation: true,
      }),
    ]);

    const advantages = opportunities.filter((item) => item.type === "COMPETITOR_ADVANTAGE");
    expect(advantages).toHaveLength(1);
    expect(advantages[0].title).toContain("竞品甲");
    expect(advantages[0].summary).toContain("第 4 位");
    expect(advantages[0].evidence).toContain("竞品甲排名第一");
    expect(advantages[0].recommendedAction).toContain("竞品甲");
    expect(advantages[0].targetContentType).toBe("选型与采购指南");
  });

  it("至少提到一次目标但官方引用覆盖率低于 50% 时生成引用缺口", () => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse: "GeoScore 是可选工具之一，但回答没有给出官网来源。",
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.8,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
        hasOfficialCitation: false,
      }),
      sample({
        rawResponse: "再次提到 GeoScore，仍未引用官方页面。",
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.8,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
        hasOfficialCitation: false,
      }),
    ]);

    const citationGaps = opportunities.filter((item) => item.type === "CITATION_GAP");
    expect(citationGaps).toHaveLength(1);
    expect(citationGaps[0].summary).toContain("0%");
    expect(citationGaps[0].evidence).toContain("没有给出官网来源");
    expect(citationGaps[0].recommendedAction).toContain("哪些 GEO 工具值得购买");
    expect(citationGaps[0].targetContentType).toBe("官网事实与数据页");
  });

  it("官方引用覆盖率按同组全部重复回答计算", () => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse: "GeoScore 被提到并引用了官网。",
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.8,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
        hasOfficialCitation: true,
      }),
      sample({
        rawResponse: "第二次回答没有提到目标品牌。",
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
      }),
      sample({
        rawResponse: "第三次回答也没有提到目标品牌。",
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
      }),
    ]);

    const citationGap = opportunities.find((item) => item.type === "CITATION_GAP");
    expect(citationGap?.summary).toContain("33%");
  });

  it.each(["已倒闭", "停止运营", "诈骗", "违法", "被查处"])(
    "回答含高风险描述“%s”时生成品牌风险机会",
    (riskPhrase) => {
      const opportunities = buildOpportunities([
        sample({
          rawResponse: `有消息声称 GeoScore ${riskPhrase}，购买前需要核实。`,
          targetMentioned: true,
          targetPosition: 1,
          targetRecommendationStrength: 0.8,
          competitorNames: [],
          competitorPositions: [],
          competitorRecommendationStrengths: [],
          hasOfficialCitation: true,
        }),
      ]);

      const risks = opportunities.filter((item) => item.type === "BRAND_RISK");
      expect(risks).toHaveLength(1);
      expect(risks[0].priority).toBeGreaterThanOrEqual(90);
      expect(risks[0].evidence).toContain(riskPhrase);
      expect(risks[0].recommendedAction).toContain("GeoScore");
      expect(risks[0].targetContentType).toBe("品牌事实澄清页");
    },
  );

  it("风险词明确指向竞品时不误判目标品牌风险", () => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse: "GeoScore 是正常运营的候选方案；竞品甲因诈骗和违法已被查处。",
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.8,
        competitorNames: ["竞品甲"],
        competitorPositions: [2],
        competitorRecommendationStrengths: [0.4],
        hasOfficialCitation: true,
      }),
    ]);

    expect(opportunities.some((item) => item.type === "BRAND_RISK")).toBe(false);
  });

  it.each([
    "GeoScore 并未违法。",
    "GeoScore 不是诈骗公司。",
    "GeoScore 没有被查处。",
  ])("目标品牌风险词处于否定语境时不生成品牌风险：%s", (rawResponse) => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse,
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.8,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
        hasOfficialCitation: true,
      }),
    ]);

    expect(opportunities.some((item) => item.type === "BRAND_RISK")).toBe(false);
  });

  it("购买和比较问题的机会优先级高于普通发现问题", () => {
    const shared = {
      promptWeight: 1,
      targetMentioned: false,
      competitorNames: [],
      competitorPositions: [],
      competitorRecommendationStrengths: [],
    } satisfies Partial<OpportunitySample>;
    const opportunities = buildOpportunities([
      sample({ ...shared, promptVersionId: "discovery", promptText: "有哪些工具？", promptCategory: "DISCOVERY" }),
      sample({ ...shared, promptVersionId: "comparison", promptText: "工具应该如何比较？", promptCategory: "COMPARISON" }),
      sample({ ...shared, promptVersionId: "purchase", promptText: "哪些工具值得购买？", promptCategory: "PURCHASE" }),
    ]).filter((item) => item.type === "MENTION_GAP");

    const priority = (promptVersionId: string) => opportunities.find(
      (item) => item.promptVersionId === promptVersionId,
    )!.priority;
    expect(priority("comparison")).toBeGreaterThan(priority("discovery"));
    expect(priority("purchase")).toBeGreaterThan(priority("discovery"));
  });

  it("目标稳定首位强推荐且有官方引用时不生成机会", () => {
    const opportunities = buildOpportunities([
      sample({
        rawResponse: "GeoScore 是首选方案，详细信息见官方页面。",
        targetMentioned: true,
        targetPosition: 1,
        targetRecommendationStrength: 0.9,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
        hasOfficialCitation: true,
      }),
    ]);

    expect(opportunities).toEqual([]);
  });

  it("将过长的回答证据截断到 600 字符并保留问题上下文", () => {
    const [opportunity] = buildOpportunities([
      sample({
        rawResponse: `仅推荐其他工具。${"超长证据".repeat(300)}`,
        competitorNames: [],
        competitorPositions: [],
        competitorRecommendationStrengths: [],
      }),
    ]);

    expect(opportunity.evidence.length).toBeLessThanOrEqual(600);
    expect(opportunity.evidence).toContain("哪些 GEO 工具值得购买");
    expect(opportunity.evidence).toContain("GeoScore");
    expect(opportunity.evidence.endsWith("…")).toBe(true);
  });
});
