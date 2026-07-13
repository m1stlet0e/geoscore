import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, getPlanByCode } from "./plans";

describe("套餐目录", () => {
  it("提供四档固定套餐且金额使用人民币分", () => {
    expect(Object.keys(PLAN_CATALOG)).toEqual([
      "FREE",
      "STARTER",
      "PRO",
      "BUSINESS",
    ]);
    expect(PLAN_CATALOG.FREE.priceCents).toBe(0);
    expect(PLAN_CATALOG.STARTER.priceCents).toBe(9900);
    expect(PLAN_CATALOG.PRO.priceCents).toBe(29900);
    expect(PLAN_CATALOG.BUSINESS.priceCents).toBe(89900);
  });

  it("套餐额度随等级增长", () => {
    expect(PLAN_CATALOG.FREE.monthlyResponses).toBe(30);
    expect(PLAN_CATALOG.STARTER.monthlyResponses).toBe(500);
    expect(PLAN_CATALOG.PRO.monthlyResponses).toBe(2500);
    expect(PLAN_CATALOG.BUSINESS.monthlyResponses).toBe(10000);
  });

  it("使用品牌、抢位机会、增长实验和历史归因描述付费价值", () => {
    expect(PLAN_CATALOG.FREE.features).toEqual([
      "1 个品牌",
      "初步可见度报告",
      "问题级抢位机会",
    ]);
    expect(PLAN_CATALOG.STARTER.features).toEqual([
      "1 个品牌",
      "问题级抢位机会",
      "增长实验与手动同配置复测",
    ]);
    expect(PLAN_CATALOG.PRO.features).toEqual([
      "3 个品牌",
      "扫描历史与趋势对比",
      "引用分析与实验归因",
    ]);
    expect(PLAN_CATALOG.BUSINESS.features).toEqual([
      "10 个品牌",
      "多品牌增长工作台",
      "跨品牌机会队列与实验归因",
    ]);
  });

  it("不在套餐卖点中承诺未实现能力或把回答额度作为主卖点", () => {
    const featureCopy = Object.values(PLAN_CATALOG)
      .flatMap((plan) => plan.features)
      .join(" ");

    expect(featureCopy).not.toMatch(
      /自动复测|自动调度|定时|团队|协作|导出|每周监测|高频监测|次 AI 回答/,
    );
  });

  it("拒绝未知套餐代码", () => {
    expect(() => getPlanByCode("ULTIMATE")).toThrowError("未知套餐");
  });
});
