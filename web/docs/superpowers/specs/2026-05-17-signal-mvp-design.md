# Signal MVP 设计规格

> 日期：2026-05-17
> 分支：develop
> 状态：设计完成，待实现

---

## 1. 产品定位

Signal 是一个以 AI 为核心的信息理解与组织平台。从噪音中提取高价值信号（Signal），通过 AI 完成对信息的理解、筛选、组织与增强，最终让用户高效消费。

MVP 聚焦 GitHub Trending，对每个项目生成结构化 AI 分析，以 Website Dashboard 形态交付。

**核心原则**：不过度工程化，不提前引入复杂组件，先做出自己每天真正会使用的产品。

---

## 2. 决策汇总

| 维度 | 决策 |
|------|------|
| AI 输出字段 | 简介 + 技术方向标签 + 值得关注的原因 + 是否值得深入研究 |
| 数据刷新 | 混合模式：后台定时缓存（每 6 小时）+ 用户手动刷新 |
| 处理数量 | 用户可配置（5/10/20/25） |
| LLM 提供商 | DeepSeek（OpenAI 兼容）、OpenAI、Anthropic、Google Gemini |
| 用户系统 | GitHub OAuth 登录（NextAuth.js v5） |
| 首页布局 | 响应式网格（2-3 列），预留多信息源扩展 |
| 数据获取 | v1 抓取 GitHub Trending（Cheerio），后续优化 |
| LLM 缓存 | 按天缓存，当天同一项目不重复调用 |
| UI 风格 | Apple 极简美学（大量留白、typography 优先、柔和灰阶、低饱和度），light/dark 双模式 |
| 页面 | Dashboard / 项目详情 / 收藏 / 全局搜索 |
| 部署 | 本地优先 |

---

## 3. 架构：模块化单体

### 3.1 目录结构

```
web/src/
├── app/                          # Next.js App Router 页面
│   ├── layout.tsx                # 根布局（主题 Provider）
│   ├── page.tsx                  # Dashboard (首页)
│   ├── repo/[id]/page.tsx        # 项目详情
│   ├── saved/page.tsx            # 我的收藏
│   └── api/                      # API Routes
│       ├── auth/                 # NextAuth 路由
│       ├── trending/             # GET 获取缓存, POST 触发刷新
│       ├── repo/[id]/            # 项目完整数据
│       └── saved/                # 收藏增删查
│
├── providers/                    # 三大核心抽象 + 实现
│   ├── source/
│   │   ├── types.ts              # SourceProvider 接口
│   │   ├── github-trending.ts    # GitHub Trending 实现 (Cheerio)
│   │   └── index.ts              # 注册表
│   ├── ai/
│   │   ├── types.ts              # AIProvider 接口
│   │   ├── openai.ts             # OpenAI / DeepSeek (OpenAI 兼容)
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   └── index.ts              # 注册表 + 工厂函数
│   └── channel/                  # v1 为空实现，预留
│       ├── types.ts
│       └── index.ts
│
├── pipeline/                     # 数据处理管线
│   ├── scheduler.ts              # node-cron 定时触发
│   ├── pipeline.ts               # 管线编排：抓取 → AI → 入库
│   └── prompts.ts                # LLM Prompt 模板
│
├── lib/                          # 工具与基础设施
│   ├── prisma.ts                 # Prisma Client 单例
│   ├── auth.ts                   # NextAuth.js 配置 (GitHub)
│   └── utils.ts
│
├── components/                   # UI 组件
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── layout/                   # Header, ThemeToggle, SearchBar
│   ├── repo-card.tsx             # Dashboard 网格卡片
│   ├── repo-grid.tsx             # 响应式网格容器
│   ├── repo-detail.tsx           # 详情面板
│   └── saved-list.tsx
│
└── hooks/                        # 自定义 React Hooks
    ├── use-trending.ts
    └── use-saved.ts
```

### 3.2 核心接口

```typescript
// providers/source/types.ts
interface SourceProvider {
  name: string
  fetchTrending(): Promise<TrendingItem[]>
}

// providers/ai/types.ts
interface AIProvider {
  name: string
  generateSummary(item: TrendingItem): Promise<AISummary>
}

// providers/channel/types.ts
interface ChannelProvider {
  name: string
  send(message: ChannelMessage): Promise<void>
}
```

---

## 4. 数据模型（Prisma + SQLite）

```prisma
model User {
  id          String      @id @default(cuid())
  githubId    Int         @unique
  githubLogin String
  name        String?
  email       String?
  avatarUrl   String?
  createdAt   DateTime    @default(now())
  savedRepos  SavedRepo[]
}

model Repo {
  id           String        @id @default(cuid())
  githubId     Int           @unique
  name         String        // "owner/repo"
  owner        String
  repo         String
  url          String
  description  String?
  language     String?
  stars        Int?
  forks        Int?
  trendingDate DateTime?
  trendingRank Int?
  createdAt    DateTime      @default(now())
  summaries    RepoSummary[]
  savedBy      SavedRepo[]
}

model RepoSummary {
  id             String   @id @default(cuid())
  repoId         String
  repo           Repo     @relation(fields: [repoId], references: [id])
  summaryDate    DateTime @default(now())
  aiSummary      String
  techTags       String   // JSON 数组：["Rust","CLI"]
  whyMatters     String
  worthDeepDive  Boolean
  deepDiveReason String?
  provider       String
  createdAt      DateTime @default(now())

  @@index([repoId, summaryDate])
}

model SavedRepo {
  id        String   @id @default(cuid())
  userId    String
  repoId    String
  user      User     @relation(fields: [userId], references: [id])
  repo      Repo     @relation(fields: [repoId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, repoId])
}
```

---

## 5. Pipeline 管线

### 5.1 执行流程

1. **Scrape**：抓取 `github.com/trending`，Cheerio 解析 HTML，返回 Trending 项目列表
2. **Upsert Repos**：按 `githubId` 插入或更新仓库元信息
3. **AI Process**：逐项目处理，3 并发，跳过当天已有摘要的项目
4. **Cleanup**：删除超过 7 天的旧摘要

### 5.2 调度

- `node-cron` 每 6 小时执行一次
- 服务器启动时立即执行一次
- 手动刷新通过 `POST /api/trending/refresh` 触发

### 5.3 错误处理

- 抓取失败：重试 3 次，间隔 3 秒，最终失败则保留已有数据
- LLM 处理单项目失败：跳过，下一个继续，不中断整体
- 超时（>30s 单次调用）：标记失败，下次重试

### 5.4 LLM Prompt

```
You are a technical analyst. Analyze this GitHub repository:

Name: {name}
Description: {description}
Language: {language}

Return a JSON object with exactly these fields:
- summary: One-sentence summary of what this project does (string, in Chinese)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence explaining why this project deserves attention (string, in Chinese)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one sentence (string or null, in Chinese)
```

---

## 6. 页面与 UI

### 6.1 页面路由

| 路由 | 页面 | 鉴权 |
|------|------|------|
| `/` | Dashboard | 否 |
| `/repo/[id]` | 项目详情 | 否 |
| `/saved` | 我的收藏 | 是 |
| 全局搜索 | Command Palette 弹窗 | 否 |

### 6.2 组件树

```
Layout
├── Header
│   ├── Logo
│   ├── SearchBar (trigger → SearchDialog)
│   │   └── SearchDialog
│   ├── ThemeToggle
│   ├── SavedButton
│   └── UserMenu (Avatar + 登出 / 登录)
├── Page Content
│   ├── Dashboard
│   │   ├── TopBar (标题 + 刷新 + 数量选择器)
│   │   ├── RepoGrid
│   │   │   └── RepoCard x N
│   │   └── EmptyState
│   ├── RepoDetail
│   │   ├── BackButton
│   │   ├── SaveButton
│   │   └── DetailSections
│   └── Saved
│       ├── RepoGrid (复用)
│       └── EmptyState
└── Footer
```

### 6.3 卡片字段映射

每张 RepoCard 展示：owner/repo 名、AI 摘要一句话、2-4 个技术标签、whyMatters、⭐ stars、是否深入研究标记。

### 6.4 UI 风格规范

- 极简，Apple/Linear 风格
- 大量留白，信息层级清晰
- typography 优先，少阴影少边框
- 柔和灰阶，低饱和度
- 轻微 hover 动效
- light/dark 双模式，默认跟随系统
- 禁止：cyberpunk、过度渐变、复杂玻璃拟态

---

## 7. 认证

- NextAuth.js v5 + GitHubProvider
- Session JWT 策略，payload 包含 `userId`
- 公开页面无需登录但无法收藏
- 收藏页及收藏 API 需要登录
- 未登录访问收藏页 → 重定向首页 + Toast 提示

---

## 8. 状态处理

| 状态 | 场景 | 处理 |
|------|------|------|
| Loading | Dashboard 首次加载 | 骨架屏（4-6 张卡片占位） |
| Loading | 项目详情 | 顶部骨架详情 |
| Loading | 手动刷新 | 网格上方进度条 + "正在分析..." |
| Empty | Dashboard 无数据 | "暂无数据" + 手动刷新按钮 |
| Empty | 收藏页为空 | "还没有收藏项目" + 跳转链接 |
| Empty | 搜索无结果 | "未找到匹配的项目" |
| Error | 抓取失败 | 保留旧数据 + 顶部 Banner 警告 |
| Error | LLM 处理失败 | 显示原始数据，标记"待分析" |
| Error | API 请求失败 | Toast 提示 + 重试按钮 |
| Error | 未登录访问收藏 | 重定向首页 + Toast 提示 |

---

## 9. API Routes

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/trending` | 获取今日 Trending + AI 摘要 | 否 |
| POST | `/api/trending/refresh` | 手动触发刷新 | 是 |
| GET | `/api/repo/[id]` | 项目完整数据 | 否 |
| POST | `/api/saved` | 收藏项目 | 是 |
| DELETE | `/api/saved` | 取消收藏 | 是 |
| GET | `/api/saved` | 获取收藏列表 | 是 |
| GET | `/api/auth/*` | NextAuth 路由 | - |

---

## 10. 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 16 | App Router |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui | Apple 极简风格 |
| 数据库 | SQLite + Prisma | 本地文件，零配置 |
| 认证 | NextAuth.js v5 | GitHub OAuth |
| 定时任务 | node-cron | 进程内调度 |
| 抓取 | Cheerio | GitHub Trending HTML 解析 |
| AI SDK | OpenAI / @anthropic-ai/sdk / @google/generative-ai | 多提供商 |
| 数据请求 | SWR | 客户端数据获取与缓存 |
| 部署 | 本地（Vercel 延后评估） | - |

---

## 11. 不做的（YAGNI）

- 飞书/Telegram 推送（Channel 接口已预留）
- 多信息源（Source 扩展点已预留）
- 复杂搜索系统（v1 仅前端本地搜索）
- 个性化推荐算法
- 向量搜索 / RAG
- Docker / 微服务 / Redis / LangChain
- AI Research Agent
