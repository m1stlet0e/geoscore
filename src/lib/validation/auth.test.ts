import { describe, expect, it } from "vitest";
import { loginSchema, phoneSchema, registerSchema } from "./auth";

describe("认证输入校验", () => {
  it("接受合法的中文注册信息", () => {
    expect(
      registerSchema.safeParse({
        name: "王博",
        email: "user@geoscore.cn",
        password: "secure123",
      }).success,
    ).toBe(true);
  });

  it("拒绝短密码和错误邮箱", () => {
    expect(
      registerSchema.safeParse({ name: "用户", email: "bad", password: "123" })
        .success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: "bad", password: "12345678" }).success).toBe(false);
  });

  it("只接受中国大陆手机号", () => {
    expect(phoneSchema.safeParse("13800138000").success).toBe(true);
    expect(phoneSchema.safeParse("12800138000").success).toBe(false);
    expect(phoneSchema.safeParse("1380013800").success).toBe(false);
  });
});
