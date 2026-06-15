# Phone-First CN SaaS Launch - High-Level Design

> 高层架构决策，详细技术设计见 `docs/superpowers/specs/2026-06-15-phone-first-cn-saas-design.md`（design 阶段产出）

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                   │
│                                                              │
│  /  /login  /register  /forgot-password  /onboarding        │
│  /(dashboard)/settings  /pricing  /orders                   │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                       API Routes                             │
│                                                              │
│  /api/auth/*          phone-login / send-code / forgot /     │
│                       reset / verify-email                   │
│  /api/billing/*       pay / callback/* / refund / orders     │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Service Layer                           │
│                                                              │
│  src/lib/sms.ts                   阿里云 SMS                  │
│  src/lib/email/                   阿里云邮件推送              │
│  src/lib/payment/                 支付通道（双通道）          │
│  src/lib/services/                业务服务层                  │
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
│  User (扩展: phoneVerified / emailVerified / onboardingStep)│
│  VerificationToken (扩展: channel / purpose / attempts)      │
│  Subscription / Order / Payment (现有)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Architecture Decisions

### 1. 手机号优先策略

- **UI 层**：`/login` 和 `/register` 默认显示手机号 Tab，邮箱 Tab 折叠在「其他方式」下
- **数据层**：`User.phone` 已有 unique 约束，加 `phoneVerified` Boolean 标记
- **接口层**：`/api/auth/send-code` 统一接收 `channel: 'sms' | 'email'` + `purpose: 'register' | 'login' | 'reset' | 'verify'`
- **业务层**：`auth.service.register(phone)` 和 `auth.service.login(phone)` 合并为一个 `phoneLoginOrRegister(phone, code)` 流程

### 2. 验证码服务抽象

`VerificationService` 统一管理 SMS / Email / Reset 三类验证码：

```
VerificationService
  ├── send(channel, target, purpose)    # 发送（含限流）
  ├── verify(channel, target, code, purpose)  # 验证
  └── consume(token)                    # 验证后失效
```

存储：复用现有 `VerificationToken` 模型，扩展字段：
- `channel`: 'sms' | 'email'
- `purpose`: 'register' | 'login' | 'reset_password' | 'verify_email'
- `attempts`: 尝试次数（防爆破）
- `consumed`: 是否已使用

### 3. 支付通道调度

```
PaymentRouter
  ├── create(order, channel?)     # 不指定则按策略选
  ├── callback(channel, payload)  # 统一回调入口
  ├── query(orderNo)              # 主动查询
  └── refund(orderNo, reason)     # 退款（v1 走人工）
```

**策略**：
- 默认：虎皮椒（覆盖微信 + 支付宝）
- 备选：PayJS（仅微信）
- 支付页提供「切换通道」按钮

**已有通道**：`alipay.ts` / `wechat-pay.ts` 暂不挂到主流程，保留代码作为未来扩展。

### 4. Onboarding 状态机

```
not_started
  ↓ 进入 /onboarding
brand_pending        (创建第一个品牌)
  ↓ 创建成功
prompt_pending       (添加 prompt)
  ↓ 添加成功
scan_pending         (触发首次扫描)
  ↓ 扫描完成
completed            (进入 /dashboard)
```

**存储**：`User.onboardingStep` 字符串字段 + `onboardingCompletedAt` 时间戳。
**断点续走**：每次进入 `/onboarding` 读取当前 step，跳过已完成的。

### 5. 邮件模板系统

```
src/lib/email/
  ├── client.ts             # 阿里云邮件推送 SDK 封装
  ├── templates/
  │   ├── welcome.tsx                  # 注册欢迎
  │   ├── verify-email.tsx             # 邮箱验证
  │   ├── reset-password.tsx           # 密码重置
  │   ├── subscription-expiring.tsx    # 订阅到期
  │   ├── quota-warning.tsx            # 配额预警
  │   └── report-ready.tsx             # 报告生成
  └── send.ts              # 统一发送接口
```

模板用 React Email（如果可接受新依赖）或纯字符串模板。

### 6. 个人中心结构

```
/settings
  ├── /          (默认 Tab：资料)
  ├── /security  (密码 / 验证状态)
  ├── /subscription  (订阅管理：升级 / 降级 / 取消)
  ├── /quota     (配额详情 + 用量明细)
  └── /orders    (订单历史 + 发票)
```

---

## Data Flow

### A. 手机号注册/登录

```
用户输手机号
  ↓ POST /api/auth/send-code { target: phone, channel: 'sms', purpose: 'register' }
  ↓
VerificationService.send('sms', phone, 'register')
  ├── 限流检查（1分钟/次，1小时10次/IP，1天20次/手机号）
  ├── 生成 6 位数字 code
  ├── 存 VerificationToken (5分钟过期)
  ├── 阿里云 SMS 发送
  └── 限流记录写 Redis-like (此处用 DB 即可，单用户量不大)
  ↓
用户收到验证码
  ↓ POST /api/auth/phone-login { phone, code, mode: 'auto' }
  ↓
VerificationService.verify('sms', phone, code, 'register')
  ├── 存在 + 未过期 + 未使用 + 尝试 < 5 → 通过
  ├── 失败 → 401
  ↓
authService.phoneLoginOrRegister(phone)
  ├── 用户存在 → 标记 phoneVerified = true → 生成 session
  ├── 用户不存在 → 创建 User（plan: FREE, phoneVerified: true）→ 初始化免费 Quota
  ↓
返回 session + 重定向 /onboarding（新用户）或 /dashboard
```

### B. 支付流程

```
用户选套餐 + 支付通道
  ↓ POST /api/billing/pay { plan, channel: 'xunhupay' | 'payjs' }
  ↓
PaymentRouter.create(order, channel)
  ├── 创建 Order（PENDING, expiredAt = now + 15min）
  ├── 调用对应通道 API
  ├── 虎皮椒 → 返回 QR Code / 支付 URL
  ├── PayJS → 返回 QR Code / 跳转 URL
  ↓
前端展示支付二维码
  ↓
用户在通道方完成支付
  ↓ 通道方回调 → POST /api/billing/callback/xunhupay (or /payjs)
  ↓
PaymentRouter.callback(channel, payload)
  ├── 验签（虎皮椒 MD5 / PayJS 同）
  ├── 验签失败 → 写 audit log → 返回 400
  ├── 更新 Order (PAID)
  ├── 创建 / 续期 Subscription
  ├── 发送邮件（订阅成功）
  └── 返回 200 OK
```

### C. 密码重置

```
用户点忘记密码
  ↓ POST /api/auth/forgot { phone }
  ↓
VerificationService.send('sms', phone, 'reset_password')
  ↓
用户收到验证码
  ↓ POST /api/auth/reset { phone, code, newPassword }
  ↓
VerificationService.verify('sms', phone, code, 'reset_password')
  ├── 通过 → bcrypt 哈希新密码 → 更新 User
  ├── 失败 → 401
  ↓
VerificationService.consume(token)
  ↓
返回成功 + 重定向 /login
```

---

## Database Changes

### User 表扩展

```prisma
model User {
  // ... 现有字段
  phoneVerified         Boolean   @default(false)
  emailVerified         Boolean   @default(false)
  onboardingStep        String    @default("not_started")
  onboardingCompletedAt DateTime?
}
```

### VerificationToken 表扩展

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
}
```

> 注：实际现有 schema 中 `VerificationToken` 没有 `channel` / `purpose` / `attempts` / `consumed` 字段，需要在 Prisma schema 中扩展。

---

## Environment Variables

新增：

```env
# 阿里云邮件推送（新增）
ALIYUN_DM_ACCESS_KEY_ID=
ALIYUN_DM_ACCESS_KEY_SECRET=
ALIYUN_DM_ACCOUNT_NAME=        # 发信地址（需在阿里云后台验证）
ALIYUN_DM_FROM_ALIAS=          # 发件人昵称（如 "GeoScore"）

# 虎皮椒支付（新增）
XUNHUPAY_MCH_ID=
XUNHUPAY_KEY=                  # API 密钥
XUNHUPAY_NOTIFY_URL=           # 回调地址
```

保留（已有）：

```env
# 阿里云短信
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=

# PayJS
PAYJS_MCH_ID=
PAYJS_KEY=
PAYJS_NOTIFY_URL=
```

---

## Risk & Mitigation

| 风险 | 等级 | 缓解 |
|---|---|---|
| 虎皮椒商户号审核不通过 | 中 | PayJS 兜底 + 渠道切换 UI |
| 阿里云邮件推送开通慢 | 低 | 申请期内可降级到「不验证邮箱」 |
| 短信费用失控 | 中 | 严格限流（1次/分钟、10次/小时/IP、20次/天/号） |
| 支付回调丢失 | 中 | 订单 expiredAt + cron 清理；同时加主动 query 接口 |
| 验证码被暴力破解 | 高 | 5 次尝试后锁 1 小时 + 5 分钟过期 |
| 邮箱被恶意注册刷量 | 中 | 发送频率限流 + 可选 reCAPTCHA |
| 个人信息泄露 | 中 | 验证码日志脱敏 + 定期清理 VerificationToken |
