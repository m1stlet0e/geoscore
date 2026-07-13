import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  create: vi.fn(),
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

vi.mock("@/server/scans/service", () => ({
  createScanForUser: mocks.create,
}));

import { POST } from "./route";

const validCreationKey = "8b0fd8f1-b9b8-4b22-85d8-0c1e7f27126f";

function request(body: unknown, creationKey: string | null = validCreationKey) {
  const requestHeaders = new Headers({ "content-type": "application/json" });
  if (creationKey !== null) requestHeaders.set("Idempotency-Key", creationKey);
  return new Request("http://localhost/api/scans", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.session = { user: { id: "user-1" } };
  mocks.create.mockReset();
});

describe("创建扫描 API", () => {
  it("未登录返回 401", async () => {
    mocks.session = null;

    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 1,
    }));

    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("只把公开扫描配置传给服务", async () => {
    mocks.create.mockResolvedValue({ id: "scan-1", status: "PENDING" });

    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 3,
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      scan: { id: "scan-1", status: "PENDING" },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      "user-1",
      "brand-1",
      ["deepseek"],
      { repeatCount: 3, creationKey: validCreationKey },
    );
  });

  it.each([
    { creationKey: null, description: "缺少" },
    { creationKey: "not-a-uuid", description: "格式错误" },
  ])("幂等键$description时拒绝创建", async ({ creationKey }) => {
    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 1,
    }, creationKey));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "扫描幂等键不正确" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    { repeatCount: 0 },
    { repeatCount: 4 },
    { repeatCount: 1.5 },
    { repeatCount: "2" },
  ])("拒绝非法重复次数 $repeatCount", async ({ repeatCount }) => {
    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount,
    }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    { verificationExperimentId: "exp-forbidden" },
    { verificationLeaseToken: "lease-forbidden" },
    { promptVersionIds: ["prompt-forbidden"] },
  ])("严格拒绝实验内部字段 $verificationExperimentId$verificationLeaseToken$promptVersionIds", async (forbidden) => {
    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 1,
      ...forbidden,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "扫描参数不正确" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("非法 JSON 返回 400", async () => {
    const response = await POST(new Request("http://localhost/api/scans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": validCreationKey,
      },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "扫描参数不正确" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("额度不足映射为 402", async () => {
    mocks.create.mockRejectedValue(new Error("额度不足，本次需要 30 次"));

    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 2,
    }));

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ message: "额度不足，本次需要 30 次" });
  });

  it("幂等配置冲突映射为 409", async () => {
    mocks.create.mockRejectedValue(new Error("幂等键已用于不同扫描配置"));

    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 1,
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "幂等键已用于不同扫描配置" });
  });

  it("未知事务异常返回 500 且不泄露内部错误", async () => {
    mocks.create.mockRejectedValue(new Error("Transaction already closed: database unavailable"));

    const response = await POST(request({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 1,
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "扫描创建状态暂不可确认，请使用原配置重试" });
  });
});
