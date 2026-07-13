import { describe, expect, it } from "vitest";
import { DeepSeekProvider } from "./deepseek-provider";
import { getAiProvider, listAiProviders } from "./index";

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

  it("未知平台 ID 给出明确的中文错误", () => {
    expect(() => getAiProvider("unknown", {})).toThrow("未知 AI 平台：unknown");
  });

  it("已注册但不可用的平台给出具体原因", () => {
    expect(() => getAiProvider("deepseek", {})).toThrow(
      "AI 平台 DeepSeek 不可用：缺少 DEEPSEEK_API_KEY",
    );
  });

  it("生产环境始终禁用 Mock 平台", () => {
    const env = { AI_PROVIDER: "mock", NODE_ENV: "production" };
    const mock = listAiProviders(env).find((provider) => provider.id === "mock");

    expect(mock).toMatchObject({
      dataMode: "SIMULATED",
      available: false,
      unavailableReason: "生产环境禁止使用模拟 AI",
    });
    expect(() => getAiProvider("mock", env)).toThrow(
      "AI 平台 模拟 AI 不可用：生产环境禁止使用模拟 AI",
    );
  });

  it("DeepSeek 可用时由注册表工厂创建真实 Provider", () => {
    const env = {
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_BASE_URL: "https://deepseek.test",
    };
    const deepseek = listAiProviders(env).find((provider) => provider.id === "deepseek");

    expect(deepseek).toMatchObject({ dataMode: "REAL", available: true });
    expect(getAiProvider("deepseek", env)).toBeInstanceOf(DeepSeekProvider);
  });
});
