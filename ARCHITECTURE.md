# GeoScore v2 Architecture & Implementation Plan

> AI Search Exposure Growth Platform
> 版本：v2.0 | 日期：2026-06-11 | 作者：Wang Bo + Hermes Agent

---

## 一、产品定位

```
GeoScore = AI 搜索曝光增长平台

核心价值：
- 帮品牌在 ChatGPT / Gemini / Claude / Perplexity 中被推荐
- 量化 AI 推荐概率 → 找到差距 → 自动生成内容 → 提升曝光

护城河：
- Citation Intelligence（谁在影响 AI 推荐你）
- GEO Gap（AI 为什么不推荐你）
```

---

## 二、模块架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GeoScore v2                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ Auth Module │  │Billing Module│  │ Quota Module│                │
│  │  (NextAuth) │  │  (微信/支付宝) │  │  (用量控制)  │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    GEO Core Engine                           │  │
│  │                                                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │  Scan    │  │ Citation │  │   Gap    │  │ Content  │   │  │
│  │  │  Engine  │  │  Engine  │  │  Engine  │  │  Engine  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  │                                                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │  │
│  │  │ Publish  │  │  Trend   │  │ Forecast │                  │  │
│  │  │  Engine  │  │  Engine  │  │  Engine  │                  │  │
│  │  └──────────┘  └──────────┘  └──────────┘                  │  │
│  │                                                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Admin Module                              │  │
│  │  用户管理 | 订单管理 | 额度监控 | 系统配置                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│  │PostgreSQL │  │   Redis   │  │  BullMQ   │  │ DeepSeek  │      │
│  │  (主数据库) │  │ (缓存/队列) │  │ (任务调度) │  │  (AI模型)  │      │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、数据库 ER 设计

### 3.1 模型分组

```
┌─────────────────────────────────────────────────────────────────┐
│                        Auth & User                              │
│  User ──┬── Account (OAuth)                                     │
│         ├── Session                                             │
│         └── VerificationToken                                   │
├─────────────────────────────────────────────────────────────────┤
│                       Billing                                   │
│  User ──┬── Subscription (套餐订阅)                              │
│         ├── Order (订单)                                        │
│         └── Payment (支付记录)                                   │
├─────────────────────────────────────────────────────────────────┤
│                        Quota                                    │
│  User ──── Quota (额度池)                                       │
│  Quota ─── QuotaUsage (用量明细)                                 │
├─────────────────────────────────────────────────────────────────┤
│                      Brand & Scan                               │
│  User ──┬── Brand ──┬── Prompt                                 │
│         │           ├── Competitor                              │
│         │           └── ScanJob ─── ScanResult                  │
│         └── PromptLibrary (公共 Prompt 库)                       │
├─────────────────────────────────────────────────────────────────┤
│                    Citation Intelligence                        │
│  Brand ──┬── Citation (引用记录)                                 │
│          ├── CitationSource (引用来源)                           │
│          └── CitationInfluence (影响力评分)                      │
├─────────────────────────────────────────────────────────────────┤
│                       GEO Gap                                   │
│  Brand ──── GapAnalysis (差距分析)                               │
│  GapAnalysis ─── GapItem (差距项)                               │
│  GapItem ─── ContentTask (生成任务)                              │
├─────────────────────────────────────────────────────────────────┤
│                     Content & Publish                           │
│  ContentTask ─── ContentPiece (生成内容)                         │
│  ContentPiece ─── PublishJob (发布任务)                          │
├─────────────────────────────────────────────────────────────────┤
│                      Trend & Alert                              │
│  Brand ──┬── TrendSignal (趋势信号)                              │
│          └── Alert (告警)                                       │
├─────────────────────────────────────────────────────────────────┤
│                       Admin                                     │
│  AdminLog (操作日志)                                             │
│  SystemConfig (系统配置)                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 完整 Prisma Schema

```prisma
// ============================================
// GeoScore v2 - Complete Database Schema
// ============================================

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// AUTH & USER
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  image         String?
  role          UserRole  @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts        Account[]
  sessions        Session[]
  brands          Brand[]
  subscriptions   Subscription[]
  orders          Order[]
  quotas          Quota[]
  prompts         Prompt[]
  promptLibrary   PromptLibrary[]
  adminLogs       AdminLog[]
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// BILLING & SUBSCRIPTION
// ============================================

model Subscription {
  id            String   @id @default(cuid())
  userId        String
  plan          Plan
  status        SubStatus @default(ACTIVE)
  startDate     DateTime @default(now())
  endDate       DateTime?
  autoRenew     Boolean  @default(true)
  paymentMethod String?  // wechat, alipay, stripe
  externalId    String?  // 第三方订阅 ID
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders Order[]

  @@index([userId, status])
}

enum Plan {
  FREE
  PROFESSIONAL
  GROWTH
  ENTERPRISE
}

enum SubStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  PAUSED
}

model Order {
  id            String   @id @default(cuid())
  userId        String
  subscriptionId String?
  orderNo       String   @unique
  plan          Plan
  amount        Decimal  @db.Decimal(10, 2)
  currency      String   @default("CNY")
  status        OrderStatus @default(PENDING)
  paymentMethod String?  // wechat, alipay
  paymentId     String?  // 第三方支付单号
  paidAt        DateTime?
  expiredAt     DateTime?
  meta          Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id])
  payments     Payment[]

  @@index([userId, status])
  @@index([orderNo])
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  CANCELLED
}

model Payment {
  id          String   @id @default(cuid())
  orderId     String
  method      String   // wechat, alipay
  amount      Decimal  @db.Decimal(10, 2)
  currency    String   @default("CNY")
  status      PayStatus @default(PENDING)
  externalId  String?  // 第三方支付流水号
  callbackUrl String?
  callbackData Json?
  paidAt      DateTime?
  createdAt   DateTime @default(now())

  order Order @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([externalId])
}

enum PayStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

// ============================================
// QUOTA & USAGE
// ============================================

model Quota {
  id          String   @id @default(cuid())
  userId      String
  type        QuotaType
  total       Int      // 总额度
  used        Int      @default(0) // 已用
  remaining   Int      // 剩余 (total - used)
  period      String   // monthly, yearly, lifetime
  periodStart DateTime
  periodEnd   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user   User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  usages QuotaUsage[]

  @@unique([userId, type, period, periodStart])
  @@index([userId, type])
}

enum QuotaType {
  SCAN
  PROMPT
  CITATION_ANALYSIS
  GAP_ANALYSIS
  CONTENT_GENERATE
  REPORT_GENERATE
  TOKEN_USAGE
}

model QuotaUsage {
  id          String   @id @default(cuid())
  quotaId     String
  amount      Int
  description String?
  meta        Json?    // {scanId, promptId, etc}
  createdAt   DateTime @default(now())

  quota Quota @relation(fields: [quotaId], references: [id], onDelete: Cascade)

  @@index([quotaId, createdAt])
}

// ============================================
// BRAND & COMPETITORS
// ============================================

model Brand {
  id          String   @id @default(cuid())
  userId      String
  name        String
  domain      String?
  description String?
  category    String?
  status      BrandStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  competitors     Competitor[]     @relation("BrandCompetitors")
  competitorOf    Competitor[]     @relation("CompetitorOf")
  prompts         Prompt[]
  scanJobs        ScanJob[]
  citations       Citation[]
  citationSources CitationSource[]
  gapAnalyses     GapAnalysis[]
  trendSignals    TrendSignal[]
  contentPieces   ContentPiece[]

  @@unique([userId, name])
  @@index([userId, status])
}

enum BrandStatus {
  ACTIVE
  ARCHIVED
}

model Competitor {
  id            String   @id @default(cuid())
  brandId       String
  competitorId  String
  addedAt       DateTime @default(now())

  brand      Brand @relation("BrandCompetitors", fields: [brandId], references: [id], onDelete: Cascade)
  competitor Brand @relation("CompetitorOf", fields: [competitorId], references: [id], onDelete: Cascade)

  @@unique([brandId, competitorId])
}

// ============================================
// SCAN ENGINE
// ============================================

model Prompt {
  id           String   @id @default(cuid())
  brandId      String
  userId       String
  text         String   @db.Text
  category     String?  // informational, commercial, comparison, tutorial
  intent       String?  // recommend, compare, review, explain
  language     String   @default("zh")
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  brand       Brand         @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  scanResults ScanResult[]

  @@index([brandId, isActive])
}

model PromptLibrary {
  id          String   @id @default(cuid())
  userId      String?  // null = system public
  category    String
  intent      String
  text        String   @db.Text
  language    String   @default("zh")
  useCount    Int      @default(0)
  createdAt   DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([category, intent])
}

model ScanJob {
  id              String     @id @default(cuid())
  brandId         String
  userId          String
  status          ScanStatus @default(QUEUED)
  platforms       String[]   // ['chatgpt','gemini','claude','perplexity']
  totalPrompts    Int        @default(0)
  completedPrompts Int       @default(0)
  triggeredBy     String     @default("user") // user, cron
  errorMsg        String?    @db.Text
  startedAt       DateTime   @default(now())
  completedAt     DateTime?

  brand       Brand        @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  scanResults ScanResult[]

  @@index([brandId, startedAt])
  @@index([userId, status])
}

enum ScanStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

model ScanResult {
  id             String   @id @default(cuid())
  scanJobId      String
  promptId       String
  platform       String   // chatgpt, gemini, claude, perplexity, deepseek
  responseText   String?  @db.Text
  citedSources   Json?    // [{url, title, domain, snippet}]
  brandMentioned Boolean  @default(false)
  brandRank      Int?     // 1-based
  sentiment      String?  // positive, neutral, negative
  confidence     Float?   // 0-1
  latencyMs      Int?
  tokenUsage     Int?
  createdAt      DateTime @default(now())

  scanJob ScanJob @relation(fields: [scanJobId], references: [id], onDelete: Cascade)
  prompt  Prompt  @relation(fields: [promptId], references: [id], onDelete: Cascade)

  @@index([scanJobId, platform])
  @@index([brandMentioned, platform])
  @@index([promptId, createdAt])
}

// ============================================
// CITATION INTELLIGENCE (核心护城河 #1)
// ============================================

model Citation {
  id            String   @id @default(cuid())
  brandId       String
  userId        String
  platform      String
  promptText    String   @db.Text
  answerText    String   @db.Text
  sources       Json     // [{url, title, domain, snippet, position}]
  brandRank     Int?
  brandContext  String?  @db.Text
  aiScore       Float?   // AI 推荐概率 0-100
  confidence    Float?   // 置信度 0-1
  createdAt     DateTime @default(now())

  brand            Brand             @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  citationInfluences CitationInfluence[]

  @@index([brandId, platform, createdAt])
  @@index([userId, createdAt])
  @@index([aiScore])
}

model CitationSource {
  id            String   @id @default(cuid())
  brandId       String
  userId        String
  domain        String
  platform      String
  url           String   @db.Text
  title         String?
  sourceType    String?  // github, reddit, blog, news, forum, docs
  weight        Float    @default(1.0) // 影响权重 0-1
  citationCount Int      @default(1)
  sentiment     String?  // positive, neutral, negative
  firstSeen     DateTime @default(now())
  lastSeen      DateTime @default(now())

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([brandId, platform, url])
  @@index([brandId, weight])
  @@index([domain])
}

model CitationInfluence {
  id          String   @id @default(cuid())
  citationId  String
  sourceUrl   String   @db.Text
  sourceDomain String
  influence   Float    // 0-100, 对本次引用的影响度
  factor      String?  // github_star, reddit_upvote, blog_authority
  createdAt   DateTime @default(now())

  citation Citation @relation(fields: [citationId], references: [id], onDelete: Cascade)

  @@index([citationId, influence])
}

// ============================================
// GEO GAP (核心护城河 #2)
// ============================================

model GapAnalysis {
  id          String   @id @default(cuid())
  brandId     String
  userId      String
  competitorId String? // 可选，与谁对比
  platform    String
  promptText  String   @db.Text
  score       Float    // 当前 AI 推荐分 0-100
  benchmark   Float    // 竞对/行业基准分
  gap         Float    // 差距值
  status      String   @default("pending") // pending, analyzing, completed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  brand      Brand  @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  gapItems   GapItem[]

  @@index([brandId, createdAt])
  @@index([userId, gap])
}

model GapItem {
  id             String   @id @default(cuid())
  gapAnalysisId  String
  type           String   // faq, comparison, use_case, schema, media, github, readme
  title          String
  description    String   @db.Text
  impact         Float    // 对推荐概率的影响 -100 to 0
  priority       Int      // 1 = highest
  status         String   @default("open") // open, in_progress, resolved
  createdAt      DateTime @default(now())

  gapAnalysis  GapAnalysis   @relation(fields: [gapAnalysisId], references: [id], onDelete: Cascade)
  contentTasks ContentTask[]

  @@index([gapAnalysisId, priority])
}

// ============================================
// CONTENT ENGINE
// ============================================

model ContentTask {
  id          String   @id @default(cuid())
  gapItemId   String?
  brandId     String
  userId      String
  type        ContentType
  title       String
  prompt      String   @db.Text // 生成 prompt
  status      TaskStatus @default(PENDING)
  errorMsg    String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  gapItem       GapItem?       @relation(fields: [gapItemId], references: [id])
  brand         Brand          @relation(fields: [brandId], references: [id], onDelete: Cascade)
  contentPieces ContentPiece[]

  @@index([brandId, status])
  @@index([userId, type])
}

enum ContentType {
  FAQ
  COMPARISON
  USE_CASE
  SCHEMA
  BLOG_POST
  REDDIT_POST
  GITHUB_README
  ZHIHU_ANSWER
  WECHAT_ARTICLE
  MEDIA_PITCH
}

enum TaskStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
}

model ContentPiece {
  id            String   @id @default(cuid())
  contentTaskId String?
  brandId       String
  userId        String
  type          ContentType
  title         String
  body          String   @db.Text
  meta          Json?    // {targetKeyword, citationGap, wordCount}
  quality       Int?     // 0-100 AI 自评分
  status        ContentStatus @default(DRAFT)
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  contentTask  ContentTask?  @relation(fields: [contentTaskId], references: [id])
  brand        Brand         @relation(fields: [brandId], references: [id], onDelete: Cascade)
  publishJobs  PublishJob[]

  @@index([brandId, type, status])
}

enum ContentStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

// ============================================
// PUBLISH ENGINE
// ============================================

model PublishJob {
  id            String   @id @default(cuid())
  contentId     String
  userId        String
  channel       String   // wordpress, notion, webflow, reddit, zhihu, wechat
  status        PublishStatus @default(PENDING)
  externalUrl   String?
  response      Json?
  errorMsg      String?  @db.Text
  scheduledAt   DateTime?
  publishedAt   DateTime?
  createdAt     DateTime @default(now())

  content ContentPiece @relation(fields: [contentId], references: [id], onDelete: Cascade)
  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([contentId, status])
  @@index([userId, status])
}

enum PublishStatus {
  PENDING
  IN_PROGRESS
  PUBLISHED
  FAILED
  CANCELLED
}

// ============================================
// TREND & ALERT
// ============================================

model TrendSignal {
  id          String   @id @default(cuid())
  brandId     String?
  userId      String
  category    String   // question, topic, keyword
  text        String
  volume      Int      @default(0)
  growthPct   Float    @default(0)
  platforms   String[]
  detectedAt  DateTime @default(now())

  brand Brand? @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, growthPct])
  @@index([category, detectedAt])
}

model Alert {
  id         String   @id @default(cuid())
  brandId    String
  userId     String
  type       AlertType
  severity   AlertSeverity
  title      String
  message    String   @db.Text
  meta       Json?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead, createdAt])
}

enum AlertType {
  VISIBILITY_DROP
  NEW_COMPETITOR
  GAP_OPENED
  TREND_RISING
  CONTENT_PUBLISHED
  QUOTA_LOW
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// ============================================
// ADMIN
// ============================================

model AdminLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  target    String?
  meta      Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
}

model SystemConfig {
  id    String @id @default(cuid())
  key   String @unique
  value Json
  desc  String?
  updatedAt DateTime @updatedAt
}
```

---

## 四、API 设计

### 4.1 Auth Module

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 公开 |
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/signout` | 登出 | 用户 |
| GET | `/api/auth/session` | 获取会话 | 用户 |
| POST | `/api/auth/oauth/github` | GitHub OAuth | 公开 |

### 4.2 Brand Module

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/brands` | 我的品牌列表 | 用户 |
| POST | `/api/brands` | 创建品牌 | 用户 |
| GET | `/api/brands/[id]` | 品牌详情 | 用户 |
| PUT | `/api/brands/[id]` | 更新品牌 | 用户 |
| DELETE | `/api/brands/[id]` | 删除品牌 | 用户 |
| POST | `/api/brands/[id]/competitors` | 添加竞对 | 用户 |
| DELETE | `/api/brands/[id]/competitors/[cid]` | 删除竞对 | 用户 |

### 4.3 Scan Engine

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/scans` | 扫描任务列表 | 用户 |
| POST | `/api/scans` | 创建扫描任务 | 用户 + 额度检查 |
| GET | `/api/scans/[id]` | 扫描详情 | 用户 |
| POST | `/api/scans/[id]/cancel` | 取消扫描 | 用户 |
| GET | `/api/scans/[id]/results` | 扫描结果 | 用户 |
| GET | `/api/prompts` | Prompt 列表 | 用户 |
| POST | `/api/prompts` | 创建 Prompt | 用户 |
| PUT | `/api/prompts/[id]` | 更新 Prompt | 用户 |
| DELETE | `/api/prompts/[id]` | 删除 Prompt | 用户 |

### 4.4 Citation Intelligence (核心 #1)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/citations` | 引用记录列表 | 用户 |
| GET | `/api/citations/[id]` | 引用详情 + 影响因子 | 用户 |
| POST | `/api/citations/analyze` | 触发引用分析 | 用户 + 额度检查 |
| GET | `/api/citations/sources` | 引用来源排行 | 用户 |
| GET | `/api/citations/sources/[domain]` | 来源详情 | 用户 |
| GET | `/api/citations/heatmap` | 引用热力图数据 | 用户 |
| GET | `/api/citations/network` | 影响力网络图数据 | 用户 |
| GET | `/api/citations/trend` | 引用趋势 | 用户 |

### 4.5 GEO Gap (核心 #2)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/gaps` | Gap 分析列表 | 用户 |
| POST | `/api/gaps/analyze` | 触发 Gap 分析 | 用户 + 额度检查 |
| GET | `/api/gaps/[id]` | Gap 详情 | 用户 |
| GET | `/api/gaps/[id]/items` | 差距项列表 | 用户 |
| POST | `/api/gaps/[id]/items/[itemId]/resolve` | 标记已解决 | 用户 |
| GET | `/api/gaps/summary` | Gap 汇总统计 | 用户 |

### 4.6 Content Engine

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/content` | 内容列表 | 用户 |
| POST | `/api/content/generate` | 生成内容 | 用户 + 额度检查 |
| GET | `/api/content/[id]` | 内容详情 | 用户 |
| PUT | `/api/content/[id]` | 编辑内容 | 用户 |
| POST | `/api/content/[id]/approve` | 审批通过 | 用户 |
| DELETE | `/api/content/[id]` | 删除内容 | 用户 |

### 4.7 Publish Engine

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/publish` | 发布任务列表 | 用户 |
| POST | `/api/publish` | 创建发布任务 | 用户 |
| GET | `/api/publish/[id]` | 发布详情 | 用户 |
| POST | `/api/publish/[id]/cancel` | 取消发布 | 用户 |

### 4.8 Billing & Quota

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/billing/subscription` | 当前订阅 | 用户 |
| POST | `/api/billing/subscribe` | 创建订阅 | 用户 |
| POST | `/api/billing/cancel` | 取消订阅 | 用户 |
| GET | `/api/billing/orders` | 订单列表 | 用户 |
| GET | `/api/billing/orders/[id]` | 订单详情 | 用户 |
| POST | `/api/billing/pay/[orderNo]` | 发起支付 | 用户 |
| POST | `/api/billing/callback/wechat` | 微信支付回调 | 系统 |
| POST | `/api/billing/callback/alipay` | 支付宝回调 | 系统 |
| GET | `/api/quota` | 我的额度 | 用户 |
| GET | `/api/quota/usage` | 用量明细 | 用户 |

### 4.9 Report & Trend

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/reports/weekly` | 周报数据 | 用户 |
| POST | `/api/reports/generate` | 生成报告 | 用户 + 额度检查 |
| GET | `/api/trends` | 趋势信号列表 | 用户 |
| GET | `/api/alerts` | 告警列表 | 用户 |
| PUT | `/api/alerts/[id]/read` | 标记已读 | 用户 |

### 4.10 Admin

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/users` | 用户列表 | ADMIN |
| GET | `/api/admin/users/[id]` | 用户详情 | ADMIN |
| PUT | `/api/admin/users/[id]/plan` | 修改套餐 | ADMIN |
| GET | `/api/admin/orders` | 所有订单 | ADMIN |
| GET | `/api/admin/stats` | 系统统计 | ADMIN |
| GET | `/api/admin/logs` | 操作日志 | ADMIN |
| GET | `/api/admin/config` | 系统配置 | SUPER_ADMIN |
| PUT | `/api/admin/config` | 更新配置 | SUPER_ADMIN |

---

## 五、队列设计 (BullMQ)

### 5.1 队列列表

```
┌──────────────────────────────────────────────────────────────┐
│                      Queue Architecture                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  scan_queue          扫描任务队列                              │
│  ├─ processScan      处理单次扫描                              │
│  └─ scheduleScan     定时扫描                                  │
│                                                               │
│  citation_queue      引用分析队列                              │
│  ├─ analyzeCitation  分析单条引用                              │
│  └─ batchAnalyze     批量分析                                  │
│                                                               │
│  gap_queue           Gap 分析队列                              │
│  ├─ analyzeGap       分析单个 Gap                              │
│  └─ compareGap       竞对对比分析                              │
│                                                               │
│  content_queue       内容生成队列                              │
│  ├─ generateContent  生成单条内容                              │
│  └─ batchGenerate    批量生成                                  │
│                                                               │
│  publish_queue       发布队列                                  │
│  ├─ publishContent   发布到渠道                                │
│  └─ schedulePublish  定时发布                                  │
│                                                               │
│  report_queue        报告生成队列                              │
│  ├─ weeklyReport     生成周报                                  │
│  └─ customReport     自定义报告                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 队列配置

```typescript
// src/lib/queue.ts

import { Queue, Worker, QueueScheduler } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

// 队列定义
export const scanQueue = new Queue('scan_queue', { connection })
export const citationQueue = new Queue('citation_queue', { connection })
export const gapQueue = new Queue('gap_queue', { connection })
export const contentQueue = new Queue('content_queue', { connection })
export const publishQueue = new Queue('publish_queue', { connection })
export const reportQueue = new Queue('report_queue', { connection })

// 调度器（处理 delayed jobs）
export const scanScheduler = new QueueScheduler('scan_queue', { connection })
export const citationScheduler = new QueueScheduler('citation_queue', { connection })
// ... 其他调度器
```

### 5.3 Worker 定义

```typescript
// src/workers/scan.worker.ts

import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL)

interface ScanJobData {
  scanJobId: string
  brandId: string
  promptId: string
  platform: string
  promptText: string
}

const scanWorker = new Worker<ScanJobData>(
  'scan_queue',
  async (job: Job<ScanJobData>) => {
    const { scanJobId, brandId, promptId, platform, promptText } = job.data

    // 1. 调用 AI API
    const response = await queryAI(platform, promptText)

    // 2. 分析品牌提及
    const result = analyzeBrandMention(response)

    // 3. 保存结果
    await saveScanResult(scanJobId, promptId, platform, response, result)

    // 4. 更新进度
    await updateScanProgress(scanJobId)

    return result
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // 10 requests per second
    },
  }
)
```

---

## 六、目录结构

```
src/
├── app/
│   ├── (auth)/                    # 认证相关
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (dashboard)/               # 仪表板
│   │   ├── dashboard/             # 总览
│   │   ├── monitor/               # 监控中心
│   │   ├── citations/             # Citation Intelligence
│   │   ├── gaps/                  # GEO Gap
│   │   ├── content/               # 内容管理
│   │   ├── publish/               # 发布管理
│   │   ├── trends/                # 趋势分析
│   │   ├── alerts/                # 告警中心
│   │   ├── reports/               # 报告中心
│   │   └── settings/              # 设置
│   │
│   ├── (admin)/                   # 后台管理
│   │   ├── admin/
│   │   │   ├── users/             # 用户管理
│   │   │   ├── orders/            # 订单管理
│   │   │   ├── quotas/            # 额度监控
│   │   │   └── config/            # 系统配置
│   │
│   ├── api/                       # API Routes
│   │   ├── auth/
│   │   ├── brands/
│   │   ├── scans/
│   │   ├── citations/
│   │   ├── gaps/
│   │   ├── content/
│   │   ├── publish/
│   │   ├── billing/
│   │   ├── quota/
│   │   ├── reports/
│   │   ├── trends/
│   │   ├── alerts/
│   │   └── admin/
│   │
│   └── pricing/                   # 定价页
│
├── components/
│   ├── ui/                        # 基础组件
│   ├── charts/                    # 图表组件
│   ├── dashboard/                 # 仪表板组件
│   ├── citation/                  # Citation 组件
│   ├── gap/                       # Gap 组件
│   └── admin/                     # 管理后台组件
│
├── lib/
│   ├── prisma.ts                  # 数据库客户端
│   ├── redis.ts                   # Redis 客户端
│   ├── queue.ts                   # BullMQ 队列
│   ├── deepseek.ts                # DeepSeek API
│   ├── billing/                   # 支付逻辑
│   │   ├── wechat.ts
│   │   └── alipay.ts
│   ├── engines/                   # 核心引擎
│   │   ├── scan.engine.ts
│   │   ├── citation.engine.ts
│   │   ├── gap.engine.ts
│   │   ├── content.engine.ts
│   │   └── publish.engine.ts
│   └── utils.ts
│
├── workers/                       # BullMQ Workers
│   ├── scan.worker.ts
│   ├── citation.worker.ts
│   ├── gap.worker.ts
│   ├── content.worker.ts
│   └── publish.worker.ts
│
├── middleware.ts
├── auth.ts
└── types/
    └── next-auth.d.ts
```

---

## 七、开发路线图

### Phase 1: 架构定稿 (Week 1) ✅ 进行中

- [x] ER 图设计
- [x] 模块架构图
- [x] API 设计
- [x] 队列设计
- [ ] 更新 Prisma Schema
- [ ] 数据库迁移
- [ ] 基础目录结构

### Phase 2: Citation Intelligence (Week 2)

**核心功能：**
- [ ] 引用数据采集（从 ScanResult 提取）
- [ ] 引用来源分析（domain 分类 + 权重计算）
- [ ] AI 推荐概率模型
- [ ] 影响因子计算
- [ ] 影响力网络图
- [ ] 引用热力图
- [ ] 引用趋势分析

**API 实现：**
- `POST /api/citations/analyze`
- `GET /api/citations/sources`
- `GET /api/citations/network`
- `GET /api/citations/heatmap`

**前端页面：**
- `/citations` - 总览仪表板
- `/citations/sources` - 来源分析
- `/citations/network` - 网络图
- `/citations/[id]` - 引用详情

### Phase 3: GEO Gap (Week 3)

**核心功能：**
- [ ] 内容差距检测
- [ ] 竞对对比分析
- [ ] 缺口量化评分
- [ ] 改进建议生成
- [ ] 内容生成任务关联

**API 实现：**
- `POST /api/gaps/analyze`
- `GET /api/gaps/[id]`
- `GET /api/gaps/[id]/items`

**前端页面：**
- `/gaps` - Gap 总览
- `/gaps/[id]` - Gap 详情
- `/gaps/[id]/items` - 差距项列表

### Phase 4: Billing (Week 4)

**核心功能：**
- [ ] 套餐管理
- [ ] 微信支付集成
- [ ] 支付宝集成
- [ ] 订单系统
- [ ] 订阅管理

**前端页面：**
- `/pricing` - 定价页（更新）
- `/settings/billing` - 订阅管理
- `/settings/orders` - 订单历史

### Phase 5: Quota (Week 5)

**核心功能：**
- [ ] 额度分配逻辑
- [ ] 用量统计
- [ ] 额度预警
- [ ] 超额处理

**前端页面：**
- `/settings/quota` - 额度概览
- `/settings/usage` - 用量明细

### Phase 6: GEO Agent (Week 6+)

**核心功能：**
- [ ] 自动生成 FAQ
- [ ] 自动生成 Comparison
- [ ] 自动生成 Use Case
- [ ] 自动生成 Schema
- [ ] 自动生成社交媒体内容
- [ ] 一键发布

---

## 八、技术选型

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | Next.js 16 + Tailwind v4 | 已确定 |
| UI 组件 | shadcn/ui | 可访问性好 |
| 图表 | Recharts + D3.js | 网络图需要 D3 |
| 后端 | Next.js API Routes | 已确定 |
| ORM | Prisma 7 | 已确定 |
| 数据库 | PostgreSQL 15 | 已确定 |
| 缓存/队列 | Redis + BullMQ | 需要新增 |
| AI | DeepSeek API | 已确定 |
| 支付 | 微信支付 + 支付宝 | 需要新增 |
| 认证 | NextAuth v4 | 已确定 |

---

## 九、基础设施依赖

### 需要新增

1. **Redis** - 用于 BullMQ 队列 + 缓存
2. **微信支付商户号** - 需要企业资质
3. **支付宝商户号** - 需要企业资质
4. **域名 + SSL** - 生产环境必须

### 已有

1. ✅ PostgreSQL
2. ✅ DeepSeek API
3. ✅ Next.js + Vercel
4. ✅ GitHub

---

## 十、关键决策记录

| 决策 | 原因 |
|------|------|
| Citation Intelligence 优先 | 核心护城河，差异化竞争 |
| GEO Gap 第二优先 | 第二护城河，付费点 |
| Billing 在核心功能之后 | 先有价值再收费 |
| BullMQ 而非简单 setTimeout | 生产级可靠性 |
| 单库设计而非微服务 | 当前阶段够用，避免过度设计 |

---

**下一步：开始 Phase 2 - Citation Intelligence 开发**
