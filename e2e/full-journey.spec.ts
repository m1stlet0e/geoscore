import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const expectedPlans = [
  ["免费体检", "¥0"],
  ["基础版", "¥99"],
  ["专业版", "¥299"],
  ["商业版", "¥899"],
] as const;

test("用户完成模拟扫描、付费补额和增长实验验证闭环", async ({ page }, testInfo) => {
  const runId = randomUUID();
  const email = `browser-${testInfo.project.name}-${runId}@geoscore.local`;
  const brandName = `端到端品牌-${runId.slice(0, 8)}`;
  const brandWebsite = `e2e-${runId.slice(0, 8)}.geoscore.local`;
  let baselineReportUrl = "";

  await test.step("首页准确说明增长闭环和四档价格", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", {
      name: "把 AI 没有推荐你的原因，变成可以执行和验证的增长任务",
    })).toBeVisible();

    const pricing = page.locator("#pricing");
    for (const [name, price] of expectedPlans) {
      const planCard = pricing.locator("article").filter({ hasText: name });
      await expect(planCard).toContainText(price);
    }
  });

  await test.step("注册并获得免费额度", async () => {
    await page.goto("/register");
    await page.getByLabel("称呼").fill("浏览器验收用户");
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill("secure123");
    await page.getByRole("button", { name: "免费注册" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const quotaCard = page.locator("article").filter({ hasText: "剩余额度" });
    await expect(quotaCard.getByText("30", { exact: true })).toBeVisible();
  });

  await test.step("创建品牌并生成 20 个监测问题", async () => {
    await page.getByRole("link", { name: "创建第一个品牌" }).click();
    await page.getByLabel("品牌名称").fill(brandName);
    await page.getByLabel("品牌官网").fill(brandWebsite);
    await page.getByLabel("所属行业").fill("软件与互联网");
    await page.getByLabel("核心产品").fill("AI 品牌监测工具");
    await page.getByLabel("目标客户").fill("品牌市场负责人");
    await page.getByLabel("品牌别名").fill("E2E Brand");
    await page.getByLabel("主要竞品").fill("竞品甲，竞品乙");
    await page.getByRole("button", { name: "创建品牌并生成问题" }).click();

    await expect(page).toHaveURL(/\/dashboard\/brands\//);
    await expect(page.getByRole("heading", { name: "维护扫描问题" })).toBeVisible();
    await expect(page.locator(".prompt-section ol > li")).toHaveCount(20);
  });

  await test.step("用明确标注的模拟 AI 建立基线报告", async () => {
    await page.getByRole("checkbox", { name: /模拟 AI/ }).check();
    await expect(page.locator(".scan-cost-bar")).toContainText("预计消耗 20 次");
    await expect(page.locator(".scan-config .simulation-disclaimer")).toHaveText(
      "仅用于体验闭环，不代表真实 AI 表现",
    );
    await page.getByRole("button", { name: "开始扫描" }).click();

    await expect(page).toHaveURL(/\/dashboard\/scans\//, { timeout: 30_000 });
    await expect(page.locator(".report-mode-stamp")).toHaveText("模拟演示数据");
    await expect(page.locator(".report-disclaimer")).toHaveText("仅用于体验闭环，不代表真实 AI 表现");
    await expect(page.getByRole("heading", { name: "从报告进入增长实验" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "每一个结论，都能回到原始回答" })).toBeVisible();
    baselineReportUrl = page.url();
  });

  await test.step("GEO 情报页保留排名、口碑、来源与原始证据入口", async () => {
    const intelligenceNav = page.locator(".sidebar nav");
    await intelligenceNav.getByRole("link", { name: "情报总览", exact: true }).click();
    await expect(page.getByRole("heading", { name: /今天，先处理/ })).toBeVisible();
    await intelligenceNav.getByRole("link", { name: "排名矩阵", exact: true }).click();
    await expect(page.getByRole("heading", { name: /哪个问题、哪个模型/ })).toBeVisible();
    await intelligenceNav.getByRole("link", { name: "口碑预警", exact: true }).click();
    await expect(page.getByRole("heading", { name: /AI 是怎样向客户/ })).toBeVisible();
    await intelligenceNav.getByRole("link", { name: "引用溯源", exact: true }).click();
    await expect(page.getByRole("heading", { name: /让 AI 采信的内容/ })).toBeVisible();
    await intelligenceNav.getByRole("link", { name: "证据快照", exact: true }).click();
    await expect(page.getByRole("heading", { name: /每一个结论/ })).toBeVisible();
    await page.goto(baselineReportUrl);
  });

  let experimentUrl = "";
  await test.step("从提及缺口创建并发布增长实验", async () => {
    const mentionGap = page.locator(".opportunity-card").filter({ hasText: "提及缺口" }).first();
    await expect(mentionGap).toBeVisible();
    await mentionGap.getByRole("button", { name: "创建增长实验" }).click();

    await expect(page).toHaveURL(/\/dashboard\/experiments\//);
    experimentUrl = page.url();
    await expect(page.locator(".experiment-stamps")).toContainText("行动草案");
    await expect(page.locator(".experiment-stamps")).toContainText("模拟演示数据");
    await expect(page.locator(".experiment-panel > .simulation-disclaimer")).toHaveText(
      "仅用于体验闭环，不代表真实 AI 表现",
    );

    await page.getByRole("textbox", { name: "行动计划" }).fill(
      "发布包含适用场景、客户证据和清晰品牌信息的完整采购指南。",
    );
    await page.getByRole("textbox", { name: "目标网址" }).fill(
      `https://${brandWebsite}/ai-brand-guide`,
    );
    await page.getByRole("button", { name: "发布行动实验" }).click();

    await expect(page.locator(".experiment-stamps")).toContainText("行动执行中");
    await expect(page.getByRole("button", { name: "开始验证" })).toBeVisible();
  });

  await test.step("基线余额不足时拒绝验证并引导付费", async () => {
    await page.getByRole("link", { name: "总览" }).click();
    const quotaCard = page.locator("article").filter({ hasText: "剩余额度" });
    await expect(quotaCard.getByText("10", { exact: true })).toBeVisible();

    await page.goto(experimentUrl);
    const rejectedVerification = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && /\/api\/experiments\/[^/]+\/verify$/.test(new URL(response.url()).pathname)
    ));
    await page.getByRole("button", { name: "开始验证" }).click();
    expect((await rejectedVerification).status()).toBe(402);
    await expect(page.getByRole("status")).toContainText("额度不足，本次需要 20 次");
    await expect(page).toHaveURL(experimentUrl);
    await expect(page.getByRole("link", { name: "查看套餐与额度" })).toBeVisible();
  });

  await test.step("从原实验的额度入口购买基础版并真实到账", async () => {
    await page.getByRole("link", { name: "查看套餐与额度" }).click();
    await expect(page.locator(".billing-page > header")).toContainText("剩余 10 次 AI 回答");

    const starterCard = page.locator('[data-plan-code="STARTER"]');
    await expect(starterCard).toContainText("基础版");
    await expect(starterCard).toContainText("¥99");
    await starterCard.getByRole("button", { name: "选择此套餐" }).click();
    await starterCard.getByRole("button", { name: "确认本地模拟支付" }).click();

    await expect(page.locator(".billing-page > header")).toContainText("当前套餐：基础版");
    await expect(page.locator(".billing-page > header")).toContainText("剩余 510 次 AI 回答");
    await expect(page.locator(".order-list").getByText("已支付").first()).toBeVisible();
  });

  await test.step("用户手动复扫并看到可追溯的提升证据", async () => {
    await page.goto(experimentUrl);
    await expect(page.getByRole("button", { name: "开始验证" })).toBeVisible();
    await page.getByRole("button", { name: "开始验证" }).click();

    await expect(page.locator(".experiment-stamps")).toContainText("已验证提升", { timeout: 30_000 });
    await expect(page.locator(".experiment-result-summary")).toContainText("验证有效");
    await expect(page.locator(".experiment-deltas article")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "查看基线报告" })).toBeVisible();

    const followUpReport = page.getByRole("link", { name: "查看复扫报告" });
    await expect(followUpReport).toBeVisible();
    await followUpReport.click();
    await expect(page).toHaveURL(/\/dashboard\/scans\//);
    await expect(page.locator(".report-mode-stamp")).toHaveText("模拟演示数据");
    await expect(page.locator(".report-disclaimer")).toHaveText("仅用于体验闭环，不代表真实 AI 表现");
    await expect(page.getByRole("heading", { name: "每一个结论，都能回到原始回答" })).toBeVisible();
  });

  await test.step("验证复扫按固定配置再扣 20 次额度", async () => {
    await page.getByRole("link", { name: "套餐与额度" }).click();
    await expect(page.locator(".billing-page > header")).toContainText("当前套餐：基础版");
    await expect(page.locator(".billing-page > header")).toContainText("剩余 490 次 AI 回答");
  });
});
