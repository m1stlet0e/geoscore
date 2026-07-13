import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeScanButton } from "./resume-scan-button";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

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

describe("恢复未完成扫描", () => {
  it("网络失败后重试始终执行原 scanId，不创建新扫描", async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return jsonResponse({ scan: { id: "scan-running", status: "COMPLETED" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResumeScanButton scanId="scan-running" status="RUNNING" />);

    await user.click(screen.getByRole("button", { name: "继续未完成扫描" }));
    expect(await screen.findByRole("status")).toHaveTextContent("扫描恢复失败，请检查网络后重试");
    await user.click(screen.getByRole("button", { name: "重试继续扫描" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/scans/scan-running"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/scans/scan-running/execute", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/scans/scan-running/execute", { method: "POST" });
  });

  it("明确展示 PENDING 或 RUNNING 状态", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { rerender } = render(<ResumeScanButton scanId="scan-pending" status="PENDING" />);
    expect(screen.getByText("等待执行")).toBeInTheDocument();
    rerender(<ResumeScanButton scanId="scan-running" status="RUNNING" />);
    expect(screen.getByText("执行中断，可安全恢复")).toBeInTheDocument();
  });
});
