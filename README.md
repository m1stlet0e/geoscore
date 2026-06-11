# GeoScore

<div align="center">

**AI-Powered SEO Analysis Platform**

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)

</div>

---

## 📖 项目简介

GeoScore 是一个 AI 驱动的 SEO 分析平台，帮助企业监控和优化其在 AI 搜索引擎（如 ChatGPT、Perplexity）中的可见度。

**核心理念：** 随着 AI 搜索逐渐取代传统搜索引擎，品牌需要新的方式来监控和提升其在 AI 回答中的出现频率和排名。

---

## ✨ 功能特性

### 🎯 核心功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **Dashboard** | 数据总览、关键指标可视化 | ✅ |
| **Monitor** | AI 搜索排名实时监控 | ✅ |
| **Citations** | 引用来源追踪分析 | ✅ |
| **Sources** | 品牌来源分布可视化 | ✅ |
| **Influence** | 品牌影响力评估地图 | ✅ |
| **Gaps** | 竞争对手差距分析 | ✅ |
| **Growth** | AI 增长代理建议 | ✅ |
| **Radar** | Prompt 雷达引用引擎 | ✅ |
| **Forecast** | 趋势预测分析 | ✅ |
| **Alerts** | 实时告警通知 | ✅ |
| **Settings** | 系统设置管理 | ✅ |

### 🔐 认证系统

- NextAuth v4 集成
- 邮箱密码登录
- GitHub OAuth 登录
- 会话管理
- 路由保护中间件

---

## 🛠️ 技术栈

### 前端
- **框架**: Next.js 16 (App Router + Turbopack)
- **样式**: Tailwind CSS v4
- **图表**: Recharts
- **图标**: Lucide React

### 后端
- **API**: Next.js API Routes + Server Actions
- **认证**: NextAuth v4
- **ORM**: Prisma 7
- **数据库**: PostgreSQL 15+
- **AI 集成**: DeepSeek API

### 开发工具
- **语言**: TypeScript 5.0
- **包管理**: npm
- **代码规范**: ESLint + Prettier

---

## 🚀 快速开始

### 环境要求

- Node.js 20.0+
- PostgreSQL 15+
- npm 10+

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/m1stlet0e/geoscore.git
cd geoscore

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 4. 初始化数据库
npx prisma migrate dev
npx prisma db seed

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### Demo 账号

```
邮箱: demo@geoos.ai
密码: demo123456
```

---

## 📁 项目结构

```
geoscore/
├── prisma/                    # 数据库模型和迁移
├── src/
│   ├── app/                   # Next.js App Router 页面
│   │   ├── (dashboard)/       # 仪表板 (14 个页面)
│   │   ├── api/               # API 路由
│   │   ├── login/             # 登录页
│   │   ├── register/          # 注册页
│   │   └── pricing/           # 定价页
│   ├── components/            # 可复用组件
│   ├── lib/                   # 工具函数和配置
│   ├── auth.ts                # NextAuth 配置
│   └── middleware.ts           # 路由中间件
├── public/                    # 静态资源
├── .env.example               # 环境变量示例
└── package.json
```

---

## 🔧 环境变量

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/geoscore"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# GitHub OAuth (可选)
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# DeepSeek API
DEEPSEEK_API_KEY="your-deepseek-api-key"
```

---

## 📊 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/session` | 获取会话 |
| GET | `/api/monitor` | 监控数据 |
| GET | `/api/citations` | 引用分析 |
| GET | `/api/sources` | 来源分布 |
| GET | `/api/alerts` | 告警列表 |

---

## 🚢 部署

### Vercel（推荐）

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 自动部署完成

### Docker

```bash
docker build -t geoscore .
docker run -p 3000:3000 -e DATABASE_URL="..." geoscore
```

---

## 📄 许可证

MIT License

---

## 👥 作者

**Wang Bo** - [@m1stlet0e](https://github.com/m1stlet0e)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

</div>
