# 实验恢复与结果归因加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让扫描与实验验证在进程崩溃、外部请求超时和重复请求下可安全恢复，并保证结果只归因给同算法、同动作版本和同目标问题风险。

**Architecture:** PostgreSQL 保存扫描与实验的随机 token lease，所有接管、续租、观察写入、终态提交和失败回滚都以 token 做 CAS。扫描恢复以 `promptVersionId + platformId + runIndex` 为逻辑槽位，只补齐缺失回答，再从完整持久化观察重建全部派生产物；实验恢复复用同配置、同动作 revision 的扫描，并在归因前复核评分算法版本。纯函数只接收目标问题风险，非风险实验不能靠风险消失成功，新风险会否决正向指标。

**Tech Stack:** Next.js 16、TypeScript、Prisma 7、PostgreSQL、Vitest、DeepSeek HTTP API。

---

### Task 1: 增加 lease 与动作版本数据结构

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260714090000_execution_leases_action_revision/migration.sql`
- Create: `prisma/migrations/20260714091500_backfill_verification_action_revision/migration.sql`
- Create: `src/server/scans/lease-schema.test.ts`

- [ ] **Step 1: 写迁移字段失败测试**

测试通过 PostgreSQL catalog 断言 `Scan` 存在 `executionLeaseToken`、`executionLeaseExpiresAt`、`verificationAttemptToken`、`verificationActionRevision`，`OptimizationExperiment` 存在 `verificationLeaseToken`、`verificationLeaseExpiresAt`、`actionRevision`。

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/server/scans/lease-schema.test.ts`
Expected: FAIL，指出 lease/revision 列不存在。

- [ ] **Step 3: 增加模型与独立迁移**

```prisma
model Scan {
  executionLeaseToken       String?
  executionLeaseExpiresAt   DateTime?
  verificationAttemptToken  String?
  verificationActionRevision Int?
  @@index([status, executionLeaseExpiresAt])
}

model OptimizationExperiment {
  actionRevision             Int       @default(0)
  verificationLeaseToken     String?
  verificationLeaseExpiresAt DateTime?
  @@index([status, verificationLeaseExpiresAt])
}
```

首个迁移把历史非 `DRAFT` 实验回填为 revision 1，历史草稿保持 0；所有 lease 字段允许空值。紧随其后的独立 backfill 迁移按实验关联把历史验证扫描的 `verificationActionRevision` 补齐，避免升级后重复扣费。

- [ ] **Step 4: 部署迁移、生成客户端并确认 GREEN**

Run: `npm run db:deploy && npm run db:generate && npm test -- src/server/scans/lease-schema.test.ts`
Expected: PASS。

### Task 2: 为 DeepSeek 请求增加可测试超时

**Files:**
- Modify: `src/server/ai/deepseek-provider.ts`
- Modify: `src/server/ai/providers.test.ts`

- [ ] **Step 1: 写 AbortSignal 超时失败测试**

```ts
const provider = new DeepSeekProvider("test-key", "https://deepseek.test", 10);
await expect(provider.query(input)).rejects.toThrow("DeepSeek 请求超时");
expect(fetchInit.signal).toBeInstanceOf(AbortSignal);
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/server/ai/providers.test.ts`
Expected: FAIL，fetch 没有 signal 且请求不会自行超时。

- [ ] **Step 3: 用 AbortController 实现默认 30 秒超时**

请求超时抛中文错误，`finally` 清理定时器；现有请求体继续只包含系统提示和原始问题，不包含品牌、实验或动作信息。

- [ ] **Step 4: 运行定向测试确认 GREEN**

Run: `npm test -- src/server/ai/providers.test.ts`
Expected: PASS，且不访问真实网络。

### Task 3: 实现扫描 lease、接管和持久化续跑

**Files:**
- Modify: `src/server/scans/service.ts`
- Modify: `src/server/scans/service.test.ts`

- [ ] **Step 1: 写扫描恢复失败测试**

覆盖：活跃 `RUNNING` lease 拒绝；过期 lease 接管；已有一个逻辑槽位时只补剩余槽位；旧 worker 在远端返回后因 token 丢失不能写观察、不能 finalize、不能置 `FAILED` 或退款。

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/server/scans/service.test.ts`
Expected: FAIL，当前 `RUNNING` 永久拒绝且结果仅使用内存样本。

- [ ] **Step 3: 实现 token CAS 与 heartbeat**

```ts
const claimed = await db.scan.updateMany({
  where: {
    id: scanId,
    OR: [
      { status: "PENDING" },
      { status: "RUNNING", executionLeaseExpiresAt: null },
      { status: "RUNNING", executionLeaseExpiresAt: { lte: now } },
    ],
  },
  data: {
    status: "RUNNING",
    executionLeaseToken: token,
    executionLeaseExpiresAt: leaseExpiry,
  },
});
```

每次 provider 调用前后续租；验证扫描在同一事务中按 `verificationAttemptToken` 续实验 lease。观察写入和最终产物事务再次校验 token。失去 lease 抛专用错误且不改状态、不退款；只有当前 owner 的真实失败才能 `FAILED` 并触发幂等退款。

- [ ] **Step 4: 从数据库重建完整结果**

按固定问题、平台、轮次枚举逻辑槽位，跳过已有观察，只查询缺失槽位；最后重新读取 observation + mention + citation + promptVersion，并从完整持久化集合计算评分、置信度、机会、风险和建议。

- [ ] **Step 5: 运行扫描测试确认 GREEN**

Run: `npm test -- src/server/scans/service.test.ts`
Expected: PASS。

### Task 4: 动作 revision、算法门禁和实验 lease 恢复

**Files:**
- Modify: `src/server/scans/service.ts`
- Modify: `src/server/experiments/service.ts`
- Modify: `src/server/experiments/service.test.ts`

- [ ] **Step 1: 写动作版本和算法版本失败测试**

覆盖首次发布 revision=1；完全相同 ACTIVE PATCH 不递增；动作或 URL 变化原子递增；验证扫描 revision 由服务写入；旧 revision completed 候选被忽略；基线或候选算法版本不一致时拒绝/忽略且不错误扣费归因。

- [ ] **Step 2: 写实验崩溃点恢复失败测试**

覆盖过期 `VERIFYING` 在无扫描、PENDING 扫描、部分 observation 的过期 RUNNING 扫描、COMPLETED 未归因扫描四处恢复；活跃 lease 的并发请求保持 `VERIFYING`；复用已有扫描时不二次扣费。

- [ ] **Step 3: 写真实数据复查时间门禁失败测试**

SIMULATED 发布后立即复扫继续成功；REAL 且 `nextCheckAt > now` 中文拒绝，实验保持 ACTIVE，额度和 scan 数不变。

- [ ] **Step 4: 运行实验服务测试确认 RED**

Run: `npm test -- src/server/experiments/service.test.ts`
Expected: FAIL。

- [ ] **Step 5: 实现实验 token lease 与 revision**

ACTIVE 以 token 原子进入 VERIFYING；VERIFYING 仅在 lease 为空或过期时接管。恢复时优先选择同配置、同 `verificationActionRevision` 的 completed/pending/expired-running 扫描，非终态扫描改绑新 attempt token 后续跑。catch 只有当前 lease token owner 才能恢复 ACTIVE。

- [ ] **Step 6: 实现算法和时间门禁**

任何新扫描扣费前要求 baseline `algorithmVersion === SCORING_VERSION`；候选 completed 和最终归因也要求两侧均为当前版本。REAL 数据未到 `nextCheckAt` 拒绝，SIMULATED 不受限制。

- [ ] **Step 7: 运行实验测试确认 GREEN**

Run: `npm test -- src/server/experiments/service.test.ts`
Expected: PASS。

### Task 5: 只按目标问题归因风险

**Files:**
- Modify: `src/domain/experiments/calculate-experiment-result.ts`
- Modify: `src/domain/experiments/calculate-experiment-result.test.ts`
- Modify: `src/server/experiments/service.ts`

- [ ] **Step 1: 写风险归因失败测试**

```ts
expect(calculateExperimentResult({
  baseline: unchanged,
  followUp: unchanged,
  baselineRisk: true,
  followUpRisk: false,
  riskResolutionEligible: false,
}).verified).toBe(false);
```

另覆盖目标新风险即使指标提升仍失败，以及 BRAND_RISK 机会风险解除可以单独成功。

- [ ] **Step 2: 运行纯函数测试确认 RED**

Run: `npm test -- src/domain/experiments/calculate-experiment-result.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现风险资格与新风险否决**

仅 `riskResolutionEligible && baselineRisk && !followUpRisk` 可作为成功条件；`!baselineRisk && followUpRisk` 否决正向指标并在摘要说明新风险。

- [ ] **Step 4: 服务端改为查询目标 Opportunity 风险**

按 `scanId + opportunity.promptVersionId + opportunity.platformId + type=BRAND_RISK` 查询 baseline/follow-up 风险，不再使用全扫描 `RiskFinding.count`；只有当前实验机会类型为 `BRAND_RISK` 时传 `riskResolutionEligible=true`。

- [ ] **Step 5: 运行定向测试确认 GREEN**

Run: `npm test -- src/domain/experiments/calculate-experiment-result.test.ts src/server/experiments/service.test.ts`
Expected: PASS。

### Task 6: 全量验证与提交

**Files:**
- Verify all modified files

- [ ] **Step 1: 生成客户端、校验并部署迁移**

Run: `npm run db:generate && npx prisma validate && npm run db:deploy && npx prisma migrate status`
Expected: schema valid，数据库应用全部迁移。

- [ ] **Step 2: 运行质量门禁**

Run: `npm test && npm run typecheck && npm run lint && npm run build && git diff --check`
Expected: 全部退出码 0；DeepSeek 测试使用 stub，不访问真实外网。

- [ ] **Step 3: 提交**

```bash
git add prisma src docs/superpowers/plans/2026-07-14-experiment-recovery-hardening.md
git commit -m "fix: 加固实验恢复与结果归因"
```
