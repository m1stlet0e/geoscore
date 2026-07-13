import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartScanButton } from "./start-scan-button";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const providers = [
  {
    id: "mock",
    name: "模拟 AI",
    dataMode: "SIMULATED",
    available: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    dataMode: "REAL",
    available: true,
  },
  {
    id: "private-real",
    name: "专属模型",
    dataMode: "REAL",
    available: false,
    unavailableReason: "尚未配置专属密钥",
  },
] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.unstubAllGlobals();
});

afterEach(cleanup);

describe("扫描配置工作台", () => {
  it("原生 Provider checkbox 覆盖选项卡接收指针，并保留键盘焦点入口", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ providers })));
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    const checkbox = await screen.findByRole("checkbox", { name: /模拟 AI.*模拟演示数据/ });
    expect(checkbox.closest("label")).toHaveClass("provider-option");
    await user.tab();
    expect(checkbox).toHaveFocus();

    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const inputRule = css.match(/\.provider-option input\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(inputRule).toMatch(/inset:\s*0/);
    expect(inputRule).toMatch(/width:\s*100%/);
    expect(inputRule).toMatch(/height:\s*100%/);
    expect(inputRule).not.toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/\.provider-option:has\(input:focus-visible\)/);
  });

  it("加载 Provider，可用性和原因不只依赖颜色表达", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ providers })));

    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    const sources = await screen.findByRole("group", { name: "选择 AI 数据源" });
    expect(within(sources).getByRole("checkbox", { name: /模拟 AI.*模拟演示数据/ })).toBeEnabled();
    expect(within(sources).getByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ })).toBeEnabled();
    expect(within(sources).getByRole("checkbox", { name: /专属模型.*真实 AI 数据/ })).toBeDisabled();
    expect(screen.getByText("不可用：尚未配置专属密钥")).toBeInTheDocument();
    expect(screen.getByText(/当前额度 100 次/)).toBeInTheDocument();
  });

  it("切换数据模式会清空另一模式，重复次数同步更新预估成本", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/ai/providers") return jsonResponse({ providers });
      if (url === "/api/scans") {
        return jsonResponse({ scan: { id: "scan-1", status: "PENDING" } }, 201);
      }
      if (url === "/api/scans/scan-1/execute") {
        return jsonResponse({ scan: { id: "scan-1", status: "COMPLETED" } });
      }
      throw new Error(`未预期的请求 ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={4} quotaBalance={100} />);

    const mock = await screen.findByRole("checkbox", { name: /模拟 AI.*模拟演示数据/ });
    const deepseek = screen.getByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ });
    await user.click(mock);
    expect(screen.getByText("仅用于体验闭环，不代表真实 AI 表现")).toBeInTheDocument();
    expect(screen.getByText("预计消耗 4 次")).toBeInTheDocument();

    await user.click(deepseek);
    expect(mock).not.toBeChecked();
    expect(deepseek).toBeChecked();
    expect(screen.queryByText("仅用于体验闭环，不代表真实 AI 表现")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "3 次" }));
    expect(screen.getByText("预计消耗 12 次")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-1"));
    const createCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/scans");
    expect(createCall).toBeDefined();
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body).toEqual({
      brandId: "brand-1",
      platforms: ["deepseek"],
      repeatCount: 3,
    });
    expect(body).not.toHaveProperty("verificationExperimentId");
    expect(body).not.toHaveProperty("verificationLeaseToken");
    expect(body).not.toHaveProperty("promptVersionIds");
  });

  it("Provider 加载失败后可显式重试", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ providers }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    expect(await screen.findByText("AI 数据源加载失败，请重试")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载数据源" }));

    expect(await screen.findByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("创建扫描失败时通过 aria-live 解释错误并允许重试", async () => {
    let createCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/ai/providers") return jsonResponse({ providers });
      if (url === "/api/scans") {
        createCount += 1;
        return createCount === 1
          ? jsonResponse({ message: "额度不足，本次需要 20 次" }, 402)
          : jsonResponse({ scan: { id: "scan-2", status: "PENDING" } }, 201);
      }
      if (url === "/api/scans/scan-2/execute") {
        return jsonResponse({ scan: { id: "scan-2", status: "COMPLETED" } });
      }
      throw new Error(`未预期的请求 ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    await user.click(await screen.findByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ }));
    await user.click(screen.getByRole("button", { name: "开始扫描" }));

    const alert = await screen.findByRole("status");
    expect(alert).toHaveTextContent("额度不足，本次需要 20 次");
    await user.click(screen.getByRole("button", { name: "重试扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-2"));
  });

  it("创建成功后执行请求断网，重试只恢复同一扫描，避免重复扣费", async () => {
    let createCount = 0;
    let executeCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/ai/providers") return jsonResponse({ providers });
      if (url === "/api/scans") {
        createCount += 1;
        return jsonResponse({ scan: { id: "scan-resumable", status: "PENDING" } }, 201);
      }
      if (url === "/api/scans/scan-resumable/execute") {
        executeCount += 1;
        if (executeCount === 1) throw new TypeError("Failed to fetch");
        return jsonResponse({ scan: { id: "scan-resumable", status: "COMPLETED" } });
      }
      throw new Error(`未预期的请求 ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    await user.click(await screen.findByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ }));
    await user.click(screen.getByRole("button", { name: "开始扫描" }));
    expect(await screen.findByText("扫描未完成，请检查网络后重试")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-resumable"));
    expect(createCount).toBe(1);
    expect(executeCount).toBe(2);
  });

  it("创建返回解析型 500 时锁定配置，并用同一 Idempotency-Key 重试", async () => {
    let createCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/ai/providers") return jsonResponse({ providers });
      if (url === "/api/scans") {
        createCount += 1;
        if (createCount === 1) {
          return jsonResponse({
            message: "扫描创建状态暂不可确认，请使用原配置重试",
          }, 500);
        }
        return jsonResponse({ scan: { id: "scan-idempotent", status: "PENDING" } }, 201);
      }
      if (url === "/api/scans/scan-idempotent/execute") {
        return jsonResponse({ scan: { id: "scan-idempotent", status: "COMPLETED" } });
      }
      throw new Error(`未预期的请求 ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    const deepseek = await screen.findByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ });
    await user.click(deepseek);
    await user.click(screen.getByRole("button", { name: "开始扫描" }));
    expect(await screen.findByText("扫描创建状态暂不可确认，请使用原配置重试")).toBeInTheDocument();
    expect(deepseek).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重试扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-idempotent"));
    const createCalls = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/scans");
    expect(createCalls).toHaveLength(2);
    const firstHeaders = new Headers(createCalls[0][1]?.headers);
    const secondHeaders = new Headers(createCalls[1][1]?.headers);
    expect(firstHeaders.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondHeaders.get("Idempotency-Key")).toBe(firstHeaders.get("Idempotency-Key"));
    expect(createCalls[1][1]?.body).toBe(createCalls[0][1]?.body);
  });

  it("服务明确确认扫描已失败并退款后，重试才创建新扫描", async () => {
    let createCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/ai/providers") return jsonResponse({ providers });
      if (url === "/api/scans") {
        createCount += 1;
        return jsonResponse({
          scan: { id: createCount === 1 ? "scan-failed" : "scan-new", status: "PENDING" },
        }, 201);
      }
      if (url === "/api/scans/scan-failed/execute") {
        return jsonResponse({ message: "扫描已失败，请重新创建" }, 400);
      }
      if (url === "/api/scans/scan-new/execute") {
        return jsonResponse({ scan: { id: "scan-new", status: "COMPLETED" } });
      }
      throw new Error(`未预期的请求 ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StartScanButton brandId="brand-1" activePromptCount={5} quotaBalance={100} />);

    await user.click(await screen.findByRole("checkbox", { name: /DeepSeek.*真实 AI 数据/ }));
    await user.click(screen.getByRole("button", { name: "开始扫描" }));
    expect(await screen.findByText("扫描已失败，请重新创建")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-new"));
    expect(createCount).toBe(2);
  });
});
