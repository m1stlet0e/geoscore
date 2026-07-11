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
  it("预扣额度、保存原始回答并生成评分快照", async () => {
    const user = await createReadyUser();
    const brand = await createBrandForUser(user.id, {
      name: "扫描品牌", website: "scan.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业",
      aliases: ["Scan Brand"], competitors: ["竞品甲", "竞品乙"],
    });
    const scan = await createScanForUser(user.id, brand.id, ["mock"]);
    const completed = await executeScanForUser(user.id, scan.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.observations).toHaveLength(10);
    expect(completed.scoreSnapshot?.score).toBeGreaterThanOrEqual(0);
    const quota = await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(quota.balance).toBe(20);
  });

  it("额度不足时拒绝创建扫描", async () => {
    const user = await createReadyUser();
    await db.quotaAccount.update({ where: { userId: user.id }, data: { balance: 2 } });
    const brand = await createBrandForUser(user.id, {
      name: "低额度品牌", website: "low.example.cn", industry: "企业服务", product: "客户管理软件", targetAudience: "中小企业", aliases: [], competitors: [],
    });
    await expect(createScanForUser(user.id, brand.id, ["mock"])).rejects.toThrow("额度不足");
  });
});
