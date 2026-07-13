import { describe, expect, it } from "vitest";
import { selectCurrentScanInsights } from "./report-data";

describe("扫描报告数据隔离", () => {
  it("只返回当前 scan 的风险、建议与机会，不读取品牌历史全局集合", () => {
    const scan = {
      riskFindings: [{ id: "risk-current" }],
      recommendations: [{ id: "recommendation-current" }],
      opportunities: [{ id: "opportunity-current" }],
      brand: {
        riskFindings: [{ id: "risk-old" }],
        recommendations: [{ id: "recommendation-old" }],
        opportunities: [{ id: "opportunity-old" }],
      },
    };

    const insights = selectCurrentScanInsights(scan);

    expect(insights.riskFindings.map((item) => item.id)).toEqual(["risk-current"]);
    expect(insights.recommendations.map((item) => item.id)).toEqual(["recommendation-current"]);
    expect(insights.opportunities.map((item) => item.id)).toEqual(["opportunity-current"]);
  });
});
