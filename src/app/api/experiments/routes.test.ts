import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  create: vi.fn(),
  publish: vi.fn(),
  verify: vi.fn(),
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

vi.mock("@/server/experiments/service", () => {
  class MockExperimentServiceError extends Error {
    constructor(
      message: string,
      readonly code: "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT" | "PAYMENT_REQUIRED",
    ) {
      super(message);
    }
  }
  return {
    ExperimentServiceError: MockExperimentServiceError,
    createExperimentForUser: mocks.create,
    publishExperimentForUser: mocks.publish,
    verifyExperimentForUser: mocks.verify,
  };
});

import { ExperimentServiceError } from "@/server/experiments/service";
import { POST as createExperiment } from "@/app/api/opportunities/[id]/experiment/route";
import { PATCH as publishExperiment } from "@/app/api/experiments/[id]/route";
import { POST as verifyExperiment } from "@/app/api/experiments/[id]/verify/route";

const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  mocks.session = { user: { id: "user-1" } };
  mocks.create.mockReset();
  mocks.publish.mockReset();
  mocks.verify.mockReset();
});

describe("行动实验 API", () => {
  it("未登录时三个接口都返回 401", async () => {
    mocks.session = null;

    const responses = await Promise.all([
      createExperiment(new Request("http://localhost/api/opportunities/opp-1/experiment", { method: "POST" }), context("opp-1")),
      publishExperiment(new Request("http://localhost/api/experiments/exp-1", {
        method: "PATCH",
        body: JSON.stringify({ actionPlan: "这是长度足够的行动计划内容" }),
      }), context("exp-1")),
      verifyExperiment(new Request("http://localhost/api/experiments/exp-1/verify", { method: "POST" }), context("exp-1")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("创建接口只把当前用户和路径机会 ID 传给服务", async () => {
    mocks.create.mockResolvedValue({ id: "exp-1", status: "DRAFT" });

    const response = await createExperiment(new Request(
      "http://localhost/api/opportunities/opp-1/experiment",
      {
        method: "POST",
        body: JSON.stringify({ baselineScanId: "forbidden", brandId: "forbidden" }),
      },
    ), context("opp-1"));

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith("user-1", "opp-1");
  });

  it("PATCH 用严格白名单拒绝 baselineScanId 和 brandId", async () => {
    const response = await publishExperiment(new Request(
      "http://localhost/api/experiments/exp-1",
      {
        method: "PATCH",
        body: JSON.stringify({
          actionPlan: "这是长度足够的行动计划内容",
          baselineScanId: "forbidden",
          brandId: "forbidden",
        }),
      },
    ), context("exp-1"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("实验参数不正确");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("PATCH 仅转发规范字段并返回更新结果", async () => {
    mocks.publish.mockResolvedValue({ id: "exp-1", status: "ACTIVE" });
    const input = {
      actionPlan: "这是长度足够的行动计划内容",
      targetUrl: "https://example.com/guide",
    };

    const response = await publishExperiment(new Request(
      "http://localhost/api/experiments/exp-1",
      { method: "PATCH", body: JSON.stringify(input) },
    ), context("exp-1"));

    expect(response.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith("user-1", "exp-1", input);
  });

  it.each([
    ["NOT_FOUND", 404],
    ["INVALID_INPUT", 400],
    ["CONFLICT", 409],
    ["PAYMENT_REQUIRED", 402],
  ] as const)("服务错误 %s 映射为 HTTP %s", async (code, status) => {
    mocks.verify.mockRejectedValue(new ExperimentServiceError("中文服务错误", code));

    const response = await verifyExperiment(new Request(
      "http://localhost/api/experiments/exp-1/verify",
      { method: "POST" },
    ), context("exp-1"));

    expect(response.status).toBe(status);
    expect((await response.json()).message).toBe("中文服务错误");
  });
});
