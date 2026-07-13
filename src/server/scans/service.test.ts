import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBrandForUser } from "@/server/brands/service";
import { createScanForUser, executeScanForUser } from "./service";

const userIds: string[] = [];
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); });

async function createReadyUser() {
  const free = await db.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const user = await db.user.create({ data: { name: "扫描测试", email: `scan-${Date.now()}@test.local` } });
  userIds.push(user.id);
  await db.quotaAccount.create({ data: { userId: user.id, balance: 30 } });
  await db.subscription.create({ data: { userId: user.id, planId: free.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) } });
  return user;
}

describe("扫描服务", () => {
  it("Mock 扫描显式落库为模拟数据", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "模拟扫描品牌", website: "simulated.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    const scan = await createScanForUser(user.id, brand.id, ["mock"]);

    expect(scan.dataMode).toBe("SIMULATED");
  });

  it("拒绝在同一扫描中混用真实与模拟平台", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "混合扫描品牌", website: "mixed.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: [], competitors: [],
    });

    await expect(createScanForUser(
      user.id,
      brand.id,
      ["mock", "deepseek"],
      { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "test-key" },
    )).rejects.toThrow("一次扫描不能混合真实与模拟 AI 平台");
    expect(await db.scan.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(30);
  });

  it("预扣额度、保存原始回答并生成评分快照", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "扫描品牌", website: "scan.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: ["Scan Brand"], competitors: ["竞品甲", "竞品乙"],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    const completed = await executeScanForUser(user.id, scan.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.observations).toHaveLength(20);
    expect(completed.scoreSnapshot?.score).toBeGreaterThanOrEqual(0);
    expect(await db.recommendation.count({ where: { brandId: brand.id } })).toBeGreaterThan(0);
    const quota = await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(quota.balance).toBe(10);
  });

  it("额度不足时拒绝创建扫描", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 2 } });
    const brand = await createBrandForUser(user.id, {
      name: "低额度品牌", website: "low.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业", aliases: [], competitors: [],
    });
    await expect(createScanForUser(user.id, brand.id, ["mock"])).rejects.toThrow("额度不足");
  });

  it("并发创建扫描时额度不会被超扣", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 20 } });
    const brand = await createBrandForUser(user.id, {
      name: "并发品牌", website: "concurrent.example.cn", industry: "企业服务", product: "监测软件", targetAudience: "品牌团队", aliases: [], competitors: [],
    });
    const results = await Promise.allSettled([
      createScanForUser(user.id, brand.id, ["mock"]),
      createScanForUser(user.id, brand.id, ["mock"]),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect((await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(0);
  });
});
