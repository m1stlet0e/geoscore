import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "./deepseek-provider";
import { MockAiProvider } from "./mock-provider";
import { getAiProvider, listAiProviders } from "./index";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it("Mock 在应用优化时稳定推荐目标品牌并返回官方引用", async () => {
    const provider = new MockAiProvider();

    const answer = await provider.query({
      prompt: "c",
      brand: {
        name: "实验品牌",
        website: "https://target.example.com",
        aliases: [],
      },
      competitors: ["竞品甲"],
      simulationContext: {
        optimizationApplied: true,
        targetUrl: "https://target.example.com/optimized",
      },
    });

    expect(answer.modelId).toBe("mock-deterministic-optimized-v1");
    expect(answer.mentions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        isTarget: true,
        recommendationStrength: expect.any(Number),
      }),
    ]));
    expect(answer.mentions.find((item) => item.isTarget)?.recommendationStrength)
      .toBeGreaterThan(0);
    expect(answer.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: "https://target.example.com/optimized",
        isOfficial: true,
      }),
    ]));
  });

  it("Mock 的优化目标在站外时仍包含品牌官网引用", async () => {
    const provider = new MockAiProvider();

    const answer = await provider.query({
      prompt: "c",
      brand: {
        name: "实验品牌",
        website: "https://official.example.com",
        aliases: [],
      },
      competitors: [],
      simulationContext: {
        optimizationApplied: true,
        targetUrl: "https://content.example.net/guide",
      },
    });

    expect(answer.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: "https://official.example.com",
        isOfficial: true,
      }),
    ]));
    expect(answer.rawResponse).toContain("https://content.example.net/guide");
  });

  it("DeepSeek 请求消息完全忽略模拟实验上下文", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        id: "response-id",
        model: "deepseek-chat",
        choices: [{ message: { content: "普通回答" } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const provider = new DeepSeekProvider("test-key", "https://deepseek.test");

    await provider.query({
      prompt: "用户原始问题",
      brand: {
        name: "实验品牌",
        website: "https://target.example.com",
        aliases: [],
      },
      competitors: ["竞品甲"],
      simulationContext: {
        optimizationApplied: true,
        targetUrl: "https://target.example.com/optimized",
      },
    });

    expect(requestBody).toContain("用户原始问题");
    expect(requestBody).not.toContain("实验品牌");
    expect(requestBody).not.toContain("target.example.com");
    expect(requestBody).not.toContain("optimizationApplied");
  });

  it("DeepSeek 请求超时时主动中止 fetch 并返回中文错误", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | null = null;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        fetchSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        if (!fetchSignal) {
          reject(new Error("fetch 缺少 AbortSignal"));
          return;
        }
        fetchSignal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        }, { once: true });
      })
    )));
    const provider = new DeepSeekProvider("test-key", "https://deepseek.test", 10);

    const rejection = provider.query({
      prompt: "需要在超时后终止的问题",
      brand: {
        name: "实验品牌",
        website: "https://target.example.com",
        aliases: [],
      },
      competitors: [],
    }).then(() => null, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(11);

    const error = await rejection;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("DeepSeek 请求超时，请稍后重试");
    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    expect((fetchSignal as AbortSignal | null)?.aborted).toBe(true);
  });
});
