# GeoScore SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向国内用户、可在本地完整验证注册、登录、品牌扫描、评分、购买套餐、支付回调、权益发放和持续监测的 GEO SaaS。

**Architecture:** 使用 Next.js App Router 同时承载页面和 Route Handlers，PostgreSQL 保存业务事实，Prisma 7 提供类型安全访问，Better Auth 管理邮箱密码会话。短信、AI 平台和支付均通过接口适配器隔离；本地适配器提供确定性端到端验证，生产适配器必须保存真实第三方请求标识并验证回调签名。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS 4、PostgreSQL 16、Prisma 7、Better Auth、Zod、Vitest、Playwright、PAYJS、阿里云号码认证服务、DeepSeek API。

---

### Task 1: 工程基线

**Files:**
- Create: `package.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`

- [ ] 使用 `create-next-app` 生成 TypeScript、App Router、Tailwind、ESLint 和 `src` 目录工程。
- [ ] 安装 Prisma、Better Auth、Zod、Vitest、Testing Library 和 Playwright。
- [ ] 添加 `lint`、`typecheck`、`test`、`test:e2e`、`build`、`db:migrate`、`db:seed` 脚本。
- [ ] 编写首页冒烟测试并确认首次因页面内容缺失而失败。
- [ ] 实现中文首页最小结构并确认测试转绿。
- [ ] 运行 `npm run lint && npm run typecheck && npm test`，预期退出码均为 0。

### Task 2: 数据库与业务模型

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/plans.ts`
- Create: `prisma/seed.ts`
- Test: `src/lib/plans.test.ts`

- [ ] 先写套餐额度和价格测试，覆盖 FREE、STARTER、PRO、BUSINESS。
- [ ] 定义 Better Auth 所需用户、会话、账户和验证表。
- [ ] 定义 Brand、BrandAlias、Competitor、Prompt、Scan、Observation、Mention、Citation、ScoreSnapshot、RiskFinding 和 Recommendation。
- [ ] 定义 Plan、Order、Subscription、QuotaAccount 和 QuotaLedger，金额统一使用人民币分。
- [ ] 为订单号、第三方订单号、支付回调和额度流水设置唯一约束。
- [ ] 创建迁移并执行 seed，预期数据库存在四档套餐。

### Task 3: 邮箱密码与会话认证

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/proxy.ts`
- Test: `src/app/(auth)/auth-flow.test.tsx`

- [ ] 先写注册字段校验、错误提示和登录跳转测试并确认失败。
- [ ] 配置 Better Auth 的邮箱密码、8 位密码下限和数据库适配器。
- [ ] 实现中文注册、登录和退出界面。
- [ ] 服务端对控制台页面执行真实会话校验，未登录跳转登录页。
- [ ] 集成测试验证注册后数据库存在用户和会话，退出后会话失效。

### Task 4: 中国大陆手机号登录

**Files:**
- Create: `src/server/sms/types.ts`
- Create: `src/server/sms/mock-provider.ts`
- Create: `src/server/sms/aliyun-provider.ts`
- Create: `src/app/api/sms/send/route.ts`
- Create: `src/app/api/sms/verify/route.ts`
- Test: `src/server/sms/sms.test.ts`

- [ ] 先写手机号格式、60 秒发送冷却、每日限额、验证码过期和一次性消费测试。
- [ ] 实现开发模式固定测试验证码和哈希存储，响应不得返回生产验证码。
- [ ] 实现阿里云 `SendSmsVerifyCode` 与 `CheckSmsVerifyCode` 服务端适配器。
- [ ] 验证手机号成功后创建或绑定用户，并建立会话。
- [ ] 对发送接口加入 IP 与手机号双维度限流。

### Task 5: 品牌创建与问题生成

**Files:**
- Create: `src/app/(dashboard)/dashboard/brands/page.tsx`
- Create: `src/app/api/brands/route.ts`
- Create: `src/app/api/brands/[id]/route.ts`
- Create: `src/server/brands/service.ts`
- Create: `src/server/prompts/generator.ts`
- Test: `src/server/brands/service.test.ts`

- [ ] 先写租户隔离、官网规范化、别名去重和竞品去重测试。
- [ ] 实现品牌增删改查并强制所有查询绑定当前用户 ID。
- [ ] 根据行业、产品和目标客户生成发现、痛点、对比、购买四类非品牌问题。
- [ ] 用户可确认、编辑、禁用问题，修改后生成新的 PromptVersion。
- [ ] 免费用户限制一个品牌并返回可理解的升级提示。

### Task 6: 扫描适配器与原始证据

**Files:**
- Create: `src/server/ai/types.ts`
- Create: `src/server/ai/mock-provider.ts`
- Create: `src/server/ai/deepseek-provider.ts`
- Create: `src/server/scans/service.ts`
- Create: `src/app/api/scans/route.ts`
- Create: `src/app/api/scans/[id]/execute/route.ts`
- Test: `src/server/scans/service.test.ts`

- [ ] 先写配额不足、重复执行、失败重试和原始回答不可变测试。
- [ ] Mock 适配器基于输入生成确定性回答、品牌排名、情感和引用，用于本地 E2E。
- [ ] DeepSeek 适配器调用真实 API，并明确平台 ID 只能是 `deepseek`。
- [ ] 执行扫描前原子预扣额度，失败时返还，成功时写入额度流水。
- [ ] 保存平台、模型、问题版本、时间、原始回答、引用和第三方请求 ID。

### Task 7: 评分、置信度与风险

**Files:**
- Create: `src/domain/scoring/calculate.ts`
- Create: `src/domain/scoring/confidence.ts`
- Create: `src/domain/scoring/risk.ts`
- Test: `src/domain/scoring/calculate.test.ts`

- [ ] 先写五项权重总分测试，使用 `30/25/20/15/10` 权重。
- [ ] 写推荐强度、排名折损、公平声量、引用来源质量和情感系数边界测试。
- [ ] 计算样本、平台覆盖和重复一致性置信度；不足 120 条标记初步评分。
- [ ] 重大事实错误将品牌风险标红并把最终分数上限设为 59。
- [ ] 每次算法执行写入不可变 ScoreSnapshot 和算法版本。

### Task 8: 报告与控制台

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/dashboard/brands/[id]/page.tsx`
- Create: `src/app/(dashboard)/dashboard/scans/[id]/page.tsx`
- Create: `src/components/dashboard/sidebar.tsx`
- Create: `src/components/score/score-card.tsx`
- Create: `src/components/score/evidence-list.tsx`
- Test: `src/components/score/score-card.test.tsx`

- [ ] 先写总分、置信度、风险和原始证据渲染测试。
- [ ] 实现总览、五项分数、平台对比、竞品声量、遗漏问题、引用和建议。
- [ ] 所有结论可以展开查看原始回答，不用不可解释的装饰图代替证据。
- [ ] 响应式验证 390px、768px 和 1440px 三种宽度。

### Task 9: 套餐、订单与支付

**Files:**
- Create: `src/server/payments/types.ts`
- Create: `src/server/payments/signature.ts`
- Create: `src/server/payments/mock-provider.ts`
- Create: `src/server/payments/payjs-provider.ts`
- Create: `src/server/orders/service.ts`
- Create: `src/app/api/orders/route.ts`
- Create: `src/app/api/payments/payjs/notify/route.ts`
- Create: `src/app/api/payments/mock/complete/route.ts`
- Create: `src/app/(dashboard)/dashboard/billing/page.tsx`
- Test: `src/server/orders/service.test.ts`

- [ ] 先写金额防篡改、签名验证、重复回调、错单金额和跨用户订单查询测试。
- [ ] 订单金额只能由服务端套餐表生成，前端不得提交可信金额。
- [ ] 实现 PAYJS 参数排序、MD5 大写签名、扫码下单、通知验签和订单查询。
- [ ] 支付回调在一个事务中完成订单支付、订阅更新和额度发放。
- [ ] Mock 支付复用同一履约服务，Playwright 可完成真实页面链路。

### Task 10: 端到端验收与上线准备

**Files:**
- Create: `e2e/full-journey.spec.ts`
- Create: `e2e/security.spec.ts`
- Create: `docs/deployment.md`
- Create: `docs/acceptance-checklist.md`

- [ ] Playwright 完成注册、登录、建品牌、生成问题、扫描、查看报告、购买套餐、支付和额度增加。
- [ ] 验证未登录保护、跨租户访问拒绝、支付回调伪造拒绝和额度不能超扣。
- [ ] 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e` 和 `npm run build`。
- [ ] 使用 PostgreSQL 查询核对用户、订单、订阅、额度、品牌、扫描和评分均有真实持久化记录。
- [ ] 文档列出部署前必须提供的域名备案、短信和 PAYJS 凭据，任何缺失项不得标记生产就绪。

