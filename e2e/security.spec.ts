import { expect, test } from "@playwright/test";

test("未登录用户不能访问控制台和品牌接口", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const response = await request.get("/api/brands");
  expect(response.status()).toBe(401);
});

test("伪造 PAYJS 回调会被拒绝", async ({ request }) => {
  const response = await request.post("/api/payments/payjs/notify", {
    form: { return_code: "1", out_trade_no: "FAKE", total_fee: "1", sign: "BAD" },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).toBe("fail");
});
