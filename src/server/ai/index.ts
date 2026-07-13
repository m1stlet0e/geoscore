import { DeepSeekProvider } from "./deepseek-provider";
import { MockAiProvider } from "./mock-provider";
import type { AiProvider, AiProviderDescriptor } from "./types";

export type AiProviderEnvironment = Readonly<Record<string, string | undefined>>;

type AiProviderAvailability = Pick<
  AiProviderDescriptor,
  "available" | "unavailableReason"
>;

type AiProviderRegistration = {
  id: string;
  name: string;
  dataMode: AiProviderDescriptor["dataMode"];
  availability: (env: AiProviderEnvironment) => AiProviderAvailability;
  factory: (env: AiProviderEnvironment) => AiProvider;
};

function defineAiProviderRegistry<const T extends readonly AiProviderRegistration[]>(registry: T) {
  return registry;
}

const AI_PROVIDER_REGISTRY = defineAiProviderRegistry([
  {
    id: "mock",
    name: "模拟 AI",
    dataMode: "SIMULATED",
    availability: (env) => {
      if (env.NODE_ENV === "production") {
        return { available: false, unavailableReason: "生产环境禁止使用模拟 AI" };
      }
      if (env.AI_PROVIDER !== "mock") {
        return { available: false, unavailableReason: "需设置 AI_PROVIDER=mock" };
      }
      return { available: true };
    },
    factory: () => new MockAiProvider(),
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    dataMode: "REAL",
    availability: (env) => env.DEEPSEEK_API_KEY
      ? { available: true }
      : { available: false, unavailableReason: "缺少 DEEPSEEK_API_KEY" },
    factory: (env) => new DeepSeekProvider(
      env.DEEPSEEK_API_KEY as string,
      env.DEEPSEEK_BASE_URL,
    ),
  },
] as const);

export type AiProviderId = (typeof AI_PROVIDER_REGISTRY)[number]["id"];

type AiProviderRegistrationEntry = (typeof AI_PROVIDER_REGISTRY)[number];

function describeAiProvider(
  registration: AiProviderRegistrationEntry,
  env: AiProviderEnvironment,
): AiProviderDescriptor {
  return {
    id: registration.id,
    name: registration.name,
    dataMode: registration.dataMode,
    ...registration.availability(env),
  };
}

function findAiProviderRegistration(id: string): AiProviderRegistrationEntry {
  const registration = AI_PROVIDER_REGISTRY.find((item) => item.id === id);
  if (!registration) throw new Error(`未知 AI 平台：${id}`);
  return registration;
}

export function listAiProviders(
  env: AiProviderEnvironment = process.env,
): AiProviderDescriptor[] {
  return AI_PROVIDER_REGISTRY.map((registration) => describeAiProvider(registration, env));
}

export function getAiProvider(
  id: string,
  env: AiProviderEnvironment = process.env,
): AiProvider {
  const registration = findAiProviderRegistration(id);
  const descriptor = describeAiProvider(registration, env);
  if (!descriptor.available) {
    throw new Error(
      `AI 平台 ${descriptor.name} 不可用：${descriptor.unavailableReason ?? "未满足启用条件"}`,
    );
  }
  return registration.factory(env);
}
