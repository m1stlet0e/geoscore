import { describe, expect, it } from "vitest";
import { createPayjsSignature, verifyPayjsSignature } from "./signature";

describe("PAYJS 签名", () => {
  it("按参数名排序、忽略空值和 sign 并输出大写 MD5", () => {
    const params = { total_fee: "9900", mchid: "123", out_trade_no: "ORDER1", attach: "", sign: "OLD" };
    expect(createPayjsSignature(params, "secret")).toBe("571D67741994EA2C0BFE243A3DF37937");
  });

  it("使用恒定时间比较验证签名", () => {
    const params = { mchid: "123", total_fee: "9900", out_trade_no: "ORDER1" };
    const sign = createPayjsSignature(params, "secret");
    expect(verifyPayjsSignature({ ...params, sign }, "secret")).toBe(true);
    expect(verifyPayjsSignature({ ...params, sign: "BAD" }, "secret")).toBe(false);
  });
});
