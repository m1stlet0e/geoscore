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
- [ ] D9. onboarding 完成后写 `onboardingCompletedAt`

---

## Phase E: 个人中心 + 订阅管理

- [ ] E1. 重构 `src/app/(dashboard)/settings/page.tsx` - 资料 Tab
- [ ] E2. 创建 `src/app/(dashboard)/settings/security/page.tsx` - 密码 / 验证状态
- [ ] E3. 创建 `src/app/(dashboard)/settings/subscription/page.tsx` - 订阅管理
- [ ] E4. 创建 `src/app/(dashboard)/settings/quota/page.tsx` - 配额详情
- [ ] E5. 创建 `src/app/(dashboard)/settings/orders/page.tsx` - 订单历史
- [ ] E6. Sidebar 添加子导航

---

## Phase F: 法律文案 + 邮件触发点

### F.1 法律文案

- [ ] F1. 创建 `src/app/(legal)/privacy/page.tsx` - 隐私政策
- [ ] F2. 创建 `src/app/(legal)/terms/page.tsx` - 用户协议
- [ ] F3. 创建 `src/app/(legal)/refund/page.tsx` - 退款规则
- [ ] F4. 营销首页底部添加法律链接
- [ ] F5. 注册流程同意条款 checkbox

### F.2 邮件触发点

- [ ] F6. 注册成功 → 发送 welcome 邮件
- [ ] F7. 邮箱验证 → 发送 verify-email 邮件
- [ ] F8. 密码重置 → 发送 reset-password 邮件
- [ ] F9. 订阅升级成功 → 发送 subscription-expiring 提醒配置（升级成功时）
- [ ] F10. 订阅到期前 3 天 / 1 天 → cron 检查 + 发提醒邮件
- [ ] F11. 配额使用 80% / 95% → 发送 quota-warning 邮件
- [ ] F12. 报告生成完成 → 发送 report-ready 邮件（如有此功能）

---

## Phase G: 验收测试

- [ ] G1. 完整跑通：手机号注册 → 验证 → 自动登录 → Onboarding 全 4 步 → 进入 Dashboard
- [ ] G2. 完整跑通：手机号登录老用户
- [ ] G3. 完整跑通：邮箱注册 + 邮箱验证链接
- [ ] G4. 完整跑通：密码重置全流程
- [ ] G5. 完整跑通：选套餐 → 虎皮椒支付（沙箱）→ 订阅生效 + 邮件
- [ ] G6. 完整跑通：选套餐 → PayJS 支付（沙箱）→ 订阅生效
- [ ] G7. 边界测试：验证码限流（1分钟内重复、1小时超限）
- [ ] G8. 边界测试：验证码错误 5 次锁定
- [ ] G9. 边界测试：支付失败 → 订单保留 + 重试
- [ ] G10. 边界测试：邮件发送失败 → 降级到手机号登录
- [ ] G11. 5 个邮件模板全部预览 OK（用 MailHog / 阿里云预览）
- [ ] G12. 移动端响应式验证（手机号输入、验证码输入、支付二维码）
- [ ] G13. 跑 `npm run lint` 无 error
- [ ] G14. 跑 `npm run build` 成功
- [ ] G15. 手动跑 `npx prisma studio` 检查数据一致性

---

## 进度追踪

| 阶段 | 任务数 | 状态 |
|---|---|---|
| Phase A: 基础服务 | 12 | ⏳ |
| Phase B: 支付通道 | 12 | ⏳ |
| Phase C: 认证流程 | 17 | ⏳ |
| Phase D: Onboarding | 9 | ⏳ |
| Phase E: 个人中心 | 6 | ⏳ |
| Phase F: 文案 + 邮件 | 12 | ⏳ |
| Phase G: 验收 | 15 | ⏳ |
| **总计** | **83** | **0%** |
