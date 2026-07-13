import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  list: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => mocks.session),
    },
  },
}));

vi.mock("@/server/ai", () => ({
  listAiProviders: mocks.list,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.session = { user: { id: "user-1" } };
  mocks.list.mockReset();
});

describe("AI Provider 列表 API", () => {
  it("未登录返回 401，且不读取 Provider 注册表", async () => {
    mocks.session = null;

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "请先登录" });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("返回真实、模拟模式和可用性描述符", async () => {
    const providers = [
      {
        id: "mock",
        name: "模拟 AI",
        dataMode: "SIMULATED",
        available: false,
        unavailableReason: "需设置 AI_PROVIDER=mock",
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        dataMode: "REAL",
        available: true,
      },
    ];
    mocks.list.mockReturnValue(providers);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ providers });
    expect(mocks.list).toHaveBeenCalledOnce();
  });
});
