# Changelog

## [2.0.1] - 2026-06-13

### UI / 体验

- **营销首页**（`/`）：Premium Light 风格重设计，优化 Hero、审计工具、功能 Bento 网格与 GEO 价值说明区；修复 `Radar`、`Activity` 等图标未导入导致的运行时错误。
- **工作区总览**（`/dashboard`）：Bento 统计卡片、图表与活动列表视觉升级；修复 `Search` 图标未导入问题。
- **侧边栏**：浮动式导航与用户卡片重设计；新增 **内容中心**（`/content`）入口。
- **Dashboard 布局**：增加 subtle 渐变与噪点背景，提升整体质感。

### 稳定性修复

- **DeepSeek 客户端**（`src/lib/deepseek.ts`）
  - 新增 `deepseek.chat.completions.create` 兼容层，避免旧引擎代码引用不存在的导出。
  - `recommendation-factor.engine` / `gap-intelligence.engine` 统一改用 `jsonChat`。

- **Gaps 缺口分析**（`/gaps`）
  - `/api/gaps/summary` 改为使用 `gapEngine.getSummary()`，与前端 `Summary` 类型对齐。
  - 修复 `summary.totalAnalyses.toLocaleString()` 等空值崩溃。
  - Gap 项状态更新 API 修正为 `PUT /api/gaps/{analysisId}/items/{itemId}`。
  - 映射 `benchmark` → `benchmarkScore`，分页字段 `pages` → `totalPages`。

- **Citations 引用分析**（`/citations`）
  - `/api/citations/factors` 优先返回 `citationEngine` 分布数据，无数据时回退 `recommendationFactorEngine`。
  - 修复 `factors.map is not a function`；stats 字段增加空值兜底。

- **Content 内容中心**（`/content`）
  - stats 归一化与趋势字段映射（`increasing/decreasing` → `up/down`）。
  - 内容/发布状态 badge 未知状态时回退默认值，避免 `.bg` 访问崩溃。
  - 支持 URL 参数 `?brandId=` 预选品牌。

- **Admin 管理后台**（`/admin`）
  - users/orders/logs/configs 列表空值保护。
  - `planDistribution` 由 Record 转为前端期望的数组结构。
  - Quota 列表映射 Prisma 字段（`type` → `quotaType`、`user.email` 等）。

- **Growth 增长中心**（`/growth`）
  - 内容生成卡片改为跳转内容中心（原 form POST 无效）。
  - 内容列表链接由无效 `/growth/{id}` 改为 `/content?brandId=`。

### 工具函数

- `src/lib/utils.ts` 新增：
  - `normalizePagination` — 统一 `pages` / `totalPages`
  - `normalizeTrend` — 统一多种趋势枚举
  - `normalizeGapAnalysis` — 统一 benchmark 字段

### 本地开发

```bash
npm install --legacy-peer-deps
cp .env.example .env   # 配置 DATABASE_URL、DEEPSEEK_API_KEY
npx prisma db push
npm run db:seed        # demo@geoos.ai / demo123456
npm run dev            # http://localhost:18200
```
