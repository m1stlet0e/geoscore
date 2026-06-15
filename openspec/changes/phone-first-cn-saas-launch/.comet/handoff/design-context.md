# Comet Design Handoff

- Change: phone-first-cn-saas-launch
- Phase: design
- Mode: compact
- Context hash: 1b1825d4f72e7e898075ae7b50a96e95f285e082fe4d1dbe8b3f351ab4d436c1

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/phone-first-cn-saas-launch/proposal.md

- Source: openspec/changes/phone-first-cn-saas-launch/proposal.md
- Lines: 1-112
- SHA256: ef70c8fa1ef748365d58e1c7cbcc0bb857ba3829a9a5c7b98ebd8ccbcd3fe533

[TRUNCATED]

```md
# Phone-First CN SaaS Launch

> GeoScore v2 国内单用户 SaaS 上线准备 - 一个 change 覆盖认证 / 支付 / 邮件 / Onboarding 四大模块

---

## Why

GeoScore v2 是面向国内用户的 AI 搜索曝光增长平台，但当前缺失**完整的商业化闭环**：

1. **注册流程未跑通主路径**：邮箱注册存在但手机号验证码流程未端到端打通
2. **支付通道单一**：仅 PayJS（个人微信），缺少支付宝聚合通道
3. **邮件系统缺失**：无法实现注册验证、密码重置、订阅到期提醒等基础能力
4. **新用户无引导**：首次使用无 Onboarding 流程，留存转化漏斗缺失
5. **法律文案缺失**：商业化收款必须有三件套（隐私 / 协议 / 退订）

**约束**：用户是个人开发者（无企业资质），必须用**个人可开通的国内支付通道**（虎皮椒）补齐商业化能力。

---

## Goals

1. **手机号优先注册/登录**：手机号 + 短信验证码作为首选方式，邮箱密码作为备选
2. **多通道支付**：虎皮椒（主，聚合微信 + 支付宝）+ PayJS（备，仅微信）双通道
3. **完整邮件能力**：阿里云邮件推送接入，5 个核心场景（验证 / 重置 / 订阅 / 配额 / 报告）
4. **完整 Onboarding**：4 步引导（创建品牌 → 添加 prompt → 跑首次扫描 → 看结果）
5. **个人中心完善**：资料、密码、订阅、配额、订单一站式管理
6. **法律合规**：三件套文案（隐私政策 / 用户协议 / 退款规则）

---

## Non-Goals

- ❌ 团队协作 / 多用户组织
- ❌ RBAC / 权限系统
- ❌ SSO / 企业登录
- ❌ 公开 API + Webhook（企业场景）
- ❌ 多语言 i18n（仅中文）
- ❌ BullMQ 异步队列（用户量起来再做）
- ❌ 数据库迁移规范（用户量起来再做）
- ❌ 多平台 AI 接入（继续只用 DeepSeek）
- ❌ 移动 App / PWA

---

## Scope

### 包含模块

| 模块 | 内容 |
|---|---|
| **认证** | 手机号验证码注册/登录、邮箱注册、邮箱验证、密码重置、个人资料管理 |
| **短信服务** | 阿里云 SMS 封装（已有 SDK），多种业务场景模板 |
| **邮件服务** | 阿里云邮件推送 SDK 封装 + 5 个模板 + 统一发送接口 |
| **支付** | 虎皮椒通道、PayJS 通道、通道调度、退款、订单查询、订阅生命周期 |
| **Onboarding** | 4 步引导、状态机、断点续走、完成状态持久化 |
| **个人中心** | 资料、密码、订阅、配额、订单 5 个子页面 |
| **法律文案** | 隐私政策 / 用户协议 / 退款规则 3 个静态页 + 首页底部链接 |

### 排除模块

- 移动端
- 任何企业级功能
- 任何多用户 / 协作功能

---

## Acceptance Scenarios

### 主路径（必跑通）

1. **新用户手机注册**：访问首页 → 点注册 → 输手机号 → 收短信码 → 输码 → 注册成功 → 自动登录 → 进入 Onboarding
2. **老用户手机登录**：访问 → 输手机号 → 收短信码 → 输码 → 登录成功 → 进入 Dashboard
3. **Onboarding 全程**：引导创建第一个品牌 → 添加 prompt → 触发首次扫描 → 看到 Citation 概览数据 → 完成引导进入 Dashboard
4. **付费升级**：FREE 用户触发 PRO 功能 → 看到付费墙 → 选套餐 → 选支付通道（虎皮椒/PayJS）→ 完成支付 → 订阅升级成功 → 收到邮件
5. **密码重置**：忘记密码 → 输手机号 → 收验证码 → 重置密码 → 新密码登录

### 边界（必验证）

- 同一手机号 1 分钟内只能发 1 条验证码；同一 IP 1 小时最多发 10 条
```

Full source: openspec/changes/phone-first-cn-saas-launch/proposal.md

## openspec/changes/phone-first-cn-saas-launch/design.md

- Source: openspec/changes/phone-first-cn-saas-launch/design.md
- Lines: 1-301
- SHA256: 1f64f32bc34b861079b5f2fa0999f41b9b88f3ec48541f35315a785d33c5a4ce

[TRUNCATED]

```md
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

Full source: openspec/changes/phone-first-cn-saas-launch/design.md

## openspec/changes/phone-first-cn-saas-launch/tasks.md

- Source: openspec/changes/phone-first-cn-saas-launch/tasks.md
- Lines: 1-149
- SHA256: 9ac37e67a5ed86c51c18783627aa813fde0a297290f83bbe6efff62fdf688a99

[TRUNCATED]

```md
# Tasks - Phone-First CN SaaS Launch

> 7 个阶段，~50 个子任务。每个任务独立可提交。

---

## Phase A: 基础服务封装（基础设施先行）

- [ ] A1. 安装阿里云邮件推送 SDK: `npm install @alicloud/dm-20151123`
- [ ] A2. 创建 `src/lib/email/client.ts` - 阿里云邮件推送 SDK 封装（单例、错误处理、重试）
- [ ] A3. 创建 `src/lib/email/templates/welcome.tsx` - 注册欢迎邮件
- [ ] A4. 创建 `src/lib/email/templates/verify-email.tsx` - 邮箱验证邮件
- [ ] A5. 创建 `src/lib/email/templates/reset-password.tsx` - 密码重置邮件
- [ ] A6. 创建 `src/lib/email/templates/subscription-expiring.tsx` - 订阅到期提醒
- [ ] A7. 创建 `src/lib/email/templates/quota-warning.tsx` - 配额预警
- [ ] A8. 创建 `src/lib/email/templates/report-ready.tsx` - 报告生成通知
- [ ] A9. 创建 `src/lib/email/send.ts` - 统一发送接口（模板选择 + 错误降级）
- [ ] A10. 扩展 `src/lib/sms.ts` - 支持 register/login/reset/quota 4 个模板场景
- [ ] A11. 创建 `src/lib/services/verification.service.ts` - 验证码统一管理（限流 + 验证 + 失效）
- [ ] A12. 创建 `src/lib/services/auth.service.ts` - 认证主流程编排（注册/登录/重置）

---

## Phase B: 支付通道（虎皮椒 + PayJS）

- [ ] B1. 创建 `src/lib/payment/types.ts` - 支付通道接口定义（统一抽象）
- [ ] B2. 创建 `src/lib/payment/xunhupay.ts` - 虎皮椒通道实现（创建订单 / 验签 / 退款 / 查询）
- [ ] B3. 重构 `src/lib/payment/index.ts` - 通道调度（strategy + fallback）
- [ ] B4. 重构 `src/lib/payment/payjs.ts` - 适配统一接口（保留现有实现）
- [ ] B5. 创建 `src/lib/services/subscription.service.ts` - 订阅生命周期（创建 / 续期 / 过期 / 取消）
- [ ] B6. 创建 `/api/billing/callback/xunhupay/route.ts` - 虎皮椒回调处理
- [ ] B7. 重构 `/api/billing/callback/wechat/route.ts` - 适配 PayJS 回调
- [ ] B8. 重构 `/api/billing/pay/[orderNo]/route.ts` - 支持 channel 参数
- [ ] B9. 完善 `/api/billing/orders` - 订单历史查询（含分页、过滤）
- [ ] B10. 完善 `/api/billing/subscription` - 订阅状态查询
- [ ] B11. 创建 `/api/billing/cancel/route.ts` - 取消订阅
- [ ] B12. **退款走运营流程**：在 Admin 后台加退款按钮（v1 不暴露 API）

---

## Phase C: 认证流程（手机号优先）

### C.1 数据库变更

- [ ] C1. 更新 `prisma/schema.prisma` - User 加 `phoneVerified` / `emailVerified` / `onboardingStep` / `onboardingCompletedAt`
- [ ] C2. 更新 `prisma/schema.prisma` - VerificationToken 扩展 `channel` / `purpose` / `attempts` / `consumed`
- [ ] C3. 跑 `npx prisma db push` 应用 schema 变更
- [ ] C4. 跑 `npm run db:seed` 确认种子数据 OK

### C.2 后端 API

- [ ] C5. 重构 `/api/auth/send-code/route.ts` - 统一验证码接口（channel + purpose）
- [ ] C6. 重构 `/api/auth/phone-login/route.ts` - 合并注册+登录（auto mode）
- [ ] C7. 创建 `/api/auth/verify-email/route.ts` - 邮箱验证
- [ ] C8. 创建 `/api/auth/forgot/route.ts` - 发起密码重置
- [ ] C9. 创建 `/api/auth/reset/route.ts` - 提交新密码
- [ ] C10. 创建 `/api/user/me/route.ts` - 当前用户信息（如已存在则跳过）
- [ ] C11. 创建 `/api/user/update/route.ts` - 更新个人资料
- [ ] C12. 创建 `/api/user/change-password/route.ts` - 修改密码

### C.3 前端页面

- [ ] C13. 重构 `src/app/register/page.tsx` - 手机号 Tab 优先 + 邮箱 Tab 折叠
- [ ] C14. 重构 `src/app/login/page.tsx` - 同上
- [ ] C15. 创建 `src/app/forgot-password/page.tsx` - 忘记密码页
- [ ] C16. 创建 `src/app/reset-password/page.tsx` - 重置密码页（带 code 参数）
- [ ] C17. 确认 `src/middleware.ts` 路由保护逻辑 OK

---

## Phase D: Onboarding 流程

- [ ] D1. 创建 `src/lib/services/onboarding.service.ts` - 状态机 + 进度推进
- [ ] D2. 重构 `src/app/onboarding/page.tsx` - 多步骤引导容器
- [ ] D3. 创建 `src/app/onboarding/brand/page.tsx` - 步骤1：创建品牌
- [ ] D4. 创建 `src/app/onboarding/prompt/page.tsx` - 步骤2：添加 prompt
- [ ] D5. 创建 `src/app/onboarding/scan/page.tsx` - 步骤3：触发首次扫描
- [ ] D6. 创建 `src/app/onboarding/done/page.tsx` - 步骤4：完成 + 进入 Dashboard
- [ ] D7. Sidebar 组件添加「继续引导」提示
- [ ] D8. 注册流程后自动重定向到 onboarding 当前 step
```

Full source: openspec/changes/phone-first-cn-saas-launch/tasks.md

