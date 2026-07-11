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

  it("拒绝未知套餐代码", () => {
    expect(() => getPlanByCode("ULTIMATE")).toThrowError("未知套餐");
  });
});
