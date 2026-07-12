# GeoScore 部署准备

## 当前边界

本项目已在本地使用 PostgreSQL、Mock AI 和 Mock 支付完成端到端验证。部署生产环境前必须获得并验证真实外部凭据；缺少凭据时不得对外宣称相应能力已经上线。

## 服务器建议

- 中国大陆云服务器，Node.js 22、PostgreSQL 16、Nginx、HTTPS。
- 应用以非 root 用户运行，数据库不暴露公网端口。
- Nginx 反向代理到 `127.0.0.1:18200`。
- 使用进程管理器或 systemd 执行 `npm run start`。
- 数据库每日备份，至少保留 7 天并定期验证恢复。

## 上线前外部事项

1. 为 `geoscore.cn` 完成适用于实际服务和运营主体的 ICP 手续；有偿 SaaS 是否需要经营许可，应向接入商和所在地通信管理部门确认。个人备案不能被默认视为允许所有商业经营活动。
2. 配置 HTTPS 证书，并将 `BETTER_AUTH_URL`、`NEXT_PUBLIC_APP_URL` 改为 `https://geoscore.cn`。
3. 在阿里云个人实名认证账号开通号码认证服务，使用系统签名和模板，填写 AccessKey、签名和模板编号。
4. 向 PAYJS 提交真实经营场景和已备案域名，审核通过后填写商户号和通信密钥；PAYJS 当前只接微信支付，不应在页面虚构支付宝入口。
5. 配置 DeepSeek API Key，仅将 DeepSeek 的真实回答标记为 DeepSeek；未真实接入的平台不得使用模拟结果冒充。
6. 在隐私政策和服务协议中补充运营者真实姓名或主体、地址、联系方式、退款规则和争议解决信息。

## 生产环境变量

```bash
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/geoscore
BETTER_AUTH_SECRET=至少32位随机字符串
BETTER_AUTH_URL=https://geoscore.cn
NEXT_PUBLIC_APP_URL=https://geoscore.cn

AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=真实密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com

SMS_PROVIDER=aliyun
ALIBABA_CLOUD_ACCESS_KEY_ID=RAM用户AccessKey
ALIBABA_CLOUD_ACCESS_KEY_SECRET=RAM用户Secret
ALIYUN_SMS_SIGN_NAME=系统签名
ALIYUN_SMS_TEMPLATE_CODE=系统模板编号

PAYMENT_PROVIDER=payjs
PAYJS_MCHID=商户号
PAYJS_KEY=通信密钥
PAYJS_NOTIFY_URL=https://geoscore.cn/api/payments/payjs/notify
```

## 构建与迁移

```bash
npm ci --legacy-peer-deps
npx prisma migrate deploy
npm run db:seed
npm run build
npm run start -- --port 18200
```

## 发布前验证

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npx prisma migrate status
```

真实短信和支付必须各完成至少一次小额测试，并在 PostgreSQL 核对用户、订单、支付事件、订阅和额度流水后再开放注册。
