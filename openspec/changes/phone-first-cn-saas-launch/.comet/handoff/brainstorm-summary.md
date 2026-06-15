# Brainstorm Summary

- Change: phone-first-cn-saas-launch
- Date: 2026-06-15

---

## Confirmed Technical Approach

10 个关键设计决策（用户已确认）：

### 1. 验证码服务架构
扩展现有 `VerificationToken` 表，加 `channel` / `purpose` / `attempts` / `consumed` 字段。统一 `VerificationService.send/verify/consume` 接口。进程内 Map 限流。

### 2. 支付通道调度
默认虎皮椒，PayJS 作为 UI 备选。`PaymentRouter` 工厂模式，支付页提供「切换通道」按钮。1 行配置切默认通道。

### 3. Onboarding 状态机
4 步可跳过（不强制走完），状态存 `User.onboardingStep`，Sidebar 始终有「继续引导」入口。跳过 = 写 `onboardingSkippedAt`。

### 4. 试用机制
暂不做 PRO 试用，FREE 计划即用即测。高级功能（Gap/Content/Forecast）必须付费。PRO 试用留 v2.1。

### 5. Session / Token 策略
复用 NextAuth 默认 JWT 30 天，不自创 token。`middleware.ts` 统一保护。

### 6. 邮件降级
邮件失败不阻塞注册。失败时 log + 提示「用手机号登录」。retry 队列留 v2.1。

### 7. 支付回调
客户端轮询（5s/次，2 分钟超时）+ 用户主动「我已支付」按钮触发 query。不引入 SSE。

### 8. 用户软删除
v1 不实现，客服工单处理。数据保留 ≥1 年。

### 9. 错误处理
业务 throw → 统一中间件 → 标准 JSON `{ code, message }`。前端 toast。Sentry 留 v2.1。

### 10. 测试策略
单测关键服务（verification/payment/subscription）+ 手动 E2E 5 主路径。详细自动化测试 v2.1。

---

## Key Trade-offs and Risks

| 决策 | 取舍 | 风险 | 缓解 |
|---|---|---|---|
| 进程内限流 | 简单 | 重启丢状态 | 接受（单用户量） |
| 扩展 VerificationToken | 复用 | 表变大 | 加索引 |
| 不做 PRO 试用 | 简化 | 转化率低 | 看数据决定 v2.1 |
| 轮询支付状态 | 简单 | 实时性差 | 用户主动按钮兜底 |
| 不实现软删除 | 简化 | 合规风险 | 客服工单 + 1 年保留 |
| 不做 SSE | 简化 | 体验略差 | 5s 轮询 + 2 分钟兜底 |
| 不接 Sentry | 简化 | 错误难追 | 业务日志够 MVP |

---

## Testing Strategy

**单测范围**：
- `VerificationService`：send/verify/限流/consume
- `PaymentRouter`：通道路由 + 验签 mock
- `SubscriptionService`：订阅生命周期
- `OnboardingService`：状态机推进

**E2E 手动跑通**：
1. 手机号注册 → 验证 → 登录 → Onboarding 全 4 步 → Dashboard
2. 选套餐 → 虎皮椒沙箱支付 → 订阅生效 + 邮件
3. PayJS 沙箱支付兜底
4. 密码重置全流程
5. 边界：限流、验证码锁定、支付失败重试

**不做**：
- Playwright 自动化（v2.1）
- Sentry 集成（v2.1）
- 性能 / 压力测试（用户量起来再做）

---

## Spec Patches

无。当前 OpenSpec 提案 / 设计 / 任务已完整覆盖设计要点，无需 patch。

---

## 模块边界（最终）

| 单元 | 职责 | 依赖 |
|---|---|---|
| `VerificationService` | 验证码生命周期 | DB + SMS/Email |
| `AuthService` | 注册/登录/重置编排 | VerificationService + User |
| `PaymentRouter` | 通道路由 + 验签 | 各通道实现 |
| `SubscriptionService` | 订阅生命周期 | Order + Payment + User |
| `OnboardingService` | 状态机推进 | User |
| `EmailService` | 邮件统一发送 | 阿里云 DM SDK + 模板 |
| `SmsService` | 短信统一发送 | 阿里云 dysms SDK |

---

## 风险登记

| ID | 风险 | 等级 | 缓解 | 状态 |
|---|---|---|---|---|
| R1 | 虎皮椒审核拖延 | 中 | PayJS 兜底 | 接受 |
| R2 | 阿里云 DM 开通慢 | 低 | 注册不依赖邮件 | 接受 |
| R3 | 验证码被刷 | 中 | 限流 + 5 次锁定 | 缓解 |
| R4 | 支付回调丢失 | 中 | expiredAt + 主动 query | 缓解 |
| R5 | Prisma schema 变更影响 seed | 低 | 同步更新 seed | 计划内 |
| R6 | 进程内限流重启清空 | 低 | 单用户量可接受 | 接受 |
| R7 | 邮件 DM 配额超限 | 低 | 模板短 + 异步 | 接受 |
