# AI 推荐抢位实验 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 GeoScore 从单次评分报告升级为可完成“可信扫描、抢位机会、行动实验、复扫验证、趋势回看”的本地可运行产品 V1。

**Architecture:** 保留现有 `PromptVersion → Scan → Observation → ScoreSnapshot` 证据链，在扫描完成阶段通过纯函数生成问题级机会，再以 `OptimizationExperiment` 连接基线扫描和复测扫描。服务端负责所有权限、额度、状态与增量计算；React 服务端页面负责聚合展示，客户端组件只发起受控动作。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Prisma 7、PostgreSQL、Better Auth、Vitest、Testing Library、Playwright、Tailwind CSS 4。

---

### Task 1: 建立可信扫描与增长闭环数据模型

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713090000_growth_loop_v1/migration.sql`
- Modify: `src/server/ai/types.ts`
- Modify: `src/server/ai/index.ts`
- Create: `src/server/ai/providers.test.ts`
- Modify: `src/server/prompts/generator.ts`
- Modify: `src/server/brands/service.test.ts`

- [ ] **Step 1: 写平台注册表与 20 问题的失败测试**

```ts
expect(listAiProviders({ AI_PROVIDER: "mock" })).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: "mock", dataMode: "SIMULATED", available: true }),
]));
expect(generateBrandPrompts(input)).toHaveLength(20);
```

- [ ] **Step 2: 运行测试并确认因缺少注册表、问题数为 10 而失败**

Run: `npm test -- src/server/ai/providers.test.ts src/server/brands/service.test.ts`
Expected: FAIL，指出 `listAiProviders` 不存在或问题数量不匹配。

- [ ] **Step 3: 增加平台元数据和 20 个分阶段高意图问题**

```ts
export type AiProviderDescriptor = {
  id: string;
  name: string;
  dataMode: "REAL" | "SIMULATED";
  available: boolean;
  unavailableReason?: string;
};
```

- [ ] **Step 4: 扩展 Prisma 数据模型**

新增 `ScanDataMode`、`OpportunityType`、`OpportunityStatus`、`ExperimentStatus` 枚举，新增 `Opportunity`、`OptimizationExperiment` 模型；为 `Scan` 增加 `repeatCount Int @default(1)`、`dataMode ScanDataMode @default(REAL)`、`verificationExperimentId String?`；为 `Recommendation` 和 `RiskFinding` 增加可选 `scanId` 关联。

- [ ] **Step 5: 生成 Prisma 客户端并运行定向测试**

Run: `npm run db:generate && npm test -- src/server/ai/providers.test.ts src/server/brands/service.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add prisma src/server/ai src/server/prompts src/server/brands/service.test.ts
git commit -m "feat: 建立推荐增长闭环数据模型"
```

### Task 2: 通过测试驱动生成问题级抢位机会

**Files:**
- Create: `src/domain/opportunities/build-opportunities.ts`
- Create: `src/domain/opportunities/build-opportunities.test.ts`
- Modify: `src/server/scans/service.ts`
- Modify: `src/server/scans/service.test.ts`

- [ ] **Step 1: 写机会生成纯函数的失败测试**

```ts
const result = buildOpportunities({
  brandName: "GeoScore",
  observations: [{ promptVersionId: "p1", promptText: "GEO 工具有哪些？", platformId: "deepseek", rawResponse: "推荐竞品甲", targetMention: null, competitorMentions: ["竞品甲"], officialCitation: null }],
});
expect(result.map((item) => item.type)).toEqual(expect.arrayContaining(["MENTION_GAP", "COMPETITOR_ADVANTAGE"]));
expect(result[0].evidence).toContain("推荐竞品甲");
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npm test -- src/domain/opportunities/build-opportunities.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现机会分类、优先级和去重**

输出包含 `type`、`priority`、`title`、`summary`、`evidence`、`recommendedAction` 与 `targetContentType`，并限制证据长度，避免把完整大模型回答重复写入机会表。

- [ ] **Step 4: 在扫描完成事务中保存扫描级建议、风险和机会**

扫描循环支持 `repeatCount`，真实写入 `runIndex`。完成分析后使用 `createMany({ skipDuplicates: true })` 保存机会，并让 `Recommendation.scanId`、`RiskFinding.scanId` 指向当前扫描。

- [ ] **Step 5: 更新扫描集成测试，验证重复采样、机会证据和历史隔离**

Run: `npm test -- src/domain/opportunities/build-opportunities.test.ts src/server/scans/service.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/domain/opportunities src/server/scans
git commit -m "feat: 生成问题级竞品抢位机会"
```

### Task 3: 实现增长实验与复扫增量计算

**Files:**
- Create: `src/domain/experiments/calculate-experiment-result.ts`
- Create: `src/domain/experiments/calculate-experiment-result.test.ts`
- Create: `src/server/experiments/service.ts`
- Create: `src/server/experiments/service.test.ts`
- Create: `src/app/api/opportunities/[id]/experiment/route.ts`
- Create: `src/app/api/experiments/[id]/route.ts`
- Create: `src/app/api/experiments/[id]/verify/route.ts`
- Modify: `src/server/scans/service.ts`
- Modify: `src/server/ai/mock-provider.ts`

- [ ] **Step 1: 写前后扫描增量计算的失败测试**

```ts
expect(calculateExperimentResult({
  baseline: { score: 42, mentioned: 0, recommendation: 0, cited: 0 },
  followUp: { score: 58, mentioned: 1, recommendation: 0.85, cited: 1 },
})).toMatchObject({ scoreDelta: 16, mentionDelta: 100, verified: true });
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npm test -- src/domain/experiments/calculate-experiment-result.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现增量计算与实验状态机**

服务提供 `createExperimentForUser`、`publishExperimentForUser`、`verifyExperimentForUser`。所有查询必须带 `brand.ownerId=userId`；复测状态用条件更新从 `ACTIVE` 锁到 `VERIFYING`，失败恢复到 `ACTIVE`。

- [ ] **Step 4: 复测复用基线平台、重复次数和问题版本**

`verifyExperimentForUser` 创建验证扫描并执行；只统计机会对应问题的基线/复测指标，同时保存全局 GeoScore 增量。模拟平台只在 `dataMode=SIMULATED` 时使用实验上下文生成确定性提升，并保留模拟标签。

- [ ] **Step 5: 实现三个鉴权 API 并写服务集成测试**

Run: `npm test -- src/domain/experiments/calculate-experiment-result.test.ts src/server/experiments/service.test.ts src/server/scans/service.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/domain/experiments src/server/experiments src/server/scans src/server/ai/mock-provider.ts src/app/api/opportunities src/app/api/experiments
git commit -m "feat: 打通行动实验与复扫验证"
```

### Task 4: 构建趋势化品牌工作台和行动界面

**Files:**
- Create: `src/components/growth/score-trend.tsx`
- Create: `src/components/growth/opportunity-card.tsx`
- Create: `src/components/growth/experiment-panel.tsx`
- Create: `src/components/growth/growth-components.test.tsx`
- Create: `src/app/(dashboard)/dashboard/experiments/[id]/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/brands/[id]/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/scans/[id]/page.tsx`
- Modify: `src/components/scans/start-scan-button.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 写趋势、模拟标识、机会动作和实验状态组件的失败测试**

```tsx
render(<OpportunityCard opportunity={fixture} />);
expect(screen.getByText("竞品正在抢占这个购买问题")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "创建抢位实验" })).toBeEnabled();
```

- [ ] **Step 2: 运行测试并确认组件不存在而失败**

Run: `npm test -- src/components/growth/growth-components.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现行动组件和实验详情页**

采用现有纸张、深墨绿和荧光黄的“编辑部作战板”视觉；机会卡突出问题、竞品、证据和下一步，不使用通用渐变卡片。按钮显示加载、成功和中文错误状态。

- [ ] **Step 4: 重构品牌页和控制台查询**

品牌页查询最近 8 次扫描、开放机会和实验；展示趋势、环比、机会优先级及进行中实验。控制台统计开放机会、活跃实验和已验证实验。报告页只读取当前扫描关联的建议、风险和机会。

- [ ] **Step 5: 扫描按钮展示可用平台、真实/模拟标签和重复次数**

客户端从 `/api/ai/providers` 读取描述；不可用平台不允许提交。请求体扩展为 `{ brandId, platforms, repeatCount }`。

- [ ] **Step 6: 运行组件测试、类型检查与可访问性冒烟测试**

Run: `npm test -- src/components/growth/growth-components.test.tsx && npm run typecheck`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/components src/app
git commit -m "feat: 构建推荐增长行动工作台"
```

### Task 5: 重构首页、套餐和完整用户旅程

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/plans.ts`
- Modify: `src/lib/plans.test.ts`
- Modify: `src/app/(dashboard)/dashboard/billing/page.tsx`
- Modify: `e2e/full-journey.spec.ts`
- Modify: `docs/product-design.md`
- Modify: `docs/acceptance-checklist.md`

- [ ] **Step 1: 写结果导向套餐的失败测试**

```ts
expect(PLAN_CATALOG.STARTER.features).toEqual(expect.arrayContaining([
  "问题级抢位机会",
  "增长实验与手动同配置复测",
]));
```

- [ ] **Step 2: 运行测试并确认旧套餐文案不满足要求**

Run: `npm test -- src/lib/plans.test.ts`
Expected: FAIL。

- [ ] **Step 3: 重写首页和套餐价值表达**

首页主标题改为“把 AI 没有推荐你的原因，变成可以执行和验证的增长任务”，重点展示抢位机会、行动实验和复测证据。价格继续使用当前可支付金额，但外部卖点从回答次数切换为品牌数、问题级抢位机会、增长实验、扫描历史与实验归因；回答额度只作为次级容量说明。

- [ ] **Step 4: 扩展 Playwright 全链路**

覆盖注册登录、创建品牌、模拟扫描、查看机会、创建实验、填写目标 URL、标记发布、用户点击发起同配置复扫、查看结果和核对额度流水；断言所有模拟数据都有清晰标签。模拟实验可立即手动验证，真实实验需要等待观察窗口，但两者都不得由系统自动发起。

- [ ] **Step 5: 更新产品与验收文档**

记录真实/模拟边界、增长实验状态、正式评分门槛、付费价值和完整本地演示步骤；明确 V1 不包含自动调度、发布后自动复测、团队协作和报告导出。

- [ ] **Step 6: 运行完整验证**

Run: `npm test && npm run typecheck && npm run lint && npm run build && PLAYWRIGHT_PORT=18202 npm run test:e2e`
Expected: 所有命令退出码为 0。

- [ ] **Step 7: 提交**

```bash
git add src/app src/lib e2e docs
git commit -m "feat: 完成推荐增长产品闭环"
```

### Task 6: 数据迁移、本地验收和主分支交付

**Files:**
- Modify if required: `.env.example`
- Modify: `docs/deployment.md`

- [ ] **Step 1: 在本地 PostgreSQL 应用迁移并检查状态**

Run: `npm run db:deploy && npx prisma migrate status`
Expected: 所有迁移已应用，数据库结构为最新。

- [ ] **Step 2: 运行交付前完整验证并保存输出证据**

Run: `npm test && npm run typecheck && npm run lint && npm run build && PLAYWRIGHT_PORT=18202 npm run test:e2e`
Expected: 全部退出码为 0。

- [ ] **Step 3: 合并功能分支回 `main`**

```bash
git checkout main
git merge --no-ff codex/ai-recommendation-growth-v1
```

- [ ] **Step 4: 在主目录重新运行关键验证**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全部退出码为 0。

- [ ] **Step 5: 在 18200 端口启动并执行 HTTP 与浏览器验收**

Run: `npm run dev -- -p 18200`
Expected: 首页、登录页、控制台、品牌页、扫描报告和实验页均可访问；完整模拟闭环可操作；手机号测试验证码为 `888888`。
