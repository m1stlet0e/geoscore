import { describe, expect, it, vi } from "vitest";
import { loadScanReportForUser, loadScanSnapshotForUser } from "./loader";

describe("扫描报告 owner-filtered loader", () => {
  it("同时绑定 scanId 与 ownerId，其他租户读取同 scanId 返回空", async () => {
    const findFirst = vi.fn(async (args: {
      where: { id: string; brand: { ownerId: string } };
    }) => args.where.id === "scan-1" && args.where.brand.ownerId === "user-a"
      ? { id: "scan-1", brand: { id: "brand-a", name: "甲品牌" } }
      : null);
    const database = { scan: { findFirst } };

    const own = await loadScanReportForUser("user-a", "scan-1", database as never);
    const otherTenant = await loadScanReportForUser("user-b", "scan-1", database as never);

    expect(own).toMatchObject({ id: "scan-1" });
    expect(otherTenant).toBeNull();
    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "scan-1", brand: { ownerId: "user-a" } },
    }));
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: "scan-1", brand: { ownerId: "user-b" } },
    }));
  });

  it("只 include 当前 scan 的风险、建议、机会，Brand 不加载历史集合", async () => {
    const findFirst = vi.fn(async (args: unknown) => {
      void args;
      return null;
    });
    await loadScanReportForUser("user-a", "scan-current", {
      scan: { findFirst },
    } as never);

    const query = findFirst.mock.calls[0][0] as {
      include: Record<string, unknown> & { brand: unknown };
    };
    expect(query.include).toHaveProperty("riskFindings");
    expect(query.include).toHaveProperty("recommendations");
    expect(query.include).toHaveProperty("opportunities");
    expect(query.include.brand).toEqual({ select: { id: true, name: true } });
    expect(JSON.stringify(query.include.brand)).not.toMatch(/riskFindings|recommendations|opportunities/);
  });
});

describe("原始证据快照 loader", () => {
  it("快照同样必须使用用户归属过滤，并且只导出原始证据字段", async () => {
    const findFirst = vi.fn<(args: unknown) => Promise<null>>(async () => null);
    await loadScanSnapshotForUser("user-a", "scan-private", { scan: { findFirst } } as never);

    const query = findFirst.mock.calls[0][0] as unknown as { where: unknown; select: Record<string, unknown> };
    expect(query.where).toEqual({ id: "scan-private", brand: { ownerId: "user-a" } });
    expect(query.select).toMatchObject({
      dataMode: true,
      brand: { select: { id: true, name: true } },
      observations: expect.objectContaining({
        select: expect.objectContaining({ rawResponse: true, rawMetadata: true, mentions: expect.any(Object), citations: expect.any(Object) }),
      }),
    });
  });
});
