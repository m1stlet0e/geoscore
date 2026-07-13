import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("站点元数据", () => {
  it("说明从 AI 推荐缺口到增长验证的产品价值", () => {
    expect(metadata).toMatchObject({
      title: "GeoScore - AI 推荐增长行动平台",
      description: "定位 AI 没有推荐品牌的原因，生成问题级增长实验，并由用户手动发起同配置复测。",
    });
  });
});
