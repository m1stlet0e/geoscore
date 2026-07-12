import { expect, test } from "@playwright/test";

test("用户从注册到扫描报告再到购买套餐", async ({ page }) => {
  const email = `browser-${Date.now()}@geoscore.local`;
  await page.goto("/register");
  await page.getByLabel("称呼").fill("浏览器验收用户");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secure123");
  await page.getByRole("button", { name: "免费注册" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const quotaCard = page.locator("article").filter({ hasText: "剩余额度" });
  await expect(quotaCard.getByText("30", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "创建第一个品牌" }).click();
  await page.getByLabel("品牌名称").fill("端到端品牌");
  await page.getByLabel("品牌官网").fill("e2e.geoscore.cn");
  await page.getByLabel("所属行业").fill("软件与互联网");
  await page.getByLabel("核心产品").fill("AI 品牌监测工具");
  await page.getByLabel("目标客户").fill("品牌市场负责人");
  await page.getByLabel("品牌别名").fill("E2E Brand");
  await page.getByLabel("主要竞品").fill("竞品甲，竞品乙");
  await page.getByRole("button", { name: "创建品牌并生成问题" }).click();
  await expect(page).toHaveURL(/\/dashboard\/brands\//);
  await expect(page.getByText("AI 用户可能会这样问")).toBeVisible();

  await page.getByRole("button", { name: "编辑" }).first().click();
  const updatedPrompt = "中小品牌如何选择 AI 品牌监测工具？";
  await page.locator(".prompt-edit-form input").fill(updatedPrompt);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(updatedPrompt)).toBeVisible();

  await page.getByRole("button", { name: "开始免费扫描" }).click();
  await expect(page).toHaveURL(/\/dashboard\/scans\//, { timeout: 30_000 });
  await expect(page.getByText("逐条证据")).toBeVisible();
  await expect(page.getByText("优化建议")).toBeVisible();
  await expect(page.getByText("初步评分")).toBeVisible();

  await page.getByRole("link", { name: /套餐与额度/ }).click();
  await expect(page.getByText(/剩余 20 次 AI 回答/)).toBeVisible();
  await page.getByRole("button", { name: "选择此套餐" }).first().click();
  await page.getByRole("button", { name: "确认本地模拟支付" }).click();
  await expect(page.getByText("当前套餐：基础版 · 剩余 520 次 AI 回答")).toBeVisible();
  await expect(page.getByText("已支付").first()).toBeVisible();
});
