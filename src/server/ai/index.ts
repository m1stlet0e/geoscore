import { DeepSeekProvider } from "./deepseek-provider";
import { MockAiProvider } from "./mock-provider";
import type { AiProvider } from "./types";

export function getAiProvider(id: string): AiProvider {
  if (id === "mock" && process.env.AI_PROVIDER === "mock") return new MockAiProvider();
  if (id === "deepseek" && process.env.DEEPSEEK_API_KEY) {
    return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_BASE_URL);
  }
  throw new Error(`AI 平台 ${id} 尚未真实接入`);
}
