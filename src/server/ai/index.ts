import { DeepSeekProvider } from "./deepseek-provider";
import { MockAiProvider } from "./mock-provider";
import type { AiProvider, AiProviderDescriptor } from "./types";

type AiProviderEnvironment = Readonly<Record<string, string | undefined>>;

export function listAiProviders(
  env: AiProviderEnvironment = process.env,
): AiProviderDescriptor[] {
  const mockAvailable = env.AI_PROVIDER === "mock";
  const deepSeekAvailable = Boolean(env.DEEPSEEK_API_KEY);

  return [
    {
      id: "mock",
      name: "模拟 AI",
      dataMode: "SIMULATED",
      available: mockAvailable,
      ...(!mockAvailable && { unavailableReason: "需设置 AI_PROVIDER=mock" }),
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      dataMode: "REAL",
      available: deepSeekAvailable,
      ...(!deepSeekAvailable && { unavailableReason: "缺少 DEEPSEEK_API_KEY" }),
    },
  ];
}

export function getAiProvider(id: string): AiProvider {
  if (id === "mock" && process.env.AI_PROVIDER === "mock") return new MockAiProvider();
  if (id === "deepseek" && process.env.DEEPSEEK_API_KEY) {
    return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_BASE_URL);
  }
  throw new Error(`AI 平台 ${id} 尚未真实接入`);
}
