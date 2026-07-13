import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrderForUser, fulfillPaidOrder } from "./service";

const userIds: string[] = [];
afterEach(async () => { await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); });

async function createUser() {
  const user = await db.user.create({ data: { name: "支付测试", email: `pay-${Date.now()}-${Math.random()}@test.local` } });
  userIds.push(user.id);
  await db.quotaAccount.create({ data: { userId: user.id, balance: 30 } });
  return user;
}

describe("订单履约", () => {
  it.each([
    ["STARTER", 9900],
    ["PRO", 29900],
    ["BUSINESS", 89900],
  ] as const)("%s 套餐订单使用数据库中的真实金额", async (planCode, amountCents) => {
    const user = await createUser();

    const order = await createOrderForUser(user.id, planCode, "mock");

    expect(order.amountCents).toBe(amountCents);
  });

  it("金额由服务端套餐生成且重复回调不重复发放额度", async () => {
    const user = await createUser();
    const order = await createOrderForUser(user.id, "STARTER", "mock");
    expect(order.amountCents).toBe(9900);
    const payload = { provider: "mock", providerEventId: "event-1", providerOrderId: "mock-1", orderNo: order.orderNo, amountCents: 9900, rawPayload: { status: "paid" } };
    await fulfillPaidOrder(payload);
    await fulfillPaidOrder(payload);
    const quota = await db.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(quota.balance).toBe(530);
    expect(await db.paymentEvent.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("回调金额不一致时拒绝履约", async () => {
    const user = await createUser();
    const order = await createOrderForUser(user.id, "PRO", "mock");
    await expect(fulfillPaidOrder({ provider: "mock", providerEventId: "event-wrong", providerOrderId: "mock-wrong", orderNo: order.orderNo, amountCents: 1, rawPayload: {} })).rejects.toThrow("订单金额不一致");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });
});
