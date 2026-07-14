import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  loadSnapshot: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn(async () => mocks.session) } } }));
vi.mock("@/server/reports/loader", () => ({ loadScanSnapshotForUser: mocks.loadSnapshot }));

import { GET } from "./route";

beforeEach(() => {
  mocks.session = { user: { id: "user-1" } };
  mocks.loadSnapshot.mockReset();
});

describe("扫描证据快照 API", () => {
  it("未登录不能下载", async () => {
    mocks.session = null;
    const response = await GET(new Request("http://localhost/api/scans/scan-1/snapshot"), { params: Promise.resolve({ id: "scan-1" }) });
    expect(response.status).toBe(401);
    expect(mocks.loadSnapshot).not.toHaveBeenCalled();
  });

  it("按当前用户加载并以私有附件导出", async () => {
    mocks.loadSnapshot.mockResolvedValue({ id: "scan-1", brand: { name: "甲品牌" } });
    const response = await GET(new Request("http://localhost/api/scans/scan-1/snapshot"), { params: Promise.resolve({ id: "scan-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.loadSnapshot).toHaveBeenCalledWith("user-1", "scan-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(await response.json()).toMatchObject({ schemaVersion: "geoscore-evidence-snapshot/v1", scan: { id: "scan-1" } });
  });
});
