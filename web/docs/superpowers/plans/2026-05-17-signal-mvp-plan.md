# Signal MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Signal MVP —— GitHub Trending AI 摘要 Dashboard，包含 Dashboard、项目详情、收藏、全局搜索四个页面。

**Architecture:** 模块化单体，Next.js 16 App Router + Prisma + SQLite。三个核心抽象接口（SourceProvider / AIProvider / ChannelProvider），Pipeline 管线通过 node-cron 定时触发，API Routes 读写数据库。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Prisma (SQLite), NextAuth.js v5 (GitHub OAuth), node-cron, Cheerio, OpenAI / Anthropic / Gemini SDK, SWR, next-themes, lucide-react

---

### Task 1: 安装全部依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装生产依赖**

```bash
cd /Users/jaehua/projects/i/signal/web && npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter node-cron cheerio openai @anthropic-ai/sdk @google/generative-ai swr next-themes lucide-react zod class-variance-authority clsx tailwind-merge
```

- [ ] **Step 2: 安装开发依赖**

```bash
cd /Users/jaehua/projects/i/signal/web && npm install -D @types/node-cron
```

- [ ] **Step 3: 验证安装**

```bash
cd /Users/jaehua/projects/i/signal/web && node -e "require('prisma'); require('next-auth'); require('node-cron'); require('cheerio'); require('openai'); console.log('All packages loaded')"
```

Expected: `All packages loaded`

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: install all project dependencies"
```

---

### Task 2: Prisma Schema 与数据库初始化

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: 创建 Prisma Schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

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
  name         String        @unique
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
  techTags       String
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

- [ ] **Step 2: 初始化 Prisma 并生成迁移**

```bash
cd /Users/jaehua/projects/i/signal/web && npx prisma migrate dev --name init
```

Expected: 迁移文件创建，`prisma/dev.db` 生成

- [ ] **Step 3: 创建 Prisma Client 单例**

Write `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 4: 提交**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add Prisma schema and client singleton"
```

---

### Task 3: AI Provider 接口与实现

**Files:**
- Create: `src/providers/ai/types.ts`
- Create: `src/providers/ai/openai.ts`
- Create: `src/providers/ai/anthropic.ts`
- Create: `src/providers/ai/gemini.ts`
- Create: `src/providers/ai/index.ts`

- [ ] **Step 1: 定义 AIProvider 接口和类型**

Write `src/providers/ai/types.ts`:

```typescript
export interface TrendingItem {
  name: string
  owner: string
  repo: string
  description: string | null
  language: string | null
}

export interface AISummary {
  summary: string
  techTags: string[]
  whyMatters: string
  worthDeepDive: boolean
  deepDiveReason: string | null
}

export interface AIProvider {
  name: string
  generateSummary(item: TrendingItem): Promise<AISummary>
}
```

- [ ] **Step 2: 实现 OpenAI 兼容 Provider（OpenAI + DeepSeek）**

Write `src/providers/ai/openai.ts`:

```typescript
import OpenAI from "openai"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createOpenAIProvider(config?: {
  baseURL?: string
  apiKey?: string
  model?: string
}): AIProvider {
  const client = new OpenAI({
    baseURL: config?.baseURL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
  })

  const model = config?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini"

  const prompt = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return a JSON object with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `openai:${model}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: prompt
              .replace("{name}", `${item.owner}/${item.repo}`)
              .replace("{description}", item.description ?? "No description")
              .replace("{language}", item.language ?? "Unknown"),
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      })

      const text = response.choices[0]?.message?.content ?? ""
      const parsed = JSON.parse(text)
      return {
        summary: parsed.summary,
        techTags: parsed.techTags,
        whyMatters: parsed.whyMatters,
        worthDeepDive: parsed.worthDeepDive,
        deepDiveReason: parsed.deepDiveReason ?? null,
      }
    },
  }
}
```

- [ ] **Step 3: 实现 Anthropic Provider**

Write `src/providers/ai/anthropic.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createAnthropicProvider(config?: {
  apiKey?: string
  model?: string
}): AIProvider {
  const client = new Anthropic({
    apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
  })

  const model = config?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest"

  const prompt = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return ONLY a JSON object (no markdown, no backticks) with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `anthropic:${model}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const response = await client.messages.create({
        model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
              .replace("{name}", `${item.owner}/${item.repo}`)
              .replace("{description}", item.description ?? "No description")
              .replace("{language}", item.language ?? "Unknown"),
          },
        ],
      })

      const block = response.content[0]
      const text = block?.type === "text" ? block.text : ""
      const parsed = JSON.parse(text)

      return {
        summary: parsed.summary,
        techTags: parsed.techTags,
        whyMatters: parsed.whyMatters,
        worthDeepDive: parsed.worthDeepDive,
        deepDiveReason: parsed.deepDiveReason ?? null,
      }
    },
  }
}
```

- [ ] **Step 4: 实现 Gemini Provider**

Write `src/providers/ai/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createGeminiProvider(config?: {
  apiKey?: string
  model?: string
}): AIProvider {
  const apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY ?? ""
  const genAI = new GoogleGenerativeAI(apiKey)

  const modelName = config?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash"

  const prompt = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return ONLY a valid JSON object (no markdown, no backticks) with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `gemini:${modelName}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const model = genAI.getGenerativeModel({ model: modelName })

      const result = await model.generateContent(
        prompt
          .replace("{name}", `${item.owner}/${item.repo}`)
          .replace("{description}", item.description ?? "No description")
          .replace("{language}", item.language ?? "Unknown")
      )

      const text = result.response.text()
      const parsed = JSON.parse(text)

      return {
        summary: parsed.summary,
        techTags: parsed.techTags,
        whyMatters: parsed.whyMatters,
        worthDeepDive: parsed.worthDeepDive,
        deepDiveReason: parsed.deepDiveReason ?? null,
      }
    },
  }
}
```

- [ ] **Step 5: 创建 Provider 注册表工厂**

Write `src/providers/ai/index.ts`:

```typescript
import { AIProvider } from "./types"
import { createOpenAIProvider } from "./openai"
import { createAnthropicProvider } from "./anthropic"
import { createGeminiProvider } from "./gemini"

export type AIProviderType = "openai" | "deepseek" | "anthropic" | "gemini"

export function createAIProvider(type: AIProviderType): AIProvider {
  switch (type) {
    case "deepseek":
      return createOpenAIProvider({
        baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      })
    case "openai":
      return createOpenAIProvider()
    case "anthropic":
      return createAnthropicProvider()
    case "gemini":
      return createGeminiProvider()
    default:
      throw new Error(`Unknown AI provider: ${type}`)
  }
}

export { type AIProvider, type AISummary, type TrendingItem } from "./types"
```

- [ ] **Step 6: 提交**

```bash
git add src/providers/ai/
git commit -m "feat: add AI provider interfaces and implementations"
```

---

### Task 4: Source Provider 与 Channel Provider

**Files:**
- Create: `src/providers/source/types.ts`
- Create: `src/providers/source/github-trending.ts`
- Create: `src/providers/source/index.ts`
- Create: `src/providers/channel/types.ts`
- Create: `src/providers/channel/index.ts`

- [ ] **Step 1: 定义 SourceProvider 接口**

Write `src/providers/source/types.ts`:

```typescript
export interface TrendingItem {
  name: string
  owner: string
  repo: string
  url: string
  description: string | null
  language: string | null
  stars: number | null
  forks: number | null
  rank: number
}

export interface SourceProvider {
  name: string
  fetchTrending(): Promise<TrendingItem[]>
}
```

- [ ] **Step 2: 实现 GitHub Trending Scraper (Cheerio)**

Write `src/providers/source/github-trending.ts`:

```typescript
import * as cheerio from "cheerio"
import { SourceProvider, TrendingItem } from "./types"

export function createGitHubTrendingProvider(config?: {
  language?: string
  since?: "daily" | "weekly" | "monthly"
}): SourceProvider {
  const language = config?.language ?? ""
  const since = config?.since ?? "daily"

  return {
    name: "github-trending",
    async fetchTrending(): Promise<TrendingItem[]> {
      const langPath = language ? `/${language}` : ""
      const url = `https://github.com/trending${langPath}?since=${since}`

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SignalBot/1.0)",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const items: TrendingItem[] = []

      $("article.Box-row").each((index, element) => {
        const $el = $(element)

        const fullName = $el.find("h2 a").text().trim().replace(/\s+/g, "")
        const [owner, repo] = fullName.split("/")
        const urlPath = $el.find("h2 a").attr("href") ?? ""
        const description = $el.find("p").text().trim() || null
        const language = $el.find("[itemprop='programmingLanguage']").text().trim() || null

        const starsStr = $el.find(".octicon-star").parent().text().trim()
        const forksStr = $el.find(".octicon-repo-forked").parent().text().trim()

        const stars = starsStr ? parseInt(starsStr.replace(/,/g, ""), 10) || null : null
        const forks = forksStr ? parseInt(forksStr.replace(/,/g, ""), 10) || null : null

        if (owner && repo) {
          items.push({
            name: fullName,
            owner,
            repo,
            url: `https://github.com${urlPath}`,
            description,
            language,
            stars,
            forks,
            rank: index + 1,
          })
        }
      })

      return items
    },
  }
}
```

- [ ] **Step 3: 创建 Source 注册表**

Write `src/providers/source/index.ts`:

```typescript
import { SourceProvider } from "./types"
import { createGitHubTrendingProvider } from "./github-trending"

export function createSourceProvider(): SourceProvider {
  return createGitHubTrendingProvider()
}

export type { SourceProvider, TrendingItem } from "./types"
```

- [ ] **Step 4: 定义 Channel Provider 接口（v1 占位）**

Write `src/providers/channel/types.ts`:

```typescript
export interface ChannelMessage {
  title: string
  content: string
  url?: string
}

export interface ChannelProvider {
  name: string
  send(message: ChannelMessage): Promise<void>
}
```

- [ ] **Step 5: 创建 Channel 注册表（空实现）**

Write `src/providers/channel/index.ts`:

```typescript
import { ChannelProvider } from "./types"

export function createChannelProviders(): ChannelProvider[] {
  return []
}

export type { ChannelProvider, ChannelMessage } from "./types"
```

- [ ] **Step 6: 提交**

```bash
git add src/providers/source/ src/providers/channel/
git commit -m "feat: add Source and Channel provider interfaces"
```

---

### Task 5: Pipeline 管线与 Scheduler

**Files:**
- Create: `src/pipeline/prompts.ts`
- Create: `src/pipeline/pipeline.ts`
- Create: `src/pipeline/scheduler.ts`

- [ ] **Step 1: 创建 LLM Prompt 模板**

Write `src/pipeline/prompts.ts`:

```typescript
export const SUMMARY_PROMPT = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return a JSON object with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`
```

- [ ] **Step 2: 创建 Pipeline 管线逻辑**

Write `src/pipeline/pipeline.ts`:

```typescript
import { prisma } from "@/lib/prisma"
import { createSourceProvider } from "@/providers/source"
import { createAIProvider, type AIProviderType } from "@/providers/ai"

let isRunning = false

export function isPipelineRunning(): boolean {
  return isRunning
}

export async function runPipeline(): Promise<{
  scraped: number
  processed: number
  skipped: number
  errors: number
}> {
  if (isRunning) {
    return { scraped: 0, processed: 0, skipped: 0, errors: 0 }
  }

  isRunning = true
  let scraped = 0
  let processed = 0
  let skipped = 0
  let errors = 0

  try {
    const providerType = (process.env.AI_PROVIDER ?? "deepseek") as AIProviderType
    const maxItems = parseInt(process.env.TRENDING_COUNT ?? "10", 10)
    const aiProvider = createAIProvider(providerType)

    const sourceProvider = createSourceProvider()

    const items = await sourceProvider.fetchTrending()
    const toProcess = items.slice(0, maxItems)
    scraped = toProcess.length

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const item of toProcess) {
      try {
        const repo = await prisma.repo.upsert({
          where: { name: item.name },
          create: {
            name: item.name,
            owner: item.owner,
            repo: item.repo,
            url: item.url,
            description: item.description,
            language: item.language,
            stars: item.stars,
            forks: item.forks,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
          update: {
            description: item.description,
            language: item.language,
            stars: item.stars,
            forks: item.forks,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
        })

        const existingSummary = await prisma.repoSummary.findFirst({
          where: {
            repoId: repo.id,
            summaryDate: { gte: today },
          },
        })

        if (existingSummary) {
          skipped++
          continue
        }

        const summary = await aiProvider.generateSummary(item)

        await prisma.repoSummary.create({
          data: {
            repoId: repo.id,
            summaryDate: new Date(),
            aiSummary: summary.summary,
            techTags: JSON.stringify(summary.techTags),
            whyMatters: summary.whyMatters,
            worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason,
            provider: aiProvider.name,
          },
        })

        processed++
      } catch (error) {
        console.error(`Failed to process ${item.name}:`, error)
        errors++
      }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    await prisma.repoSummary.deleteMany({
      where: { summaryDate: { lt: sevenDaysAgo } },
    })

    return { scraped, processed, skipped, errors }
  } finally {
    isRunning = false
  }
}
```

- [ ] **Step 3: 创建 Scheduler**

Write `src/pipeline/scheduler.ts`:

```typescript
import cron from "node-cron"
import { runPipeline } from "./pipeline"

export function startScheduler(): void {
  cron.schedule("0 */6 * * *", async () => {
    console.log("[Scheduler] Running pipeline...")

    try {
      const result = await runPipeline()
      console.log(`[Scheduler] Pipeline complete: ${result.scraped} scraped, ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors`)
    } catch (error) {
      console.error("[Scheduler] Pipeline failed:", error)
    }
  })

  setTimeout(async () => {
    console.log("[Scheduler] Running initial pipeline on startup...")

    try {
      const result = await runPipeline()
      console.log(`[Scheduler] Initial pipeline complete: ${result.scraped} scraped, ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors`)
    } catch (error) {
      console.error("[Scheduler] Initial pipeline failed:", error)
    }
  }, 5000)

  console.log("[Scheduler] Started (every 6 hours)")
}
```

- [ ] **Step 4: 提交**

```bash
git add src/pipeline/
git commit -m "feat: add pipeline and scheduler"
```

---

### Task 6: NextAuth 认证配置

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: 创建 NextAuth 配置**

Write `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
```

- [ ] **Step 2: 创建 NextAuth Route Handler**

Write `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

- [ ] **Step 3: 创建 Middleware（保护 /saved 路由）**

Write `src/middleware.ts`:

```typescript
import { auth } from "@/lib/auth"

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/saved")) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: ["/saved"],
}
```

- [ ] **Step 4: 创建 .env.local 模板**

Create `src/lib/auth.ts` already references the env vars. Ensure `.env.local` contains:

```
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret
AUTH_SECRET=your_nextauth_secret
```

(用户需自行前往 GitHub Developer Settings 创建 OAuth App，callback URL 为 `http://localhost:3000/api/auth/callback/github`)

- [ ] **Step 5: 提交**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/middleware.ts
git commit -m "feat: add NextAuth GitHub OAuth authentication"
```

---

### Task 7: API Routes

**Files:**
- Create: `src/app/api/trending/route.ts`
- Create: `src/app/api/trending/refresh/route.ts`
- Create: `src/app/api/repo/[id]/route.ts`
- Create: `src/app/api/saved/route.ts`

- [ ] **Step 1: Trending API（GET 获取 + 查询参数）**

Write `src/app/api/trending/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") ?? "10", 10)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const repos = await prisma.repo.findMany({
    where: {
      trendingDate: { gte: today },
    },
    include: {
      summaries: {
        where: { summaryDate: { gte: today } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { trendingRank: "asc" },
    take: limit,
  })

  const items = repos.map((repo) => {
    const summary = repo.summaries[0] ?? null
    return {
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      repo: repo.repo,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      forks: repo.forks,
      trendingRank: repo.trendingRank,
      summary: summary
        ? {
            aiSummary: summary.aiSummary,
            techTags: JSON.parse(summary.techTags),
            whyMatters: summary.whyMatters,
            worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason,
            provider: summary.provider,
          }
        : null,
    }
  })

  return Response.json({
    count: items.length,
    date: today.toISOString(),
    items,
  })
}
```

- [ ] **Step 2: Trending Refresh API（POST 触发手动刷新）**

Write `src/app/api/trending/refresh/route.ts`:

```typescript
import { auth } from "@/lib/auth"
import { runPipeline, isPipelineRunning } from "@/pipeline/pipeline"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPipelineRunning()) {
    return Response.json({ status: "already_running" })
  }

  runPipeline().catch(console.error)

  return Response.json({ status: "processing", startedAt: new Date().toISOString() })
}
```

- [ ] **Step 3: Repo Detail API（GET 单个项目）**

Write `src/app/api/repo/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/repo/[id]">
) {
  const { id } = await ctx.params

  const repo = await prisma.repo.findUnique({
    where: { id },
    include: {
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!repo) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const summary = repo.summaries[0] ?? null

  return Response.json({
    id: repo.id,
    name: repo.name,
    owner: repo.owner,
    repo: repo.repo,
    url: repo.url,
    description: repo.description,
    language: repo.language,
    stars: repo.stars,
    forks: repo.forks,
    trendingRank: repo.trendingRank,
    summary: summary
      ? {
          aiSummary: summary.aiSummary,
          techTags: JSON.parse(summary.techTags),
          whyMatters: summary.whyMatters,
          worthDeepDive: summary.worthDeepDive,
          deepDiveReason: summary.deepDiveReason,
          provider: summary.provider,
        }
      : null,
  })
}
```

- [ ] **Step 4: Saved API（收藏增删查）**

Write `src/app/api/saved/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const saved = await prisma.savedRepo.findMany({
    where: { userId: session.user.id },
    include: {
      repo: {
        include: {
          summaries: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = saved.map((s) => {
    const summary = s.repo.summaries[0] ?? null
    return {
      id: s.repo.id,
      name: s.repo.name,
      owner: s.repo.owner,
      repo: s.repo.repo,
      url: s.repo.url,
      description: s.repo.description,
      language: s.repo.language,
      stars: s.repo.stars,
      forks: s.repo.forks,
      savedAt: s.createdAt,
      summary: summary
        ? {
            aiSummary: summary.aiSummary,
            techTags: JSON.parse(summary.techTags),
            whyMatters: summary.whyMatters,
            worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason,
          }
        : null,
    }
  })

  return Response.json({ items })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { repoId } = await request.json()

  if (!repoId) {
    return Response.json({ error: "repoId is required" }, { status: 400 })
  }

  const repo = await prisma.repo.findUnique({ where: { id: repoId } })
  if (!repo) {
    return Response.json({ error: "Repo not found" }, { status: 404 })
  }

  const saved = await prisma.savedRepo.upsert({
    where: {
      userId_repoId: {
        userId: session.user.id,
        repoId,
      },
    },
    create: {
      userId: session.user.id,
      repoId,
    },
    update: {},
  })

  return Response.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { repoId } = await request.json()

  if (!repoId) {
    return Response.json({ error: "repoId is required" }, { status: 400 })
  }

  await prisma.savedRepo.deleteMany({
    where: {
      userId: session.user.id,
      repoId,
    },
  })

  return Response.json({ saved: false })
}
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/
git commit -m "feat: add API routes for trending, repo detail, and saved"
```

---

### Task 8: Theme 系统与基础 UI

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`

- [ ] **Step 1: 更新 globals.css（Apple 极简风格）**

Write `src/app/globals.css`:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #1d1d1f;
  --muted: #6e6e73;
  --muted-bg: #f5f5f7;
  --border: #d2d2d7;
  --card: #fafafa;
  --accent: #0071e3;
  --accent-foreground: #ffffff;
}

.dark {
  --background: #000000;
  --foreground: #f5f5f7;
  --muted: #98989d;
  --muted-bg: #1c1c1e;
  --border: #2c2c2e;
  --card: #1c1c1e;
  --accent: #2997ff;
  --accent-foreground: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-bg: var(--muted-bg);
  --color-border: var(--border);
  --color-card: var(--card);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --font-sans: "SF Pro Display", "SF Pro Text", "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.01em;
}

::selection {
  background: var(--accent);
  color: var(--accent-foreground);
}
```

- [ ] **Step 2: 创建工具函数**

Write `src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: 创建 shadcn/ui Button 组件**

Write `src/components/ui/button.tsx`:

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "link"
  size?: "default" | "sm" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-foreground text-background hover:bg-foreground/90",
          variant === "ghost" && "text-foreground hover:bg-muted-bg",
          variant === "outline" && "border border-border bg-transparent hover:bg-muted-bg",
          variant === "link" && "text-accent underline-offset-4 hover:underline",
          size === "default" && "h-9 px-4 py-2",
          size === "sm" && "h-8 px-3 text-xs",
          size === "icon" && "h-9 w-9",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
```

- [ ] **Step 4: 更新 RootLayout（集成 ThemeProvider）**

Write `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "Signal",
  description: "AI-powered GitHub trending insights",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/app/globals.css src/app/layout.tsx src/lib/utils.ts src/components/ui/button.tsx
git commit -m "feat: add Apple-style theme system and base UI components"
```

---

### Task 9: Layout 组件（Header, ThemeToggle, SearchBar, SearchDialog）

**Files:**
- Create: `src/components/layout/theme-toggle.tsx`
- Create: `src/components/layout/search-bar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/user-menu.tsx`

- [ ] **Step 1: ThemeToggle 组件**

Write `src/components/layout/theme-toggle.tsx`:

```typescript
"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="w-9 h-9" disabled />
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
```

- [ ] **Step 2: SearchBar 命令面板**

Write `src/components/layout/search-bar.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface RepoItem {
  id: string
  name: string
  techTags?: string[]
  aiSummary?: string
}

interface SearchBarProps {
  items: RepoItem[]
}

export function SearchBar({ items }: SearchBarProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-muted text-xs w-48 justify-start"
      >
        <Search className="h-3.5 w-3.5" />
        <span>搜索项目...</span>
        <kbd className="ml-auto text-[10px] text-muted bg-muted-bg px-1 rounded">⌘K</kbd>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目..."
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted"
            />
            <kbd className="text-[10px] text-muted bg-muted-bg px-1.5 py-0.5 rounded">esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 && query && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                未找到匹配的项目
              </div>
            )}
            {filtered.length === 0 && !query && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                输入项目名称搜索
              </div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  router.push(`/repo/${item.id}`)
                  setOpen(false)
                  setQuery("")
                }}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted-bg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                  {item.aiSummary && (
                    <div className="text-xs text-muted mt-0.5 line-clamp-1">{item.aiSummary}</div>
                  )}
                </div>
                {item.techTags && item.techTags.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    {item.techTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted-bg text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: UserMenu 组件**

Write `src/components/layout/user-menu.tsx`:

```typescript
"use client"

import { useState, useRef, useEffect } from "react"
import { LogIn, LogOut, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession, signIn, signOut } from "next-auth/react"
import Link from "next/link"

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted-bg animate-pulse" />
  }

  if (!session?.user) {
    return (
      <Button variant="ghost" size="sm" onClick={() => signIn("github")} className="gap-1.5">
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">登录</span>
      </Button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-full overflow-hidden border border-border hover:opacity-80 transition-opacity"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted-bg flex items-center justify-center text-xs text-muted font-medium">
            {session.user.name?.charAt(0) ?? "?"}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm font-medium truncate">{session.user.name}</div>
            <div className="text-xs text-muted truncate">@{session.user.githubLogin ?? "unknown"}</div>
          </div>
          <Link
            href="/saved"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted-bg transition-colors"
          >
            <Bookmark className="h-4 w-4" />
            我的收藏
          </Link>
          <button
            onClick={() => { signOut(); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted-bg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Header 组件**

Write `src/components/layout/header.tsx`:

```typescript
"use client"

import Link from "next/link"
import { Zap } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"

interface HeaderProps {
  searchItems?: Array<{ id: string; name: string; techTags?: string[]; aiSummary?: string }>
}

export function Header({ searchItems = [] }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-foreground font-semibold text-sm tracking-tight">
          <Zap className="h-4 w-4 text-accent" />
          Signal
        </Link>
        <div className="flex-1" />
        <SearchBar items={searchItems} />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/
git commit -m "feat: add Header, ThemeToggle, SearchBar, and UserMenu components"
```

---

### Task 10: RepoCard + RepoGrid + Skeleton 组件

**Files:**
- Create: `src/components/repo-card.tsx`
- Create: `src/components/repo-grid.tsx`
- Create: `src/components/skeleton.tsx`

- [ ] **Step 1: RepoCard 组件**

Write `src/components/repo-card.tsx`:

```typescript
"use client"

import Link from "next/link"
import { Star, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RepoCardProps {
  id: string
  name: string
  owner: string
  repo: string
  description?: string | null
  stars?: number | null
  trendingRank?: number | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
  savedAt?: string | null
  onUnsave?: () => void
}

export function RepoCard({
  id,
  name,
  owner,
  stars,
  summary,
  trendingRank,
}: RepoCardProps) {
  return (
    <Link
      href={`/repo/${id}`}
      className={cn(
        "group flex flex-col gap-3 p-5 rounded-2xl",
        "bg-card border border-border",
        "hover:border-foreground/10 transition-colors duration-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {trendingRank && (
              <span className="text-[11px] font-medium text-muted tabular-nums">
                #{trendingRank}
              </span>
            )}
            <h3 className="text-sm font-medium text-foreground truncate">{name}</h3>
          </div>
        </div>
        {stars != null && (
          <div className="flex items-center gap-1 text-xs text-muted flex-shrink-0">
            <Star className="h-3 w-3" />
            <span className="tabular-nums">
              {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
            </span>
          </div>
        )}
      </div>

      {summary && (
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
          {summary.aiSummary}
        </p>
      )}

      {summary?.techTags && summary.techTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.techTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-md bg-muted-bg text-muted font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-muted">
          {summary?.whyMatters}
        </span>
        {summary?.worthDeepDive && (
          <span className="flex items-center gap-1 text-[11px] text-accent font-medium flex-shrink-0">
            深入研究
            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </span>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: RepoGrid 组件**

Write `src/components/repo-grid.tsx`:

```typescript
import { RepoCard } from "./repo-card"

interface RepoItem {
  id: string
  name: string
  owner: string
  repo: string
  description?: string | null
  stars?: number | null
  trendingRank?: number | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

interface RepoGridProps {
  items: RepoItem[]
}

export function RepoGrid({ items }: RepoGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <RepoCard key={item.id} {...item} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Skeleton 组件**

Write `src/components/skeleton.tsx`:

```typescript
import { cn } from "@/lib/utils"

export function RepoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-card border border-border animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-6 bg-muted-bg rounded" />
        <div className="h-4 w-40 bg-muted-bg rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted-bg rounded" />
        <div className="h-3 w-3/4 bg-muted-bg rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-muted-bg rounded-md" />
        <div className="h-5 w-14 bg-muted-bg rounded-md" />
        <div className="h-5 w-10 bg-muted-bg rounded-md" />
      </div>
      <div className="flex justify-between mt-auto pt-1">
        <div className="h-3 w-32 bg-muted-bg rounded" />
        <div className="h-3 w-16 bg-muted-bg rounded" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <RepoCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add src/components/repo-card.tsx src/components/repo-grid.tsx src/components/skeleton.tsx
git commit -m "feat: add RepoCard, RepoGrid, and Skeleton components"
```

---

### Task 11: 页面（Dashboard, RepoDetail, Saved）

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/repo/[id]/page.tsx`
- Create: `src/app/saved/page.tsx`
- Create: `src/hooks/use-trending.ts`
- Create: `src/hooks/use-saved.ts`

- [ ] **Step 1: useTrending Hook**

Write `src/hooks/use-trending.ts`:

```typescript
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface TrendingItem {
  id: string
  name: string
  owner: string
  repo: string
  description: string | null
  language: string | null
  stars: number | null
  forks: number | null
  trendingRank: number | null
  summary: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

interface TrendingResponse {
  count: number
  date: string
  items: TrendingItem[]
}

export function useTrending(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR<TrendingResponse>(
    `/api/trending?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  )

  return {
    items: data?.items ?? [],
    date: data?.date ?? null,
    isLoading,
    isError: error,
    mutate,
  }
}
```

- [ ] **Step 2: useSaved Hook**

Write `src/hooks/use-saved.ts`:

```typescript
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SavedItem {
  id: string
  name: string
  owner: string
  repo: string
  summary: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

export function useSaved() {
  const { data, error, isLoading, mutate } = useSWR<{ items: SavedItem[] }>(
    "/api/saved",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    items: data?.items ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
```

- [ ] **Step 3: Dashboard 页面**

Write `src/app/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Header } from "@/components/layout/header"
import { RepoGrid } from "@/components/repo-grid"
import { DashboardSkeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import { useTrending } from "@/hooks/use-trending"

export default function Dashboard() {
  const [limit, setLimit] = useState(10)
  const { items, isLoading, mutate } = useTrending(limit)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch("/api/trending/refresh", { method: "POST" })
    setTimeout(() => {
      mutate()
      setRefreshing(false)
    }, 5000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        searchItems={items.map((item) => ({
          id: item.id,
          name: item.name,
          techTags: item.summary?.techTags,
          aiSummary: item.summary?.aiSummary,
        }))}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              今日 GitHub Trending
            </h1>
            <p className="text-sm text-muted mt-1">
              AI 分析与筛选，从噪音中提取信号
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs bg-transparent border border-border rounded-lg px-2.5 py-1.5 text-muted focus:outline-none focus:border-accent"
            >
              <option value={5}>5 个</option>
              <option value={10}>10 个</option>
              <option value={20}>20 个</option>
              <option value={25}>25 个</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1.5 text-muted hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">
                {refreshing ? "刷新中..." : "刷新"}
              </span>
            </Button>
          </div>
        </div>

        {refreshing && (
          <div className="w-full h-0.5 bg-muted-bg rounded-full mb-6 overflow-hidden">
            <div className="h-full w-1/2 bg-accent rounded-full animate-pulse" />
          </div>
        )}

        {isLoading ? (
          <DashboardSkeleton />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted text-sm mb-4">暂无数据，等待首次抓取完成</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              手动刷新
            </Button>
          </div>
        ) : (
          <RepoGrid items={items} />
        )}
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Signal &copy; 2026
      </footer>
    </div>
  )
}
```

- [ ] **Step 4: RepoDetail 页面**

Write `src/app/repo/[id]/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Star, GitFork, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { RepoCardSkeleton } from "@/components/skeleton"
import { useSession } from "next-auth/react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function RepoDetail() {
  const params = useParams()
  const id = params.id as string
  const { data: session } = useSession()

  const { data, isLoading } = useSWR(`/api/repo/${id}`, fetcher)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!session?.user) {
      alert("请先登录")
      return
    }
    setSaving(true)
    const method = saved ? "DELETE" : "POST"
    await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: id }),
    })
    setSaved(!saved)
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-muted-bg rounded" />
            <div className="h-8 w-64 bg-muted-bg rounded" />
            <div className="h-4 w-full bg-muted-bg rounded" />
            <div className="h-20 bg-muted-bg rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 text-center">
          <p className="text-muted">项目未找到</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "已收藏" : "收藏"}
            </Button>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
          {data.name}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted mb-8">
          {data.stars != null && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {data.stars.toLocaleString()}
            </span>
          )}
          {data.forks != null && (
            <span className="flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5" /> {data.forks.toLocaleString()}
            </span>
          )}
          {data.language && (
            <span>{data.language}</span>
          )}
        </div>

        {data.summary ? (
          <>
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">项目简介</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {data.summary.aiSummary}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">值得关注的原因</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {data.summary.whyMatters}
              </p>
            </section>

            {data.summary.worthDeepDive && data.summary.deepDiveReason && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">是否值得深入研究</h2>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                    值得深入研究
                  </span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {data.summary.deepDiveReason}
                </p>
              </section>
            )}

            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">技术标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.summary.techTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-md bg-muted-bg text-muted font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">项目简介</h2>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {data.description ?? "暂无描述"}
            </p>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">GitHub 信息</h2>
          <div className="bg-muted-bg rounded-xl p-4 text-sm text-foreground/80">
            <p>AI 分析提供方：{data.summary?.provider ?? "N/A"}</p>
          </div>
        </section>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Saved 页面**

Write `src/app/saved/page.tsx`:

```typescript
"use client"

import { signIn, useSession } from "next-auth/react"
import { Header } from "@/components/layout/header"
import { RepoGrid } from "@/components/repo-grid"
import { RepoCardSkeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import { Bookmark } from "lucide-react"
import Link from "next/link"
import { useSaved } from "@/hooks/use-saved"

export default function SavedPage() {
  const { data: session, status } = useSession()
  const { items, isLoading } = useSaved()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="h-8 w-8 text-muted mb-4" />
            <p className="text-muted text-sm mb-4">请先登录以查看收藏</p>
            <Button variant="outline" size="sm" onClick={() => signIn("github")}>
              使用 GitHub 登录
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">我的收藏</h1>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="h-8 w-8 text-muted mb-4" />
            <p className="text-muted text-sm mb-4">还没有收藏项目</p>
            <Link href="/">
              <Button variant="outline" size="sm">
                去 Dashboard 看看吧
              </Button>
            </Link>
          </div>
        ) : (
          <RepoGrid items={items} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 6: 添加 SessionProvider 到 Layout**

Update `src/app/layout.tsx` to include SessionProvider:

```typescript
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Signal",
  description: "AI-powered GitHub trending insights",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: 提交**

```bash
git add src/app/page.tsx src/app/repo/ src/app/saved/ src/hooks/ src/app/layout.tsx
git commit -m "feat: add Dashboard, RepoDetail, Saved pages with hooks"
```

---

### Task 12: 环境变量配置与启动验证

**Files:**
- Create: `.env.example`
- Modify: `next.config.ts`

- [ ] **Step 1: 创建 .env.example**

Write `.env.example`:

```
# AI Provider (deepseek | openai | anthropic | gemini)
AI_PROVIDER=deepseek

# OpenAI / DeepSeek (OpenAI-compatible)
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-haiku-latest

# Google Gemini
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# NextAuth
AUTH_SECRET=generate-a-random-secret
AUTH_GITHUB_ID=your_github_oauth_client_id
AUTH_GITHUB_SECRET=your_github_oauth_client_secret

# Pipeline
TRENDING_COUNT=10
```

- [ ] **Step 2: Create .env.local**

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

- [ ] **Step 3: 生成 AUTH_SECRET**

```bash
cd /Users/jaehua/projects/i/signal/web && node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and update `AUTH_SECRET` in `.env.local`.

- [ ] **Step 4: 启动验证**

```bash
cd /Users/jaehua/projects/i/signal/web && npx prisma migrate dev --name init && npm run dev
```

Verify:
- [ ] Dashboard 显示骨架屏，然后显示空状态"暂无数据"
- [ ] Header 显示 Signal logo, 搜索按钮, ThemeToggle, 登录按钮
- [ ] 点击登录按钮跳转到 GitHub OAuth
- [ ] 切换 ThemeToggle light/dark
- [ ] 点击 ⌘K 打开搜索面板

- [ ] **Step 5: 提交**

```bash
git add .env.example next.config.ts
git commit -m "chore: add environment variable template and config"
```

---

### Task 13: 类型声明补充

**Files:**
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: 扩展 NextAuth Session 类型**

Write `src/types/next-auth.d.ts`:

```typescript
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      githubLogin?: string | null
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/
git commit -m "types: extend NextAuth session type"
```

---

### 自检清单

完成后验证：

- [ ] `npm run dev` 启动无报错
- [ ] `npx prisma migrate dev` 生成 SQLite 数据库
- [ ] `npm run build` 构建成功
- [ ] Dashboard 显示骨架屏 → 空状态（无数据时）
- [ ] 配置 LLM API Key 后，Pipeline 正常抓取并生成摘要
- [ ] 卡片网格展示 AI 摘要、标签、stars
- [ ] 点击卡片进入详情页
- [ ] GitHub OAuth 登录/登出正常
- [ ] 收藏/取消收藏正常
- [ ] 搜索 ⌘K 面板打开并过滤项目
- [ ] Light/Dark 主题切换正常
- [ ] 移动端响应式布局
