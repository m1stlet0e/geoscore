---
comet_change: geo-core-v2-ocr
role: technical-design
canonical_spec: openspec
---

# GeoScore Core v2 (OCR) — Design Doc

> 把 GeoScore 从“AI SEO 查询工具”升级为“AI 曝光增长平台”。首发行业 OCR，跑通 Citation Intelligence + GEO Gap + Growth Agent + 数据资产层 4 件事的端到端闭环。

---

## 0. Context

- 起点：用户反馈“功能多但核心价值弱”，三个核心引擎 (Citation Intelligence / GEO Gap / Growth Agent) 必须立起来，否则三页（Citations / Gaps / Growth）只是弱核心的展示层。
- 现状：仓库已有旧引擎 `src/lib/engines/{citation,gap,gap-intelligence,recommendation-factor,content}.engine.ts` 和旧表 `Citation / CitationEvidence / CitationSource / GapAnalysis / RecommendationFactor / ScanRun`，语义偏“某次扫描的引用记录”，与新方案“跨时间累积的图谱 + 归因维度”不完全一致。
- 并行项目：`feature/20260615/phone-first-cn-saas-launch` 仍在 comet build。本设计假设 phone-first 先合 main，本工作基于含 phone-first 的 main 起步。

---

## 1. Goals & Non-Goals

### 1.1 Goals

- 把核心价值升级为三句产品话术：
  1. **为什么 AI 推荐你的竞争对手？**（Citation Intelligence 归因）
  2. **你和竞争对手的真实差距在哪几个维度？**（GEO Gap 维度差距）
  3. **未来 30 天你应该做什么？**（Growth Agent 行动清单）
- 沉淀 **Prompt 库 + Citation Graph + Brand Dimension** 三类数据资产，月度增厚护城河。
- 在 OCR 行业（TextIn / 腾讯 OCR / 百度 OCR / 阿里 OCR）跑通端到端闭环。
- 三页（`/citations` / `/gaps` / `/growth`）重写后**直接消费 v2 真实数据**，不再是预生成快照。
- 支持每日 03:00 Cron 自动刷新所有用户品牌的 v2 数据。

### 1.2 Non-Goals

- 不重构 Dashboard / Forecast / Influence / Radar / Alerts / Monitor / Sources 等页面（仅允许在 stat 卡片里加 1–2 个 v2 指标）。
- 不删旧引擎和旧表（保留只读，v3 再清理）。
- 不引 Redis / BullMQ / ClickHouse；调度只用 PG + Cron。
- 不做多行业（首发只做 OCR；行业 schema 抽象成配置，但只灌 OCR 一份）。
- 不做 10 万级 Prompt 库（首发 500 条人工 + 半自动）。
- 不做后台运营仪表盘 / 告警 / 成本监控（运营级留 v3）。
- 不动 phone-first 的认证 / 支付 / onboarding / 邮件链路。
- 不做反爬军备竞赛（采集器只走公开页面 + 低频，被 ban 就降级，不投入代理池）。

---

## 2. Architecture

### 2.1 全景图

```
┌────────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js 16)                         │
│                                                                     │
│  /(dashboard)/citations  → "为什么 AI 推荐它" 归因卡片                │
│  /(dashboard)/gaps       → 维度差距条形图 + 焦虑文案                  │
│  /(dashboard)/growth     → 30 天 3 条优先级行动清单                   │
│                                                                     │
│  其他页面（Dashboard/Monitor/Forecast/...）保持现状                   │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ Server Action / fetch
┌──────────────────────────────▼─────────────────────────────────────┐
│                          API Routes (v2)                            │
│                                                                     │
│  /api/v2/scan              POST  → 入队 ScanJob (LLM 链路)           │
│  /api/v2/citations         GET   → 引用归因数据                      │
│  /api/v2/gaps              GET   → 维度差距数据                      │
│  /api/v2/growth            GET   → 行动清单                          │
│  /api/cron/run-jobs        POST  → Cron 拉取 + 执行 (CRON_SECRET)    │
│                                                                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                  Service Layer (src/lib/v2)                         │
│                                                                     │
│  engines/                                                            │
│    ├── citation-graph.engine.ts    引用归因                          │
│    ├── gap.engine.ts               维度差距 (v2)                     │
│    ├── growth-agent.engine.ts      30 天行动建议                     │
│    └── prompt-library.engine.ts    Prompt 取样 / 分类                │
│                                                                     │
│  collectors/                       浅层公开数据采集                   │
│    ├── github.collector.ts         GitHub 项目数 / stars             │
│    ├── website.collector.ts        官网索引页数 (Bing Web Search)    │
│    ├── zhihu.collector.ts          知乎提及数                        │
│    └── llm.collector.ts            DeepSeek + ChatGPT 抽取           │
│                                                                     │
│  jobs/                             调度 + 执行                        │
│    ├── scan.runner.ts              一条 ScanJob 怎么跑               │
│    ├── collect.runner.ts           一条 CollectorRun 怎么跑          │
│    └── dispatcher.ts               Cron 入口，按优先级取 N 条          │
│                                                                     │
│  industries/                       行业配置                           │
│    ├── ocr.config.ts               OCR 维度权重 / 别名 / 竞品列表     │
│    └── ocr.actions.yaml            OCR 各维度行动模板                 │
│                                                                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                       Data Layer (Prisma)                           │
│                                                                     │
│  v2 表（新增）：                                                      │
│    PromptLibrary           行业 prompt 池 + 分类标签                  │
│    CitationNode            品牌 / 引用源节点                          │
│    CitationEdge            prompt → 回答 → 引用源 → 品牌 关系          │
│    BrandDimension          某品牌在某维度的当前数值                    │
│    BrandDimensionSnapshot  历史趋势                                   │
│    GapReport               某品牌 vs 竞争对手某次差距快照              │
│    GrowthPlan              30 天行动清单 + 预计提升                    │
│    ScanJob                 扫描任务（LLM 链路）                        │
│    CollectorRun            采集任务（采集器链路）                      │
│                                                                     │
│  旧表（保留只读）：Citation / CitationEvidence / CitationSource /    │
│                   GapAnalysis / RecommendationFactor / ScanRun ...  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 一次完整扫描的数据流

以 OCR 行业、TextIn 这个用户品牌为例：

```
1. 用户在前端 /citations 点 "刷新"
2. POST /api/v2/scan { brandId }
3. ScanJobService 把任务入库:
   ScanJob (kind=llm_extract, brandId, status=pending) × N 条
   N = 该 brand 取样 prompt 数（默认 50）
4. Cron 每 1 分钟 POST /api/cron/run-jobs
   dispatcher 按 priority + createdAt 取 5 条 ScanJob 串行跑
5. scan.runner 对每条 ScanJob:
   - PromptLibraryEngine 取 prompt 文本
   - LLM Collector 调 DeepSeek + ChatGPT 拿回答
   - CitationGraphEngine 抽取 "回答里提到的品牌 + 引用源"
   - 写入 CitationNode / CitationEdge
   - 对每个新见到的"品牌"，enqueue 3 条 CollectorRun (github / website / zhihu)
6. collect.runner 对每条 CollectorRun:
   - 调对应 collector 拉公开数据
   - upsert BrandDimension（按维度 + 时间窗口）
7. 当一个 brand 的本批 ScanJob 全部完成 + CollectorRun 全部完成:
   - GapEngine v2 重算该 brand vs 竞争对手的 GapReport
   - GrowthAgentEngine 重算该 brand 的 GrowthPlan
8. 前端三页 GET /api/v2/{citations,gaps,growth}?brandId 直接读 v2 表
```

### 2.3 关键边界

- **三页只读 v2**：不再调用旧 engine，旧引擎留着是为了不破坏 Dashboard 等页面的旧字段。
- **采集器隔离**：每个 collector 独立 module，单一职责，单测可脱离 LLM 跑。
- **行业可配置**：OCR 的“维度权重 / 引用源 / 别名 / 竞品列表”放在 `src/lib/v2/industries/ocr.config.ts`。
- **调度无状态**：dispatcher 不持运行时状态，job 状态全在 PG，任意 Vercel 实例 / 本地 node 都能跑。

### 2.4 架构关键风险

| 风险 | 处理方式 |
|---|---|
| LLM 抽取不稳定（同 prompt 不同回答） | 每条 prompt 在两个渠道（DeepSeek + ChatGPT）都跑，结果取并集；CitationEdge 带 `confidence` 字段 |
| 知乎 / 官网反爬 | 采集器加 24h 缓存 + 失败降级（拿不到就保留上一次值，标 `stale=true`） |
| Cron 跑太久超 Vercel 限额 | 每次 dispatcher 只取 5 条，串行执行，单条 timeout 60s；跑不完留下一轮 |
| 旧表和新表数据漂移 | 旧 engine 不再写新数据，前端三页只读 v2，互不干扰 |

---

## 3. Module Design

### 3.1 PromptLibraryEngine

**职责**：管理 OCR 行业 prompt 池，提供取样、按分类查询、新增打标签的能力。500 条 OCR prompt 是首发资产。

**接口**
```ts
interface PromptLibraryEngine {
  sample(industry: 'ocr', count: number, opts?: { categories?: string[] }): Promise<PromptItem[]>
  list(industry: 'ocr', opts?: { category?: string; page?: number }): Promise<PromptItem[]>
  upsert(items: PromptItem[]): Promise<void>
}

type PromptItem = {
  id: string
  industry: string                 // 'ocr'
  text: string                     // "最好的OCR厂商有哪些"
  category: string                 // 'comparison' | 'recommendation' | 'how-to' | ...
  language: 'zh' | 'en'
}
```

**依赖**：Prisma `PromptLibrary` 表。
**首发数据**：人工 200 条 + 半自动 300 条 OCR prompt，落进 `prisma/seed-v2-prompts-ocr.json`。

### 3.2 LLMCollector

**职责**：调 DeepSeek + ChatGPT 拿回答，**不做抽取**（抽取由 CitationGraphEngine 接管）。

**接口**
```ts
interface LLMCollector {
  ask(channel: 'deepseek' | 'chatgpt', prompt: string): Promise<LLMAnswer>
}

type LLMAnswer = {
  channel: 'deepseek' | 'chatgpt'
  prompt: string
  answer: string
  cost: number          // tokens
  latencyMs: number
  raw: unknown
}
```

**依赖**：现有 `src/lib/deepseek.ts` + 新增 ChatGPT 适配。
**风险处理**：超时 30s，失败抛 `LLMError`，由 scan.runner 捕获写入 `ScanJob.error`。

### 3.3 CitationGraphEngine

**职责**：把 LLMAnswer 抽成结构化的“品牌 + 引用源”，写进 CitationNode / CitationEdge；同时给 `/citations` 页提供归因数据。

**接口**
```ts
interface CitationGraphEngine {
  extract(answer: LLMAnswer, ctx: ExtractCtx): Promise<ExtractedCitation>
  persist(extracted: ExtractedCitation): Promise<void>
  getAttribution(brandId: string, opts?: { window?: '7d'|'30d' }): Promise<BrandAttribution>
}

type ExtractCtx = { industry: 'ocr'; userBrandId: string; promptId: string }

type ExtractedCitation = {
  brandsMentioned: { name: string; rank: number }[]
  sources: { type: 'website'|'github'|'doc'|'media'|'zhihu'; url?: string; brandName: string }[]
  confidence: number
}

type BrandAttribution = {
  brandId: string
  totalMentions: number
  weights: { website: number; github: number; doc: number; media: number; zhihu: number }
  topPrompts: { promptText: string; rank: number }[]
}
```

**抽取实现**：先用正则 + 关键词字典 + LLM JSON 输出双重验证，**先做规则，不做模型微调**。

### 3.4 Collectors（GitHub / Website / Zhihu）

**职责**：每个采集器拉一个维度的公开数据，输出 `BrandDimensionUpdate`，写入 BrandDimension 表。

**统一接口**
```ts
interface Collector {
  readonly dimension: 'github' | 'website' | 'zhihu'
  collect(brand: BrandSeed): Promise<BrandDimensionUpdate>
}

type BrandSeed = { brandId: string; name: string; domain?: string; aliases?: string[] }

type BrandDimensionUpdate = {
  brandId: string
  dimension: 'github'|'website'|'zhihu'
  metric: number
  detail: Record<string, unknown>
  collectedAt: Date
  stale: boolean
}
```

**实现要点**

- **GitHub**：用 GitHub Search API（带 token 5000/h），按 brand 名 + alias 搜 repo / org，记录项目数 + 总 stars。
- **Website**：用 Bing Web Search API + `site:` 估算索引页数，免费层够用，后面可换。
- **Zhihu**：用站内搜索接口拉提及数 + 取前 20 条标题；24h 缓存；命中反爬就回退到上一次值。
- **每个采集器单独可测**，用录制的 fixture 跑单测，不打真实网络。

**风险**：知乎反爬最严重，做好降级即可，不投入做代理池。

### 3.5 GapEngine v2

**职责**：拿一个用户品牌 + 一组竞争对手 + 当前 BrandDimension 数据，算出维度差距，写入 GapReport。

**接口**
```ts
interface GapEngineV2 {
  computeReport(input: {
    userBrandId: string
    competitorBrandIds: string[]
    snapshotAt?: Date
  }): Promise<GapReport>
  getLatest(brandId: string): Promise<GapReport | null>
}

type GapReport = {
  id: string
  userBrandId: string
  snapshotAt: Date
  rows: GapRow[]
  narrative: string             // 模板生成，不调 LLM
}

type GapRow = {
  dimension: 'github'|'website'|'zhihu'|'mention_rate'
  user: { metric: number; detail?: unknown }
  competitors: { brandId: string; name: string; metric: number }[]
  gapPct: number
}
```

**依赖**：CitationGraphEngine（拿 mention_rate）+ BrandDimension（拿其他维度）。
**narrative 文案**：模板生成（"腾讯 OCR 在 GitHub 有 200 个项目，你只有 5 个，差距 97%"），不调 LLM。

### 3.6 GrowthAgentEngine

**职责**：基于最新 GapReport，给出未来 30 天的 3 条优先级行动建议 + 预计曝光提升。

**接口**
```ts
interface GrowthAgentEngine {
  computePlan(userBrandId: string): Promise<GrowthPlan>
  getLatest(brandId: string): Promise<GrowthPlan | null>
}

type GrowthPlan = {
  id: string
  userBrandId: string
  generatedAt: Date
  actions: GrowthAction[]        // 长度 3，按 priority 升序
}

type GrowthAction = {
  priority: 1 | 2 | 3
  title: string
  rationale: string
  estimatedLiftPct: number       // 上限 50%
  dimension: GapRow['dimension']
}
```

**计算实现**

1. 取最新 GapReport，按 `gapPct * dimensionWeight` 排序（dimensionWeight 来自 industry config）。
2. 取 top 3 维度，每个维度查 `industries/ocr.actions.yaml` 拿动作模板。
3. `estimatedLiftPct = min(50, gapPct * 0.15)`，留接口后面用真实回归数据替换。

**为什么不调 LLM**：成本 + 不稳定，规则版可解释、可单测、可观测；后面想要更"智能"再加 LLM-rephrase 层。

### 3.7 ScanJob + CollectorRun + Dispatcher

**ScanJob 表**
```ts
type ScanJob = {
  id: string
  brandId: string
  promptId: string
  channel: 'deepseek' | 'chatgpt'
  status: 'pending' | 'running' | 'done' | 'failed'
  attempts: number
  error?: string
  createdAt: Date; updatedAt: Date
  priority: number              // 数值越小越先跑
}
```

**CollectorRun 表**：结构同上，多一个 `dimension` 字段。

**Dispatcher**

- 入口：`POST /api/cron/run-jobs`，校验 `CRON_SECRET`。
- 每轮先取 5 条 ScanJob pending（`SELECT FOR UPDATE SKIP LOCKED`）串行跑 scan.runner。
- 再取 5 条 CollectorRun pending 串行跑 collect.runner。
- 单条超时 60s；失败 attempts++；attempts ≥ 3 标 failed。
- 一个 brand 当批 ScanJob 全 done → enqueue Gap + Growth 重算 job。

**Cron 周期**

- Vercel Cron 每 1 分钟一次。
- 每天 03:00 跑一次"全量刷新"，对所有活跃 brand 重新 enqueue 50 条 ScanJob。

**单元独立性**：runner 不依赖 dispatcher，可本地手动 `npm run dev:run-jobs` 触发；dispatcher 不依赖 runner 内部，只看 status。

### 3.8 三页前端（消费 v2）

| 页 | 关键展示 | API |
|---|---|---|
| `/citations` | 4 维度归因卡片（doc/website/github/media）+ topPrompts 列表 | `GET /api/v2/citations?brandId` |
| `/gaps` | 4 维度差距条形图 + 焦虑文案 narrative | `GET /api/v2/gaps?brandId` |
| `/growth` | 3 张优先级卡（priority 1/2/3）+ estimatedLift | `GET /api/v2/growth?brandId` |

每页顶部"刷新"按钮 → `POST /api/v2/scan`。三页只展示，不直接调 engine，全部走 API。

---

## 4. Data Flow & Error Handling

### 4.1 端到端时序（用户点 “刷新”）

```
User                Frontend           API              ScanJob          Cron/Dispatcher       Runners              DB
 │                    │                  │                 │                   │                   │                  │
 │  click 刷新        │                  │                 │                   │                   │                  │
 ├───────────────────►│                  │                 │                   │                   │                  │
 │                    │ POST /api/v2/scan│                 │                   │                   │                  │
 │                    ├─────────────────►│                 │                   │                   │                  │
 │                    │                  │  enqueue 50     │                   │                   │                  │
 │                    │                  ├────────────────►│ insert 50 rows    │                   │                  │
 │                    │ 200 { batchId }  │                 │                   │                   │                  │
 │                    │◄─────────────────┤                 │                   │                   │                  │
 │  UI 显示"扫描中"   │                  │                 │   每 60s 轮询      │                   │                  │
 │                    │                  │                 │                   │ POST /api/cron/run-jobs              │
 │                    │                  │                 │                   ├──────────────────►│                  │
 │                    │                  │                 │                   │  pick 5 pending   │                  │
 │                    │                  │                 │                   ├──────────────────►│ scan.runner ×5   │
 │                    │                  │                 │                   │                   │ ├ LLM ask        │
 │                    │                  │                 │                   │                   │ ├ extract        │
 │                    │                  │                 │                   │                   │ └ persist        │
 │                    │                  │                 │                   │                   │ enqueue collect  │
 │                    │                  │  ...许多轮 cron 循环...                                                     │
 │                    │                  │  batch all done?│                   │                   │                  │
 │                    │                  ├────────────────►│ 是 → enqueue      │                   │                  │
 │                    │                  │                 │ Gap + Growth 重算 │                   │                  │
 │  UI 轮询 /api/v2/{citations,gaps,growth}?brandId 拿到新数据                                                          │
```

时间预算（OCR 单 brand 一次扫描）：

- ScanJob 50 条 × 平均 8s/条 / 每轮 5 条并发 ≈ **80 秒**。
- CollectorRun ≈ 12 条（4 brand × 3 维度）× 6s/条 / 每轮 5 条 ≈ **15 秒**。
- Gap + Growth 计算 < 2 秒。
- **整批端到端 ≤ 2 分钟**（Cron 每分钟一次，最差 3 分钟）。

### 4.2 一条 ScanJob 内部执行链

```
scan.runner.run(jobId):
  1. SELECT FOR UPDATE SKIP LOCKED  ← 防止两个 cron 同时取到同一行
  2. job.status = 'running'; attempts++
  3. prompt = PromptLibrary.find(job.promptId)
  4. answer = LLMCollector.ask(job.channel, prompt.text)        ← 可能 LLMError
  5. extracted = CitationGraphEngine.extract(answer, ctx)        ← 可能 ExtractError
  6. CitationGraphEngine.persist(extracted)                      ← 事务
  7. for newBrand in extracted.brandsMentioned:
        for dim in ['github','website','zhihu']:
            CollectorRun.upsert({ brandId, dimension: dim, status: pending })   ← 去重
  8. job.status = 'done'
```

### 4.3 错误分类 + 处理策略

| 错误类型 | 来源 | 处理 |
|---|---|---|
| `LLMError`（超时 / 限流 / 5xx） | LLMCollector | attempts<3 → 留 pending；attempts≥3 → failed，记 error |
| `LLMRefusal`（模型拒答 / 输出空） | LLMCollector | done，写空 result，不计失败 |
| `ExtractError`（JSON 不合法） | CitationGraphEngine | 重试一次；仍失败 → done，confidence=0 |
| `CollectorError.ratelimit` | GitHub/Bing/Zhihu | attempts<5 → 留 pending，指数退避（10/30/90s）；超过 → 用上次值，`stale=true` |
| `CollectorError.banned`（403/429） | Zhihu | 直接降级到上次值，`stale=true`，不重试，不报警 |
| `CollectorError.notfound` | 采集器找不到品牌 | metric=0，标 `notfound=true`，不算失败 |
| `DBError` | Prisma | 抛出，dispatcher 整轮失败，下轮 cron 自然重来 |
| `TimeoutError`（runner 超 60s） | runner 本身 | 当前 job 标 pending，不计 attempts |

### 4.4 一致性策略

- **ScanJob 幂等**：`(brandId, promptId, channel)` 唯一约束。
- **CollectorRun 幂等**：`(brandId, dimension)` 在 24h 内只跑一次。
- **CitationEdge upsert**：`(promptId, channel, brandId, sourceUrl)` 复合唯一索引去重。
- **BrandDimension upsert**：`(brandId, dimension)` 只保留最新；历史趋势写入 `BrandDimensionSnapshot`。
- **GapReport / GrowthPlan 只插不改**：每次重算插一条新行，前端读最新；趋势可以直接画。

### 4.5 用户可见的错误体验

- 三页都有"最后更新：3 分钟前 / 2 小时前 / **stale**"角标。
- 任一维度 stale 时，差距条形图加灰色斜纹 + tooltip "数据采集暂时失败，显示上次值"。
- ScanJob batch 整批失败率 > 50%：三页顶部黄条 "部分数据可能不完整，[重新扫描]"。
- 用户**永远看不到红色错误页** —— 缺数据 = 显示 stale 或空状态文案。

### 4.6 可观测性（最小集）

只做这三件事，不接 Sentry / Datadog：

1. 每条 job 的 `error` 字段写进 PG，后台用 SQL 直接查。
2. dispatcher 每轮跑完打印结构化 log：`{batch, scanDone, scanFailed, collectDone, collectFailed, durationMs}`。
3. 隐藏路径 `/api/v2/_admin/jobs?secret=...` 返回最近 100 条失败 job（复用 `CRON_SECRET`，不做单独权限）。

---

## 5. Testing Strategy

### 5.1 测试金字塔

```
         ┌──────────────────────────────┐
         │ E2E (Playwright)        2-3  │
         ├──────────────────────────────┤
         │ Integration (vitest)    8-10 │
         ├──────────────────────────────┤
         │ Unit (vitest)           30+  │
         └──────────────────────────────┘
```

刻意控量。v2 只覆盖**会引起线上事故的路径**和**会被反复改的纯逻辑**。不追求覆盖率 KPI。

### 5.2 单元测试

| 模块 | 关键 case |
|---|---|
| `CitationGraphEngine.extract` | 正常抽 3 品牌 / 没提到任何品牌 / JSON 非法 / 别名归一（"腾讯OCR" / "腾讯云 OCR" / "Tencent OCR"） |
| `GapEngine.computeReport` | user metric=0 / competitor metric=0 / 全部维度 stale / 只有一个竞品 |
| `GrowthAgentEngine.computePlan` | 没有 GapReport / 三维度并列按 industry weight 排 / estimatedLift ≤ 50% |
| `PromptLibraryEngine.sample` | 取样数 > 总量返回全部 / 按 category 过滤 / 同 seed 可复现 |
| 每个 Collector | 正常 / 限流 (429) / 被 ban (403) / notfound / 超时 |

约束：

- 每个测试 < 50ms。
- collector 用 `tests/fixtures/{github,website,zhihu}/*.json` 跑，不打真实网络。
- 用 vitest + Prisma mock，不需要 DB。

### 5.3 集成测试（带 DB，临时 schema）

| case | 验证 |
|---|---|
| `enqueueAndDispatch.scanjob.happy` | enqueue 5 条 → dispatch 一轮 → 全部 done，CitationEdge 表有数据 |
| `enqueueAndDispatch.scanjob.idempotent` | 重复 enqueue 同 (brandId, promptId, channel) 不会建 2 行 |
| `enqueueAndDispatch.scanjob.retry` | 模拟 LLM 超时 → attempts++ → 第 3 次仍超时 → failed |
| `enqueueAndDispatch.collect.stale` | collector 抛 banned → 写入 stale=true 的 BrandDimension，metric 用上次值 |
| `enqueueAndDispatch.concurrency` | 两个 dispatcher 实例同时跑，靠 SKIP LOCKED 不会取到同一 job |
| `gap+growth.refresh` | 一批 ScanJob 全 done 后自动 enqueue 重算，GapReport 和 GrowthPlan 各新增一条 |
| `cron.auth` | 没有 CRON_SECRET 调 `/api/cron/run-jobs` → 401 |
| `api.v2.citations` | 三页 API 在没数据时返回空状态 schema，不抛 500 |

实现细节：

- vitest + `dotenv -e .env.test` + 独立测试 DB（schema=`geoscore_test_v2`）。
- 每个测试前 `prisma db push --accept-data-loss` 重建表。
- LLM 用 `FakeLLMCollector` 替换，按 prompt 文本返回固定答案。

### 5.4 E2E（Playwright）

| case | 步骤 |
|---|---|
| `e2e.citations.attribution` | demo 登录 → /citations → 看到 4 维度归因卡片 → 切 brand → 数据变 |
| `e2e.gaps.refresh` | /gaps → 点刷新 → "扫描中" → 等到完成 → 看到差距条形图 + narrative |
| `e2e.growth.actions` | /growth → 看到 3 张优先级卡 + estimatedLift |

实现：

- 跑在本地 dev server，连 `geoscore_test_v2` DB。
- 启动前 seed 一份预制 OCR 数据（4 品牌 + 已跑完的 GapReport / GrowthPlan）。
- `npm run test:e2e` 单独命令，不进 PR 必跑（走 nightly）。

### 5.5 Seed / Fixture 资产

| 资产 | 内容 | 位置 |
|---|---|---|
| OCR 行业 prompt seed | 500 条 prompt，分类打标 | `prisma/seed-v2-prompts-ocr.json` |
| OCR 4 品牌 seed | TextIn / 腾讯 OCR / 百度 OCR / 阿里 OCR + 别名 | `prisma/seed-v2-brands-ocr.json` |
| GitHub collector fixture | 4 品牌 × 限流 / 正常 / 空结果 | `tests/fixtures/github/*.json` |
| Website collector fixture | 4 品牌 × 同上 | `tests/fixtures/website/*.json` |
| Zhihu collector fixture | 4 品牌 × 包含被 ban 一例 | `tests/fixtures/zhihu/*.json` |
| LLM answer fixture | 50 prompt × 2 渠道 = 100 条预录回答 | `tests/fixtures/llm/*.json` |

`npm run db:seed:v2` 一行命令拿到本地能跑的 demo 数据库。

### 5.6 不做的事

- 不做覆盖率 KPI。
- 不做性能基准测试。
- 不做 LLM 输出快照测试。
- 不接 Sentry / Datadog。

---

## 6. Delivery Roadmap

### Phase 0 · 开工准备（约 3 天）

- 等 phone-first 合 main。
- 从 main 切 `feature/20260619/geo-core-v2-ocr`。
- 建 v2 目录骨架：`src/lib/v2/{engines,collectors,jobs,industries}`。
- 建 v2 Prisma 模型 8 张表，`prisma db push` 跑通。
- 建 `industries/ocr.config.ts`：维度权重、品牌别名、competitor 列表。
- 写 OCR 4 品牌 seed + 50 条种子 prompt。
- `npm run db:seed:v2` 跑通。

完成标志：本地 PG 里 v2 表都建好，OCR 4 品牌 + 50 prompt 入库。

### Phase 1 · 数据资产层（1 周）

- `PromptLibraryEngine` + 4 个单测。
- `CitationGraphEngine.persist` / `getAttribution` + 5 个单测。
- 灌入 500 条 OCR prompt（人工 200 + 半自动 300）。
- 锁定 `ocr.config.ts`：4 品牌 + 5 别名 + 4 维度权重 (`doc:0.4 / website:0.3 / github:0.2 / zhihu:0.1`)。

完成标志：单测全绿；500 prompt 在表里；脚本插一条假 CitationEdge 能从 `getAttribution` 读出。

### Phase 2 · LLM 链路（1 周）

- `LLMCollector`（DeepSeek 已有 + ChatGPT 适配）。
- `CitationGraphEngine.extract`：规则 + LLM JSON 双重验证。
- `ScanJob` 表 + `scan.runner` + `dispatcher`。
- `/api/v2/scan` POST + `/api/cron/run-jobs` POST。
- `SELECT FOR UPDATE SKIP LOCKED` 并发安全。
- 集成测试 4 个：happy / idempotent / retry / concurrency。

完成标志：dev 环境点一次刷新，2 分钟后 PG 里多出一批 CitationNode + CitationEdge，全部带真实 DeepSeek + ChatGPT 抽取结果。

### Phase 3 · 采集器 + Gap + Growth（1.5 周）

- 3 个 Collector（GitHub / Website-Bing / Zhihu）+ fixture 单测各 5 个。
- `CollectorRun` 表 + `collect.runner`，dispatcher 增加采集队列。
- `BrandDimension` upsert + 24h 缓存 + stale 标记。
- `GapEngineV2.computeReport` + 4 单测。
- `GrowthAgentEngine.computePlan` + 3 单测 + `industries/ocr.actions.yaml`。
- 一批 ScanJob 全 done 后自动 enqueue 重算这条逻辑接通。

完成标志：dev 环境完整刷新（≤ 3 分钟），PG 里 GapReport + GrowthPlan 各多一条，数据真实。

### Phase 4 · 三页重写 + 端到端联调（1 周）

- `/citations` 重写：4 维度归因卡片 + topPrompts。
- `/gaps` 重写：差距条形图 + narrative + stale 灰条。
- `/growth` 重写：3 张优先级卡 + estimatedLift。
- 三页 `/api/v2/{citations,gaps,growth}` GET API。
- "最后更新 / stale" 角标统一组件。
- E2E 3 条 + 整体 verify。

完成标志：demo 账号登录 → 切到 OCR brand → 点一次刷新 → 三页数据全部真实更新；E2E 全绿。

### 6.1 总体节奏

| Phase | 时长 | 用户能看到啥 |
|---|---|---|
| 0 | 3 天 | 无（基础设施） |
| 1 | 1 周 | 无（数据层） |
| 2 | 1 周 | 后台能看到 CitationEdge 在涨 |
| 3 | 1.5 周 | 后台能看到差距 + 行动数据 |
| 4 | 1 周 | 用户看到"为什么 AI 推荐别人" |

总计约 **4 周**，与 4–5 周预算对齐，留 0.5–1 周 buffer 给采集器反爬和真实数据调校。

### 6.2 不进路线图的事（明确推迟）

- 横向加行业（OCR 跑稳之后，Phase 5 单独排）。
- 后台运营仪表盘（v3）。
- LLM-rephrase 让 Growth 行动文案更像“人写的”（v3）。
- 采集器代理池（被 ban 严重时再说，不要先做）。
- 旧 engine / 旧表删除（v3，等 v2 稳定 2 个月以上）。

---

## 7. Risks & Open Questions

| 风险 | 缓解 |
|---|---|
| phone-first 迟迟不合 main，阻塞 v2 Phase 0 | v2 Phase 0 可先在 main 上拉的临时 sandbox 分支搭骨架，phone-first 一合就 rebase；不阻塞 spec/plan 阶段 |
| Bing Web Search API 免费额度耗尽 | 单 brand 一天最多调 1 次（24h 缓存），4 brand × 30 天 = 120 调用/月，远低于免费层 |
| ChatGPT 国内调用不稳定 | 接 OpenAI 官方 + 一个国内代理 endpoint 切换，由 LLMCollector 内部兜底 |
| 旧 `Citation` 表和新 `CitationNode/Edge` 同时存在易混 | 命名前缀 v2 + 文档明确"前端三页只读 v2"；code review 时检查不要在 v2 里写旧表 |

### 待办（不阻塞设计审核）

- ChatGPT 适配走 OpenAI 官方还是国内代理：Phase 2 起点处再决定。
- Bing Web Search API key 申请：Phase 0 末尾启动。
- OCR 行业 500 prompt 的半自动产出脚本：Phase 1 内单独排。
