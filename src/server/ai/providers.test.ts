import { describe, expect, it } from "vitest";
import { listAiProviders } from "./index";

describe("AI 平台注册表", () => {
  it("显式启用 mock 时标记为可用的模拟数据平台", () => {
    const providers = listAiProviders({ AI_PROVIDER: "mock" });

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mock",
          dataMode: "SIMULATED",
          available: true,
        }),
      ]),
    );
  });

  it("只有配置密钥时才将 DeepSeek 标记为可用的真实数据平台", () => {
    const unavailable = listAiProviders({});
    const available = listAiProviders({ DEEPSEEK_API_KEY: "test-key" });

    expect(unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "deepseek",
          dataMode: "REAL",
          available: false,
          unavailableReason: expect.any(String),
        }),
      ]),
    );
    expect(available).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "deepseek",
          dataMode: "REAL",
          available: true,
        }),
      ]),
    );
  });

  it("所有不可用平台都说明原因", () => {
    const providers = listAiProviders({});

    expect(providers).toHaveLength(2);
    expect(providers.every((provider) => !provider.available && provider.unavailableReason)).toBe(true);
  });
});
