---
comet_change: phone-first-cn-saas-launch
role: technical-design
canonical_spec: openspec
---

# Phone-First CN SaaS Launch - Design Doc

> 面向国内单用户 SaaS 上线的技术设计。手机号优先注册 + 虎皮椒/PayJS 双通道 + 阿里云邮件推送 + 4 步 Onboarding。

---

## 1. Goals & Non-Goals

### Goals
- 手机号 + 短信验证码优先注册/登录
- 虎皮椒（主）+ PayJS（备）双通道支付
- 阿里云邮件推送：5 个核心场景
- 4 步 Onboarding 引导
- 个人中心完善：资料 / 安全 / 订阅 / 配额 / 订单
- 三件套法律文案

### Non-Goals
- 团队 / 多用户 / RBAC / SSO
- 多语言 i18n
- BullMQ 异步队列
- 数据库迁移规范
- 多平台 AI 接入（继续 DeepSeek）
- 移动 App / PWA
- 公开 API + Webhook

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                   │
│                                                              │
│  /login  /register  /forgot-password  /onboarding            │
│  /reset-password  /(legal)/*  /(dashboard)/settings/*       │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                       API Routes                             │
│                                                              │
│  /api/auth/           /api/billing/                          │
│   ├── send-code          ├── pay/[orderNo]                   │
│   ├── phone-login        ├── callback/{xunhupay,payjs,alipay,wechat} │
│   ├── verify-email       ├── refund                          │
│   ├── forgot             ├── orders                          │
│   ├── reset              ├── subscription                    │
│   └── update             └── cancel                          │
│  /api/user/me                                               │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Service Layer                           │
│                                                              │
│  src/lib/sms.ts                       阿里云 SMS              │
│  src/lib/email/                       阿里云邮件推送          │
│  src/lib/payment/                     支付通道（双通道）      │
│  src/lib/services/                    业务服务层              │
│    ├── auth.service.ts                                          │
│    ├── verification.service.ts                                 │
│    ├── subscription.service.ts                                 │
│    └── onboarding.service.ts                                   │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                       Data Layer                             │
│                                                              │
│  Prisma 7 + PostgreSQL                                       │
│  User (+phoneVerified/emailVerified/onboardingStep)         │
│  VerificationToken (+channel/purpose/attempts/consumed)      │
│  Subscription / Order / Payment (existing)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Module Design

每个单元一个清楚的目的、可独立测试、通过明确接口通信。

### 3.1 VerificationService

**职责**：统一管理 SMS / Email / Reset 三类验证码的发送、验证、失效。

**接口**：
```typescript
interface VerificationService {
  send(channel: 'sms' | 'email', target: string, purpose: Purpose): Promise<{ token: string; expiresAt: Date }>
  verify(channel: 'sms' | 'email', target: string, code: string, purpose: Purpose): Promise<{ valid: boolean; token?: VerificationToken }>
  consume(tokenId: string): Promise<void>
}

type Purpose = 'register' | 'login' | 'reset_password' | 'verify_email'
```

**存储**：扩展现有 `VerificationToken` 模型。

**限流**（进程内 Map）：
- 同一 target：1 次/分钟、10 次/小时、20 次/天
- 同一 IP：30 次/小时
- 尝试错误 5 次 → 锁定 1 小时

**风险**：进程崩溃限流状态丢失 → 接受（重启即清空）。

### 3.2 AuthService

**职责**：注册 / 登录 / 重置的编排，依赖 VerificationService + User model。

**接口**：
```typescript
interface AuthService {
  registerOrLoginByPhone(phone: string, code: string): Promise<{ user: User; isNew: boolean; token: string }>
  registerOrLoginByEmail(email: string, password: string): Promise<{ user: User; isNew: boolean; token: string }>
  verifyEmail(userId: string, code: string): Promise<void>
  requestPasswordReset(phone: string): Promise<void>
  resetPassword(phone: string, code: string, newPassword: string): Promise<void>
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
}
```

**关键设计**：
- 手机号登录合并注册 + 登录（"auto" 模式）
- 邮箱登录仅做登录（注册强制走手机号）
- 密码使用 `bcryptjs` 哈希

### 3.3 PaymentRouter

**职责**：多支付通道的统一路由、验签、回调处理。

**接口**：
```typescript
interface PaymentChannel {
  create(order: Order): Promise<{ payUrl: string; qrCode?: string; raw: any }>
  verifyCallback(payload: any, signature: string): boolean
  parseCallback(payload: any): { orderNo: string; paidAt: Date; externalId: string }
  query(orderNo: string): Promise<{ status: 'paid' | 'pending' | 'failed' }>
  refund(orderNo: string, reason: string): Promise<{ success: boolean }>
}

interface PaymentRouter {
  getChannel(channel: 'xunhupay' | 'payjs'): PaymentChannel
  create(order: Order, channel?: 'xunhupay' | 'payjs'): Promise<CreateResult>
  handleCallback(channel: string, payload: any, signature: string): Promise<{ ok: boolean; reason?: string }>
}
```

**通道实现**：
- `XunhupayChannel`：虎皮椒 API（参考 `xunhupay.com` 文档）
- `PayJsChannel`：保留现有 `payjs.ts`，适配统一接口

**默认策略**：虎皮椒（覆盖微信+支付宝）。PayJS 作为 UI 备选。配置文件 1 行切换。

### 3.4 SubscriptionService

**职责**：订阅的生命周期管理（创建 / 续期 / 过期 / 取消）。

**接口**：
```typescript
interface SubscriptionService {
  createSubscription(userId: string, plan: Plan, orderId: string): Promise<Subscription>
  renew(subscriptionId: string, orderId: string): Promise<Subscription>
  cancel(subscriptionId: string): Promise<void>
  expireOverdue(): Promise<number>  // cron 调用
  isActive(userId: string): Promise<boolean>
}
```

**关键**：
- 订阅创建 = `Subscription.upsert` + `User.plan` 同步
- 订阅过期 = `cron` 检查 `endDate < now()` 标记
- 取消 = 设置 `status: 'CANCELLED'` + `endDate: now()`

### 3.5 OnboardingService

**职责**：Onboarding 状态机推进。

**接口**：
```typescript
interface OnboardingService {
  getStep(userId: string): OnboardingStep
  advanceTo(userId: string, step: OnboardingStep): Promise<void>
  skip(userId: string): Promise<void>
  complete(userId: string): Promise<void>
  shouldShowOnboarding(userId: string): boolean
}

type OnboardingStep = 'not_started' | 'brand_pending' | 'prompt_pending' | 'scan_pending' | 'completed' | 'skipped'
```

**存储**：`User.onboardingStep` + `User.onboardingCompletedAt`

**跳过机制**：写 `onboardingStep: 'skipped'`，Sidebar 始终可重看。

### 3.6 EmailService

**职责**：阿里云邮件推送封装，5 个模板 + 统一发送。

**接口**：
```typescript
interface EmailService {
  send(template: EmailTemplate, to: string, vars: Record<string, any>): Promise<{ messageId: string }>
}

type EmailTemplate = 
  | 'welcome' 
  | 'verify-email' 
  | 'reset-password' 
  | 'subscription-expiring' 
  | 'quota-warning' 
  | 'report-ready'
```

**降级策略**：发送失败不阻塞业务，仅 log。

### 3.7 SmsService

**职责**：阿里云短信封装，4 个业务场景。

**接口**：
```typescript
interface SmsService {
  send(template: SmsTemplate, phone: string, vars: Record<string, any>): Promise<{ requestId: string }>
}

type SmsTemplate = 'register' | 'login' | 'reset' | 'quota'
```

复用现有 `src/lib/sms.ts`，扩展模板场景。

### 3.8 LegalPages

**职责**：三件套静态文案。

- `/privacy` 隐私政策
- `/terms` 用户协议
- `/refund` 退款规则

**实现**：纯静态 React 组件，复制标准模板后定制。

---

## 4. Data Flow

### 4.1 手机号注册/登录

```
用户输手机号
  ↓ POST /api/auth/send-code { target: phone, channel: 'sms', purpose: 'register' }
  ↓
VerificationService.send('sms', phone, 'register')
  ├── 限流检查
  ├── 生成 6 位 code
  ├── 存 VerificationToken (5分钟过期)
  └── SmsService.send('register', phone, { code })
  ↓
用户收到验证码
  ↓ POST /api/auth/phone-login { phone, code, mode: 'auto' }
  ↓
VerificationService.verify('sms', phone, code, 'register')
  ↓
AuthService.registerOrLoginByPhone(phone, code)
  ├── 用户存在 → 标记 phoneVerified = true → 生成 session
  └── 用户不存在 → 创建 User（plan: FREE, phoneVerified: true）→ 初始化免费 Quota
  ↓
返回 session + 重定向 /onboarding (新) 或 /dashboard (老)
```

### 4.2 支付流程

```
用户选套餐 + 支付通道
  ↓ POST /api/billing/pay { plan, channel: 'xunhupay' }
  ↓
PaymentRouter.create(order, 'xunhupay')
  ├── 创建 Order (PENDING, expiredAt = now + 15min)
  ├── getChannel('xunhupay').create(order)
  └── 返回 { payUrl, qrCode, orderNo }
  ↓
前端展示二维码 + 轮询订单状态 (5s/次, 2分钟)
  ↓
用户在虎皮椒完成支付
  ↓ 虎皮椒回调 → POST /api/billing/callback/xunhupay
  ↓
PaymentRouter.handleCallback('xunhupay', payload, signature)
  ├── channel.verifyCallback(payload, signature)
  ├── 验签失败 → log + 返回 400
  ├── channel.parseCallback(payload)
  ├── 更新 Order (PAID)
  ├── SubscriptionService.createSubscription(userId, plan, orderId)
  ├── EmailService.send('welcome' / 'subscription-expiring', user.email, vars)
  └── 返回 200 OK
  ↓
前端轮询检测到 PAID → 跳转 /dashboard
```

### 4.3 密码重置

```
用户点忘记密码 → /forgot-password
  ↓ POST /api/auth/forgot { phone }
  ↓
VerificationService.send('sms', phone, 'reset_password')
  ↓ SmsService.send('reset', phone, { code })
  ↓
用户收到验证码
  ↓ POST /api/auth/reset { phone, code, newPassword }
  ↓
VerificationService.verify('sms', phone, code, 'reset_password')
  ├── 通过 → bcrypt(newPassword) → User.update
  ├── 失败 → 401
  ↓
VerificationService.consume(tokenId)
  ↓
返回成功 + 重定向 /login
```

### 4.4 Onboarding 4 步

```
新用户注册完成 → 重定向 /onboarding
  ↓
OnboardingService.getStep(userId) → 'brand_pending'
  ↓
Step 1: 创建品牌
  ↓ POST /api/brands
  ↓ OnboardingService.advanceTo('prompt_pending')
  ↓
Step 2: 添加 prompt
  ↓ POST /api/prompts
  ↓ OnboardingService.advanceTo('scan_pending')
  ↓
Step 3: 触发首次扫描
  ↓ POST /api/scans (或跳到 monitor 触发)
  ↓ OnboardingService.advanceTo('completed')
  ↓
Step 4: 完成页
  ↓ OnboardingService.complete()
  ↓ 重定向 /dashboard
```

**跳过机制**：任意 step 用户可点「跳过引导」→ OnboardingService.skip() → 写 'skipped'，不阻塞访问 dashboard。

---

## 5. Database Schema Changes

### 5.1 User 表扩展

```prisma
model User {
  // ... 现有
  phoneVerified         Boolean   @default(false)
  emailVerified         Boolean   @default(false)
  onboardingStep        String    @default("not_started")
  onboardingSkippedAt   DateTime?
  onboardingCompletedAt DateTime?
}
```

### 5.2 VerificationToken 表扩展

```prisma
model VerificationToken {
  identifier String   // phone or email
  channel    String   @default("email")  // 'sms' | 'email'
  purpose    String   @default("login")   // 'register' | 'login' | 'reset_password' | 'verify_email'
  token      String   @unique
  expires    DateTime
  attempts   Int      @default(0)
  consumed   Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@unique([identifier, channel, purpose])
  @@index([expires])
  @@index([consumed, expires])
}
```

### 5.3 迁移

`npx prisma db push` 应用变更（不写 migration 文件，符合现有做法）。

同步更新 `prisma/seed.mjs`。

---

## 6. API Surface

### 6.1 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/send-code` | 发送验证码（SMS/Email） |
| POST | `/api/auth/phone-login` | 手机号登录/注册合并 |
| POST | `/api/auth/verify-email` | 邮箱验证 |
| POST | `/api/auth/forgot` | 发起密码重置 |
| POST | `/api/auth/reset` | 提交新密码 |
| GET | `/api/user/me` | 当前用户信息 |

### 6.2 支付

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/billing/pay/[orderNo]` | 创建支付（支持 channel） |
| POST | `/api/billing/callback/xunhupay` | 虎皮椒回调 |
| POST | `/api/billing/callback/payjs` | PayJS 回调 |
| POST | `/api/billing/callback/alipay` | 支付宝回调（保留） |
| POST | `/api/billing/callback/wechat` | 微信回调（保留） |
| POST | `/api/billing/refund` | 退款（v1 走人工） |
| GET | `/api/billing/orders` | 订单历史 |
| GET | `/api/billing/subscription` | 当前订阅 |
| POST | `/api/billing/cancel` | 取消订阅 |

### 6.3 Onboarding

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/onboarding/state` | 当前状态 |
| POST | `/api/onboarding/advance` | 推进 step |
| POST | `/api/onboarding/skip` | 跳过 |
| POST | `/api/onboarding/complete` | 完成 |

---

## 7. Environment Variables

### 新增

```env
# 阿里云邮件推送
ALIYUN_DM_ACCESS_KEY_ID=
ALIYUN_DM_ACCESS_KEY_SECRET=
ALIYUN_DM_ACCOUNT_NAME=        # 发信地址
ALIYUN_DM_FROM_ALIAS=GeoScore

# 虎皮椒支付
XUNHUPAY_MCH_ID=
XUNHUPAY_KEY=
XUNHUPAY_NOTIFY_URL=

# 支付默认通道（xunhupay | payjs）
DEFAULT_PAYMENT_CHANNEL=xunhupay
```

### 已有（保留）

```env
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# 阿里云短信
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=

# DeepSeek
DEEPSEEK_API_KEY=

# PayJS
PAYJS_MCH_ID=
PAYJS_KEY=
PAYJS_NOTIFY_URL=
```

---

## 8. Error Handling

**业务错误统一抛出**：
```typescript
class BusinessError extends Error {
  constructor(public code: string, message: string, public status: number = 400) { super(message) }
}
```

**API 统一响应**：
```typescript
// 成功
{ ok: true, data: T }

// 失败
{ ok: false, error: { code: 'INVALID_CODE', message: '验证码错误' } }
```

**前端 toast** 友好提示，code 映射中文消息。

**全局 ErrorBoundary** 包裹 `(dashboard)` 路由组。

**日志**：业务关键操作写 `console.log` / `pino`（v2.1 接入 Sentry）。

---

## 9. Security

| 风险 | 缓解 |
|---|---|
| 验证码被暴力破解 | 5 次错误锁定 1 小时 |
| 短信被刷 | 进程内限流（1/min, 10/h, 20/d） |
| 支付回调伪造 | 强制验签（虎皮椒 MD5 / PayJS 同） |
| 订单篡改 | 服务端重新计算金额，不信任客户端 |
| SQL 注入 | Prisma 参数化 |
| XSS | React 默认转义 + CSP header |
| CSRF | NextAuth 内置 |

---

## 10. Testing Strategy

### 单测（jest/vitest）

- `VerificationService`：send/verify/限流/consume
- `PaymentRouter`：通道路由 + 验签 mock
- `SubscriptionService`：订阅生命周期
- `OnboardingService`：状态机推进

### E2E 手动跑通

1. 手机号注册 → 验证 → 登录 → Onboarding → Dashboard
2. 选套餐 → 虎皮椒沙箱 → 订阅生效
3. 选套餐 → PayJS 沙箱 → 订阅生效
4. 密码重置全流程
5. 边界：限流、锁定、支付失败

### 不做

- Playwright 自动化（v2.1）
- Sentry（v2.1）
- 性能测试（用户量起来）

---

## 11. Rollout Plan

```
Week 1: Phase A 基础服务封装 + Phase B 支付通道
Week 2: Phase C 认证流程 + Phase D Onboarding
Week 3: Phase E 个人中心 + Phase F 法律文案 + 邮件触发
Week 4: Phase G 验收测试 + 软启动
```

---

## 12. Acceptance Criteria

### 主路径（必跑通）

1. ✅ 手机号注册 → 验证 → 登录 → Onboarding 4 步 → Dashboard
2. ✅ 手机号登录老用户
3. ✅ 邮箱注册 + 邮箱验证链接
4. ✅ 密码重置全流程
5. ✅ 选套餐 → 虎皮椒沙箱 → 订阅生效 + 邮件
6. ✅ 选套餐 → PayJS 沙箱 → 订阅生效
7. ✅ Onboarding 跳过 + 重看
8. ✅ 个人中心 5 子页全部可访问

### 边界（必验证）

- ✅ 验证码限流（1分钟内重复、1小时超限）
- ✅ 验证码错误 5 次锁定
- ✅ 支付失败 → 订单保留 + 重试
- ✅ 邮件发送失败 → 降级不阻塞
- ✅ 移动端响应式（手机号输入、验证码、支付二维码）

### 验证命令

```bash
npm install --legacy-peer-deps
npx prisma db push
npm run db:seed
npm run dev    # http://localhost:18200
npm run lint
npm run build
```

---

## 13. Open Questions

无。所有关键决策已确认（见 brainstorm-summary.md）。

---

**Status**: Draft → 等待用户 review → 推进到 Build
