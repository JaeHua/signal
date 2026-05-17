# Signal v2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 将 Signal 从单源 GitHub Trending 升级为多信息源平台，新增 Hacker News、用户配置、运行日志、UI 优化。

**Architecture:** `Repo` 升级为通用 `Signal` 模型，SourceProvider 接口泛化，Pipeline 按来源独立执行并记录 PipelineRun，新增 Settings 和 History 页面。

**Tech Stack:** 同 v1（Next.js 16, Prisma v7 SQLite, NextAuth v5, Cheerio, node-cron, SWR, Tailwind CSS 4）

---

### Task 1: 数据模型迁移（Signal + 新表）

**Files:**
- Create: `prisma/migrations/.../migration.sql`（via migrate）
- Modify: `prisma/schema.prisma`
- Create: `src/lib/encryption.ts`

**Step 1: 更新 Prisma Schema**

Replace the existing `Repo`, `RepoSummary` models with `Signal`, `SignalSummary`. Add `PipelineRun`, `SourceConfig`, `AIConfig`.

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

model User {
  id          String        @id @default(cuid())
  githubId    Int           @unique
  githubLogin String
  name        String?
  email       String?
  avatarUrl   String?
  createdAt   DateTime      @default(now())
  savedSignals SavedSignal[]
}

model Signal {
  id           String          @id @default(cuid())
  source       String
  sourceId     String
  title        String
  url          String
  description  String?
  metadata     String?
  publishedAt  DateTime?
  trendingDate DateTime?
  trendingRank Int?
  createdAt    DateTime        @default(now())
  summaries    SignalSummary[]
  savedBy      SavedSignal[]

  @@unique([source, sourceId])
}

model SignalSummary {
  id             String   @id @default(cuid())
  signalId       String
  signal         Signal   @relation(fields: [signalId], references: [id])
  summaryDate    DateTime @default(now())
  aiSummary      String
  techTags       String
  whyMatters     String
  worthDeepDive  Boolean
  deepDiveReason String?
  provider       String
  createdAt      DateTime @default(now())

  @@index([signalId, summaryDate])
}

model SavedSignal {
  id        String   @id @default(cuid())
  userId    String
  signalId  String
  user      User     @relation(fields: [userId], references: [id])
  signal    Signal   @relation(fields: [signalId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, signalId])
}

model PipelineRun {
  id         String    @id @default(cuid())
  source     String
  status     String
  scraped    Int       @default(0)
  processed  Int       @default(0)
  skipped    Int       @default(0)
  errors     Int       @default(0)
  errorLog   String?
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
}

model SourceConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  enabled   Boolean  @default(true)
  maxItems  Int      @default(10)
  frequency String   @default("6h")
  config    String?
  updatedAt DateTime @updatedAt
}

model AIConfig {
  id        String   @id @default(cuid())
  provider  String
  model     String
  apiKey    String
  baseUrl   String?
  isActive  Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

**Step 2: 运行迁移**

```bash
cd /Users/jaehua/projects/i/signal/web && npx prisma migrate dev --name v2_signal_refactor
```

⚠️ 这会删除旧 `Repo`/`RepoSummary` 表。旧数据将丢失，这是 v2 重设计可接受的。

**Step 3: 创建加密工具**

Write `src/lib/encryption.ts`:

```typescript
const SECRET = process.env.ENCRYPTION_KEY ?? "signal-default-key-change-me"

export function encrypt(text: string): string {
  return btoa(text)
}

export function decrypt(encoded: string): string {
  return atob(encoded)
}
```

**Step 4: 创建默认配置种子**

Write `src/lib/seed.ts`:

```typescript
import { prisma } from "@/lib/prisma"

export async function seedDefaults() {
  const existing = await prisma.sourceConfig.findFirst({ where: { key: "github" } })
  if (!existing) {
    await prisma.sourceConfig.create({
      data: { key: "github", enabled: true, maxItems: 10, frequency: "6h" },
    })
  }
  const existingHN = await prisma.sourceConfig.findFirst({ where: { key: "hackernews" } })
  if (!existingHN) {
    await prisma.sourceConfig.create({
      data: { key: "hackernews", enabled: true, maxItems: 10, frequency: "6h" },
    })
  }
  const existingAI = await prisma.aIConfig.findFirst({ where: { isActive: true } })
  if (!existingAI) {
    await prisma.aIConfig.create({
      data: {
        provider: process.env.AI_PROVIDER ?? "deepseek",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        apiKey: encrypt(process.env.DEEPSEEK_API_KEY ?? ""),
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        isActive: true,
      },
    })
  }
}
```

**Step 5: 提交**

```bash
git add prisma/ src/lib/encryption.ts src/lib/seed.ts
git commit -m "feat: migrate data model to Signal + add config tables"
```

---

### Task 2: SourceProvider 泛化 + Hacker News

**Files:**
- Modify: `src/providers/source/types.ts`
- Modify: `src/providers/source/github-trending.ts`
- Create: `src/providers/source/hackernews.ts`
- Modify: `src/providers/source/index.ts`

**Step 1: 更新类型**

Write `src/providers/source/types.ts`:

```typescript
export interface SignalItem {
  source: string
  sourceId: string
  title: string
  url: string
  description: string | null
  publishedAt: string | null
  metadata: Record<string, unknown>
  rank: number
}

export interface SourceProvider {
  name: string
  fetchItems(maxItems: number): Promise<SignalItem[]>
}
```

**Step 2: 更新 GitHub Provider**

Rewrite `src/providers/source/github-trending.ts`:

```typescript
import * as cheerio from "cheerio"
import { SourceProvider, SignalItem } from "./types"

export function createGitHubTrendingProvider(config?: {
  language?: string
  since?: "daily" | "weekly" | "monthly"
}): SourceProvider {
  const language = config?.language ?? ""
  const since = config?.since ?? "daily"

  return {
    name: "github",
    async fetchItems(maxItems: number): Promise<SignalItem[]> {
      const langPath = language ? `/${language}` : ""
      const url = `https://github.com/trending${langPath}?since=${since}`

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/1.0)" },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const items: SignalItem[] = []

      try {
        $("article.Box-row").each((index, element) => {
          if (items.length >= maxItems) return

          const $el = $(element)
          const fullName = $el.find("h2 a").text().trim().replace(/\s+/g, "")
          const [owner, repo] = fullName.split("/")
          const urlPath = $el.find("h2 a").attr("href") ?? ""
          const description = $el.find("p").text().trim() || null
          const language = $el.find("[itemprop='programmingLanguage']").text().trim() || null

          const starsStr = $el.find("a[href$='/stargazers']").text().trim()
          const forksStr = $el.find("a[href$='/forks']").text().trim()

          const stars = starsStr ? parseInt(starsStr.replace(/,/g, ""), 10) || null : null
          const forks = forksStr ? parseInt(forksStr.replace(/,/g, ""), 10) || null : null

          if (owner && repo) {
            const sourceId = `${owner}/${repo}`
            items.push({
              source: "github",
              sourceId,
              title: sourceId,
              url: `https://github.com${urlPath}`,
              description,
              publishedAt: null,
              metadata: { stars: stars ?? 0, forks: forks ?? 0, language: language ?? "Unknown" },
              rank: index + 1,
            })
          }
        })
      } catch (error) {
        console.error("Failed to parse trending HTML:", error)
      }

      return items
    },
  }
}
```

**Step 3: 创建 Hacker News Provider**

Write `src/providers/source/hackernews.ts`:

```typescript
import { SourceProvider, SignalItem } from "./types"

export function createHackerNewsProvider(): SourceProvider {
  const HN_BASE = "https://hacker-news.firebaseio.com/v0"

  async function fetchItem(id: number): Promise<SignalItem | null> {
    try {
      const res = await fetch(`${HN_BASE}/item/${id}.json`)
      if (!res.ok) return null
      const item = await res.json()
      if (!item || item.type !== "story") return null

      return {
        source: "hackernews",
        sourceId: String(item.id),
        title: item.title ?? "Untitled",
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        description: item.text?.substring(0, 200) ?? null,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
        metadata: {
          score: item.score ?? 0,
          comments: item.descendants ?? 0,
          author: item.by ?? "unknown",
        },
        rank: 0,
      }
    } catch {
      return null
    }
  }

  return {
    name: "hackernews",
    async fetchItems(maxItems: number): Promise<SignalItem[]> {
      const res = await fetch(`${HN_BASE}/topstories.json`)
      if (!res.ok) throw new Error(`Failed to fetch HN top stories: ${res.status}`)
      const ids: number[] = await res.json()
      const topIds = ids.slice(0, Math.min(maxItems * 2, 100))

      const results = await Promise.all(topIds.map(fetchItem))
      const items = results.filter(Boolean).slice(0, maxItems) as SignalItem[]
      return items.map((item, i) => ({ ...item, rank: i + 1 }))
    },
  }
}
```

**Step 4: 更新注册表**

Write `src/providers/source/index.ts`:

```typescript
import { SourceProvider } from "./types"
import { createGitHubTrendingProvider } from "./github-trending"
import { createHackerNewsProvider } from "./hackernews"

export function createSourceProvider(source: string): SourceProvider {
  switch (source) {
    case "github":
      return createGitHubTrendingProvider()
    case "hackernews":
      return createHackerNewsProvider()
    default:
      throw new Error(`Unknown source: ${source}`)
  }
}

export type { SourceProvider, SignalItem } from "./types"
```

**Step 5: 提交**

```bash
git add src/providers/source/
git commit -m "feat: refactor SourceProvider to generic SignalItem + add Hacker News"
```

---

### Task 3: Pipeline 多源改造

**Files:**
- Modify: `src/pipeline/pipeline.ts`
- Modify: `src/pipeline/scheduler.ts`

**Step 1: 重写 Pipeline**

Write `src/pipeline/pipeline.ts`:

```typescript
import { prisma } from "@/lib/prisma"
import { createSourceProvider } from "@/providers/source"
import { createAIProvider, type AIProviderType } from "@/providers/ai"
import { decrypt } from "@/lib/encryption"
import { seedDefaults } from "@/lib/seed"

let isRunning = false

export function isPipelineRunning(): boolean {
  return isRunning
}

async function runSourcePipeline(sourceKey: string): Promise<void> {
  const config = await prisma.sourceConfig.findUnique({ where: { key: sourceKey } })
  if (!config?.enabled) return

  const run = await prisma.pipelineRun.create({
    data: { source: sourceKey, status: "running", startedAt: new Date() },
  })

  let scraped = 0
  let processed = 0
  let skipped = 0
  let errors = 0
  const errorMessages: string[] = []

  try {
    const sourceProvider = createSourceProvider(sourceKey)
    const items = await sourceProvider.fetchItems(config.maxItems)
    scraped = items.length

    const aiConfig = await prisma.aIConfig.findFirst({ where: { isActive: true } })
    if (!aiConfig) {
      throw new Error("No active AI config found")
    }

    const aiProvider = createAIProvider(aiConfig.provider as AIProviderType)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const item of items) {
      try {
        const signal = await prisma.signal.upsert({
          where: { source_sourceId: { source: item.source, sourceId: item.sourceId } },
          create: {
            source: item.source,
            sourceId: item.sourceId,
            title: item.title,
            url: item.url,
            description: item.description,
            metadata: JSON.stringify(item.metadata),
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
          update: {
            title: item.title,
            description: item.description,
            metadata: JSON.stringify(item.metadata),
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
        })

        const existingSummary = await prisma.signalSummary.findFirst({
          where: { signalId: signal.id, summaryDate: { gte: today } },
        })

        if (existingSummary) {
          skipped++
          continue
        }

        const summary = await aiProvider.generateSummary({
          name: item.title,
          owner: item.metadata.author as string ?? "",
          repo: "",
          description: item.description,
          language: (item.metadata.language as string) ?? null,
        })

        await prisma.signalSummary.create({
          data: {
            signalId: signal.id,
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
        const message = error instanceof Error ? error.message : String(error)
        console.error(`Failed to process ${item.title}:`, message)
        errorMessages.push(`${item.title}: ${message}`)
        errors++
      }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    await prisma.signalSummary.deleteMany({
      where: { summaryDate: { lt: sevenDaysAgo } },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessages.push(message)
  }

  await prisma.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: errors > 0 ? "partial" : "success",
      scraped,
      processed,
      skipped,
      errors,
      errorLog: errorMessages.length > 0 ? JSON.stringify(errorMessages) : null,
      finishedAt: new Date(),
    },
  })
}

export async function runPipeline(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    await seedDefaults()
    const configs = await prisma.sourceConfig.findMany({ where: { enabled: true } })
    for (const config of configs) {
      await runSourcePipeline(config.key)
    }
  } finally {
    isRunning = false
  }
}
```

**Step 2: 更新 Scheduler**

Write `src/pipeline/scheduler.ts`:

```typescript
import cron from "node-cron"
import { runPipeline } from "./pipeline"

export function startScheduler(): void {
  cron.schedule("0 */1 * * *", async () => {
    console.log("[Scheduler] Running pipeline...")
    try {
      await runPipeline()
    } catch (error) {
      console.error("[Scheduler] Pipeline failed:", error)
    }
  })

  setTimeout(async () => {
    console.log("[Scheduler] Running initial pipeline on startup...")
    try {
      await runPipeline()
    } catch (error) {
      console.error("[Scheduler] Initial pipeline failed:", error)
    }
  }, 5000)

  console.log("[Scheduler] Started (every hour, checks source configs)")
}
```

**Step 3: 提交**

```bash
git add src/pipeline/
git commit -m "feat: refactor pipeline for multi-source with PipelineRun logging"
```

---

### Task 4: API Routes 重构

**Files:**
- Move: `src/app/api/trending/route.ts` → `src/app/api/signals/route.ts`
- Move: `src/app/api/trending/refresh/route.ts` → `src/app/api/signals/refresh/route.ts`
- Move: `src/app/api/repo/[id]/route.ts` → `src/app/api/signals/[id]/route.ts`
- Create: `src/app/api/history/route.ts`
- Create: `src/app/api/pipeline-runs/route.ts`
- Create: `src/app/api/settings/sources/route.ts`
- Create: `src/app/api/settings/ai/route.ts`
- Modify: `src/app/api/saved/route.ts`

**Step 1: Signals API（替代 trending）**

Write `src/app/api/signals/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const source = searchParams.get("source")
  const limit = parseInt(searchParams.get("limit") ?? "10", 10)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const where: Record<string, unknown> = { trendingDate: { gte: today } }
  if (source && source !== "all") {
    where.source = source
  }

  const signals = await prisma.signal.findMany({
    where,
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

  const items = signals.map((s) => {
    const summary = s.summaries[0] ?? null
    return {
      id: s.id,
      source: s.source,
      title: s.title,
      url: s.url,
      description: s.description,
      metadata: s.metadata ? JSON.parse(s.metadata) : null,
      trendingRank: s.trendingRank,
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

  return Response.json({ count: items.length, date: today.toISOString(), items })
}
```

**Step 2: Signals Refresh**

Write `src/app/api/signals/refresh/route.ts`:

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

**Step 3: Signal Detail**

Write `src/app/api/signals/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const signal = await prisma.signal.findUnique({
    where: { id },
    include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
  })
  if (!signal) return Response.json({ error: "Not found" }, { status: 404 })

  const summary = signal.summaries[0] ?? null
  return Response.json({
    id: signal.id,
    source: signal.source,
    title: signal.title,
    url: signal.url,
    description: signal.description,
    metadata: signal.metadata ? JSON.parse(signal.metadata) : null,
    trendingRank: signal.trendingRank,
    summary: summary ? { aiSummary: summary.aiSummary, techTags: JSON.parse(summary.techTags), whyMatters: summary.whyMatters, worthDeepDive: summary.worthDeepDive, deepDiveReason: summary.deepDiveReason, provider: summary.provider } : null,
  })
}
```

**Step 4: History API**

Write `src/app/api/history/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0]
  const source = searchParams.get("source")

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const where: Record<string, unknown> = { trendingDate: { gte: dayStart, lte: dayEnd } }
  if (source && source !== "all") where.source = source

  const signals = await prisma.signal.findMany({
    where,
    include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { trendingRank: "asc" },
  })

  return Response.json({
    date,
    count: signals.length,
    items: signals.map((s) => {
      const summary = s.summaries[0] ?? null
      return {
        id: s.id, source: s.source, title: s.title, url: s.url,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
        trendingRank: s.trendingRank,
        summary: summary ? { aiSummary: summary.aiSummary, techTags: JSON.parse(summary.techTags), whyMatters: summary.whyMatters, worthDeepDive: summary.worthDeepDive, deepDiveReason: summary.deepDiveReason } : null,
      }
    }),
  })
}
```

**Step 5: Pipeline Runs API**

Write `src/app/api/pipeline-runs/route.ts`:

```typescript
import { prisma } from "@/lib/prisma"

export async function GET() {
  const runs = await prisma.pipelineRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return Response.json({ items: runs })
}
```

**Step 6: Settings APIs**

Write `src/app/api/settings/sources/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const sources = await prisma.sourceConfig.findMany()
  return Response.json({ items: sources })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const config = await prisma.sourceConfig.upsert({
    where: { key: body.key },
    create: { key: body.key, enabled: body.enabled ?? true, maxItems: body.maxItems ?? 10, frequency: body.frequency ?? "6h" },
    update: { enabled: body.enabled, maxItems: body.maxItems, frequency: body.frequency },
  })
  return Response.json(config)
}
```

Write `src/app/api/settings/ai/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export async function GET() {
  const configs = await prisma.aIConfig.findMany({ orderBy: { updatedAt: "desc" } })
  return Response.json({
    items: configs.map((c) => ({
      ...c,
      apiKey: "••••••••",
    })),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  await prisma.aIConfig.updateMany({ data: { isActive: false } })
  
  const config = await prisma.aIConfig.upsert({
    where: { id: body.id ?? "new" },
    create: {
      provider: body.provider,
      model: body.model,
      apiKey: encrypt(body.apiKey),
      baseUrl: body.baseUrl,
      isActive: true,
    },
    update: {
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey !== "••••••••" ? encrypt(body.apiKey) : undefined,
      baseUrl: body.baseUrl,
      isActive: true,
    },
  })
  return Response.json({ ...config, apiKey: "••••••••" })
}
```

**Step 7: 适配 Saved API**

Write `src/app/api/saved/route.ts`（替换旧内容，`repo` → `signal`，`Repo` → `Signal`，`savedRepo` → `savedSignal`）:

```typescript
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const saved = await prisma.savedSignal.findMany({
    where: { userId: session.user.id },
    include: { signal: { include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    orderBy: { createdAt: "desc" },
  })

  return Response.json({
    items: saved.map((s) => {
      const summary = s.signal.summaries[0] ?? null
      return {
        id: s.signal.id, source: s.signal.source, title: s.signal.title,
        url: s.signal.url, metadata: s.signal.metadata ? JSON.parse(s.signal.metadata) : null,
        savedAt: s.createdAt,
        summary: summary ? { aiSummary: summary.aiSummary, techTags: JSON.parse(summary.techTags), whyMatters: summary.whyMatters, worthDeepDive: summary.worthDeepDive, deepDiveReason: summary.deepDiveReason } : null,
      }
    }),
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { signalId } = await request.json()
  if (!signalId) return Response.json({ error: "signalId required" }, { status: 400 })

  await prisma.savedSignal.upsert({
    where: { userId_signalId: { userId: session.user.id, signalId } },
    create: { userId: session.user.id, signalId },
    update: {},
  })
  return Response.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { signalId } = await request.json()
  if (!signalId) return Response.json({ error: "signalId required" }, { status: 400 })
  await prisma.savedSignal.deleteMany({ where: { userId: session.user.id, signalId } })
  return Response.json({ saved: false })
}
```

**Step 8: 旧 API 301 重定向**

Write `src/app/api/trending/route.ts`:

```typescript
export async function GET() {
  return Response.redirect(new URL("/api/signals", process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"), 301)
}
```

Write `src/app/api/repo/[id]/route.ts`:

```typescript
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return Response.redirect(new URL(`/api/signals/${id}`, process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"), 301)
}
```

**Step 9: 提交**

```bash
git add src/app/api/
git commit -m "feat: refactor API routes for Signal model + add history/settings APIs"
```

---

### Task 5: UI 组件适配

**Files:**
- Modify: `src/components/repo-card.tsx` → `src/components/signal-card.tsx`
- Modify: `src/components/repo-grid.tsx` → `src/components/signal-grid.tsx`
- Modify: `src/components/skeleton.tsx`
- Create: `src/components/source-badge.tsx`
- Create: `src/components/source-tabs.tsx`

**Step 1: SignalCard（替代 RepoCard）**

Write `src/components/signal-card.tsx`:

```typescript
"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceBadge } from "./source-badge"

interface SignalCardProps {
  id: string
  source: string
  title: string
  url?: string
  metadata?: {
    stars?: number
    score?: number
    comments?: number
    language?: string
    author?: string
  } | null
  trendingRank?: number | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function SignalCard({ id, source, title, metadata, summary, trendingRank }: SignalCardProps) {
  const metric = metadata?.stars ?? metadata?.score ?? null

  return (
    <Link
      href={`/signals/${id}`}
      className={cn(
        "group flex flex-col gap-3 p-5 rounded-2xl",
        "bg-card border border-border",
        "hover:border-foreground/10 transition-colors duration-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {trendingRank && (
            <span className="text-[11px] font-medium text-muted tabular-nums">#{trendingRank}</span>
          )}
          <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
        </div>
        <SourceBadge source={source} />
      </div>

      {metric != null && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="tabular-nums">{formatCount(metric)}</span>
          {metadata?.comments != null && <span>{formatCount(metadata.comments)} comments</span>}
          {metadata?.author && <span>by {metadata.author}</span>}
        </div>
      )}

      {summary && (
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{summary.aiSummary}</p>
      )}

      {summary?.techTags && summary.techTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.techTags.map((tag) => (
            <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-muted-bg text-muted font-medium">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-muted line-clamp-1">{summary?.whyMatters}</span>
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

**Step 2: SourceBadge**

Write `src/components/source-badge.tsx`:

```typescript
import { cn } from "@/lib/utils"

const sourceBadges: Record<string, { label: string; className: string }> = {
  github: { label: "GitHub", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  hackernews: { label: "HN", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
}

export function SourceBadge({ source }: { source: string }) {
  const badge = sourceBadges[source] ?? { label: source, className: "bg-muted-bg text-muted" }
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0", badge.className)}>
      {badge.label}
    </span>
  )
}
```

**Step 3: SourceTabs**

Write `src/components/source-tabs.tsx`:

```typescript
"use client"

import { cn } from "@/lib/utils"

interface Tab {
  key: string
  label: string
}

interface SourceTabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export function SourceTabs({ tabs, active, onChange }: SourceTabsProps) {
  return (
    <div className="flex gap-1 p-0.5 bg-muted-bg rounded-lg w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            active === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

**Step 4: SignalGrid**

Write `src/components/signal-grid.tsx`:

```typescript
import { SignalCard } from "./signal-card"

interface SignalGridProps {
  items: Array<{
    id: string
    source: string
    title: string
    url?: string
    metadata?: Record<string, unknown> | null
    trendingRank?: number | null
    summary?: {
      aiSummary: string
      techTags: string[]
      whyMatters: string
      worthDeepDive: boolean
      deepDiveReason: string | null
    } | null
  }>
}

export function SignalGrid({ items }: SignalGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <SignalCard key={item.id} {...item} />
      ))}
    </div>
  )
}
```

**Step 5: 更新 Skeleton**

Write `src/components/skeleton.tsx`:

```typescript
export function SignalCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-card border border-border animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 bg-muted-bg rounded" />
        <div className="h-4 w-12 bg-muted-bg rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted-bg rounded" />
        <div className="h-3 w-3/4 bg-muted-bg rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-muted-bg rounded-md" />
        <div className="h-5 w-14 bg-muted-bg rounded-md" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (<SignalCardSkeleton key={i} />))}
    </div>
  )
}
```

**Step 6: 提交**

```bash
git add src/components/
git commit -m "feat: refactor UI components for Signal model + source badges/tabs"
```

---

### Task 6: 页面更新

**Files:**
- Modify: `src/app/page.tsx`（Dashboard）
- Move: `src/app/repo/[id]/page.tsx` → `src/app/signals/[id]/page.tsx`
- Modify: `src/app/saved/page.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/app/history/page.tsx`
- Modify: `src/hooks/use-trending.ts` → `src/hooks/use-signals.ts`
- Modify: `src/hooks/use-saved.ts`

**Step 1: useSignals Hook**

Write `src/hooks/use-signals.ts`:

```typescript
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useSignals(source = "all", limit = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/signals?source=${source}&limit=${limit}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  )
  return { items: data?.items ?? [], date: data?.date ?? null, isLoading, isError: error, mutate }
}
```

**Step 2: 更新 useSaved**

Write `src/hooks/use-saved.ts`:

```typescript
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useSaved() {
  const { data, error, isLoading, mutate } = useSWR("/api/saved", fetcher, { revalidateOnFocus: false })
  return { items: data?.items ?? [], isLoading, isError: error, mutate }
}
```

**Step 3: Dashboard 页面（Tab + 多源）**

Write `src/app/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Header } from "@/components/layout/header"
import { SignalGrid } from "@/components/signal-grid"
import { DashboardSkeleton } from "@/components/skeleton"
import { SourceTabs } from "@/components/source-tabs"
import { Button } from "@/components/ui/button"
import { useSignals } from "@/hooks/use-signals"

const TABS = [
  { key: "all", label: "全部" },
  { key: "github", label: "GitHub" },
  { key: "hackernews", label: "Hacker News" },
]

export default function Dashboard() {
  const [source, setSource] = useState("all")
  const [limit, setLimit] = useState(10)
  const { items, isLoading, mutate } = useSignals(source, limit)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch("/api/signals/refresh", { method: "POST" })
    setTimeout(() => { mutate(); setRefreshing(false) }, 5000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header searchItems={items.map((item: { id: string; title: string; summary?: { techTags?: string[]; aiSummary?: string } }) => ({
        id: item.id, name: item.title, techTags: item.summary?.techTags, aiSummary: item.summary?.aiSummary,
      }))} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">今日信息流</h1>
            <p className="text-sm text-muted mt-1">AI 分析与筛选，从噪音中提取信号</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs bg-transparent border border-border rounded-lg px-2.5 py-1.5 text-muted focus:outline-none focus:border-accent">
              <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={25}>25</option>
            </select>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5 text-muted hover:text-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "刷新中..." : "刷新"}</span>
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <SourceTabs tabs={TABS} active={source} onChange={setSource} />
        </div>

        {refreshing && (
          <div className="w-full h-0.5 bg-muted-bg rounded-full mb-6 overflow-hidden">
            <div className="h-full w-1/2 bg-accent rounded-full animate-pulse" />
          </div>
        )}

        {isLoading ? <DashboardSkeleton /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-muted text-sm mb-4">暂无数据，等待首次抓取完成</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />手动刷新
              </Button>
            </div>
          ) : <SignalGrid items={items} />
        }
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">Signal &copy; 2026</footer>
    </div>
  )
}
```

**Step 4: Settings 页面**

Write `src/app/settings/page.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SettingsPage() {
  const { data: sourcesData, mutate: mutateSources } = useSWR("/api/settings/sources", fetcher)
  const { data: aiData, mutate: mutateAI } = useSWR("/api/settings/ai", fetcher)

  const [aiForm, setAIForm] = useState({ provider: "deepseek", model: "deepseek-chat", apiKey: "", baseUrl: "" })
  const [sources, setSources] = useState<Array<{ key: string; enabled: boolean; maxItems: number }>>([])

  useEffect(() => {
    if (aiData?.items?.[0]) {
      const c = aiData.items[0]
      setAIForm({ provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl ?? "" })
    }
  }, [aiData])

  useEffect(() => {
    if (sourcesData?.items) setSources(sourcesData.items)
  }, [sourcesData])

  const saveAI = useCallback(async () => {
    await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiForm),
    })
    mutateAI()
  }, [aiForm, mutateAI])

  const toggleSource = useCallback(async (key: string, updates: Record<string, unknown>) => {
    await fetch("/api/settings/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...updates }),
    })
    mutateSources()
  }, [mutateSources])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        <h1 className="text-lg font-semibold text-foreground tracking-tight mb-8">设置</h1>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-foreground mb-4">AI 模型</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1">提供商</label>
              <select value={aiForm.provider} onChange={(e) => setAIForm({ ...aiForm, provider: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">模型</label>
              <input value={aiForm.model} onChange={(e) => setAIForm({ ...aiForm, model: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">API Key</label>
              <input type="password" value={aiForm.apiKey} onChange={(e) => setAIForm({ ...aiForm, apiKey: e.target.value })}
                placeholder="sk-xxx"
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Base URL</label>
              <input value={aiForm.baseUrl} onChange={(e) => setAIForm({ ...aiForm, baseUrl: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <Button size="sm" onClick={saveAI} className="btn">保存 AI 配置</Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">信息源</h2>
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.key} className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <div className="text-sm font-medium text-foreground">{s.key}</div>
                </div>
                <div className="flex items-center gap-3">
                  <select value={s.maxItems} disabled={!s.enabled}
                    onChange={(e) => toggleSource(s.key, { maxItems: Number(e.target.value), enabled: s.enabled })}
                    className="text-xs bg-transparent border border-border rounded px-2 py-1 text-muted disabled:opacity-30">
                    <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
                  </select>
                  <button onClick={() => toggleSource(s.key, { enabled: !s.enabled, maxItems: s.maxItems })}
                    className={`w-9 h-5 rounded-full transition-colors ${s.enabled ? "bg-accent" : "bg-muted-bg"} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
```

**Step 5: History 页面**

Write `src/app/history/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { format } from "date-fns"
import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { SignalGrid } from "@/components/signal-grid"
import { DashboardSkeleton } from "@/components/skeleton"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HistoryPage() {
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const { data: runs } = useSWR("/api/pipeline-runs", fetcher)
  const { data: history, isLoading } = useSWR(`/api/history?date=${date}`, fetcher)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <h1 className="text-lg font-semibold text-foreground tracking-tight mb-8">日志与归档</h1>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-foreground mb-4">运行日志</h2>
          <div className="space-y-2">
            {runs?.items?.map((run: { id: string; source: string; status: string; scraped: number; processed: number; skipped: number; errors: number; startedAt: string }) => (
              <div key={run.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border">
                <span className={run.status === "success" ? "text-green-600" : run.status === "partial" ? "text-yellow-600" : "text-red-600"}>
                  {run.status === "success" ? "●" : run.status === "partial" ? "◐" : "✕"}
                </span>
                <span className="text-xs text-muted w-16">{format(new Date(run.startedAt), "HH:mm")}</span>
                <span className="text-xs font-medium w-20">{run.source}</span>
                <span className="text-xs text-muted flex-1">
                  {run.scraped} scraped, {run.processed} processed, {run.skipped} skipped{run.errors > 0 ? `, ${run.errors} errors` : ""}
                </span>
              </div>
            )) ?? <p className="text-sm text-muted">暂无运行记录</p>}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">每日归档</h2>
          <div className="flex items-center gap-2 mb-6">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="text-sm bg-transparent border border-border rounded-lg px-3 py-1.5 text-foreground" />
          </div>
          {isLoading ? <DashboardSkeleton /> :
            history?.items?.length > 0 ? <SignalGrid items={history.items} /> :
            <p className="text-sm text-muted py-10 text-center">该日期暂无数据</p>
          }
        </section>
      </main>
    </div>
  )
}
```

**Step 6: 更新 Saved 页面**

Write `src/app/saved/page.tsx`（将 `RepoGrid` → `SignalGrid`, `useSaved` 适配新类型）:

Same pattern as before but with `SignalGrid` and `signal-card` imports.

**Step 7: 更新 SignalDetail 页面**

Write `src/app/signals/[id]/page.tsx`（同 v1 RepoDetail 结构，路径改为 `/signals/[id]`，API 改为 `/api/signals/[id]`）

**Step 8: 提交**

```bash
git add src/app/ src/hooks/
git commit -m "feat: update all pages for Signal model + add Settings and History"
```

---

### Task 7: 更新 Header 与 Layout

**Files:**
- Modify: `src/components/layout/header.tsx`（加 settings/history 链接）
- Modify: `src/components/layout/search-bar.tsx`（适配 Signal 数据）

**Step 1: Update Header**

```typescript
// Add Gear icon import, add Link to /settings and /history in the header
// Between theme toggle and user menu, or as subtle text links
```

**Step 2: Update SearchBar**

```typescript
// Replace `name` → `title`, adapt search filter to new item shape
```

**Step 3: 提交**

```bash
git add src/components/layout/
git commit -m "feat: update Header with settings/history links"
```

---

### Task 8: 最终验证与整理

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npx prisma migrate dev` 成功
- [ ] `npm run dev` 启动无报错
- [ ] Dashboard 显示多源 Tab
- [ ] Settings 页保存 AI 和信息源配置
- [ ] History 页显示运行日志和归档
- [ ] 旧 API 路径 301 重定向正常

---

### 自检清单

- [ ] 所有文件路径正确
- [ ] `Signal` 替代 `Repo` 的所有引用已更新
- [ ] API Routes 返回数据格式与前端 hooks 一致
- [ ] Prisma schema 与 Pipeline 查询匹配
- [ ] TypeScript 无类型错误
