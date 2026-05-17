# Signal v3 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 移动端响应式适配、语义向量搜索、搜索 UI 增强

**Architecture:** 新增 embedding 字段到 SignalSummary，Pipeline 生成摘要时同步生成向量，搜索 API 做余弦相似度排序，全页面 Tailwind 响应式适配。

---

### Task 1: Embedding + 搜索 API

**Files:**
- Create: `src/lib/embedding.ts`
- Create: `src/app/api/search/route.ts`
- Modify: `prisma/schema.prisma` (add `embedding` to SignalSummary)

**Step 1: Prisma schema add embedding field**

```prisma
// In SignalSummary model, add:
  embedding   String?
```

Run:
```bash
cd /Users/jaehua/projects/i/signal/web && npx prisma db push --accept-data-loss
```

**Step 2: Create embedding utility**

Write `src/lib/embedding.ts`:

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY!
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "deepseek-chat", input: text }),
  })

  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding.slice(0, 768)
}

export async function searchByEmbedding(query: string, summaries: Array<{ id: string; signalId: string; aiSummary: string; techTags: string; embedding: string | null }>) {
  const queryEmb = await generateEmbedding(query)

  const results = summaries
    .filter((s) => s.embedding)
    .map((s) => {
      const emb = JSON.parse(s.embedding!)
      const score = cosineSimilarity(queryEmb, emb)
      return { ...s, score }
    })
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.similarity)

  return results
}
```

**Step 3: Create search API**

Write `src/app/api/search/route.ts`:

```typescript
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchByEmbedding } from "@/lib/embedding"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const q = sp.get("q") ?? ""
  const source = sp.get("source")
  const days = parseInt(sp.get("days") ?? "30", 10)
  const limit = parseInt(sp.get("limit") ?? "10", 10)

  if (!q.trim()) {
    const where: Record<string, unknown> = {}
    if (source && source !== "all") where.source = source
    const signals = await prisma.signal.findMany({
      where,
      include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: limit,
      orderBy: { createdAt: "desc" },
    })
    return Response.json({
      items: signals.map((s) => ({
        id: s.id, source: s.source, title: s.title,
        summary: s.summaries[0] ? { aiSummary: s.summaries[0].aiSummary, techTags: JSON.parse(s.summaries[0].techTags) } : null,
        score: null,
      })),
    })
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)

  const summaries = await prisma.signalSummary.findMany({
    where: {
      embedding: { not: null },
      createdAt: { gte: sinceDate },
      signal: source && source !== "all" ? { source } : undefined,
    },
    include: { signal: true },
    orderBy: { createdAt: "desc" },
  })

  const results = await searchByEmbedding(q, summaries.map((s) => ({
    id: s.signal.id,
    signalId: s.signalId,
    aiSummary: s.aiSummary,
    techTags: s.techTags,
    embedding: s.embedding,
  })))

  return Response.json({
    items: results.slice(0, limit).map((r) => {
      const summary = summaries.find((s) => s.signalId === r.signalId)
      return {
        id: summary?.signal.id,
        source: summary?.signal.source,
        title: summary?.signal.title,
        summary: { aiSummary: r.aiSummary, techTags: JSON.parse(r.techTags) },
        score: Math.round(r.score * 100),
      }
    }),
  })
}
```

**Step 4: Commit**

```bash
git add src/lib/embedding.ts src/app/api/search/ src/app/api/search/route.ts prisma/
git commit -m "feat: add embedding utility and semantic search API"
```

---

### Task 2: Pipeline 嵌入生成

**Files:**
- Modify: `src/pipeline/pipeline.ts`

**Step 1: Add embedding generation in pipeline**

In the pipeline after `summary` is generated, add:

```typescript
// After: const summary = await aiProvider.generateSummary(aiItem)

let embedding: number[] | null = null
try {
  const embedText = `${item.title}. ${item.description ?? ""}`.trim()
  const { generateEmbedding } = await import("@/lib/embedding")
  embedding = await generateEmbedding(embedText)
} catch (error) {
  console.error(`[Pipeline] Embedding failed for ${item.title}:`, error)
}

// In the prisma.signalSummary.create, add:
embedding: embedding ? JSON.stringify(embedding) : null,
```

**Step 2: Commit**

```bash
git add src/pipeline/pipeline.ts
git commit -m "feat: generate embeddings during pipeline AI processing"
```

---

### Task 3: 搜索 UI 增强

**Files:**
- Modify: `src/components/layout/search-bar.tsx`

**Step 1: Rewrite SearchBar**

Replace the entire search-bar.tsx with the enhanced version that:
- Calls `/api/search?q=...` instead of local filtering
- Adds 300ms debounce
- Shows source/time filters
- Shows similarity score
- Shows keyboard shortcuts footer

Full code for `src/components/layout/search-bar.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "@/components/source-badge"
import { useRouter } from "next/navigation"

interface SearchItem {
  id: string
  name: string
  techTags?: string[]
  aiSummary?: string
}

interface SearchBarProps {
  items: SearchItem[]
}

interface SearchResult {
  id: string
  source: string
  title: string
  score: number | null
  summary?: { aiSummary: string; techTags: string[] } | null
}

export function SearchBar({ items: _items }: SearchBarProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState("all")
  const [days, setDays] = useState(30)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&source=${source}&days=${days}&limit=10`)
      const data = await res.json()
      setResults(data.items ?? [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [source, days])

  useEffect(() => {
    const timer = setTimeout(() => { if (query.trim()) doSearch(query) }, 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((p) => !p) }
    if (e.key === "Escape") { setOpen(false) }
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-muted text-xs w-48 justify-start">
        <Search className="h-3.5 w-3.5" />搜索项目...
        <kbd className="ml-auto text-[10px] text-muted bg-muted-bg px-1 rounded">⌘K</kbd>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted" />
            <input ref={inputRef} value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="语义搜索..." autoComplete="off"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted" />
            {loading && <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
            <kbd className="text-[10px] text-muted bg-muted-bg px-1.5 py-0.5 rounded">esc</kbd>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-[11px]">
            {["all", "github", "hackernews"].map((s) => (
              <button key={s} onClick={() => setSource(s)}
                className={`px-2 py-0.5 rounded-md transition-colors ${source === s ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground"}`}>
                {s === "all" ? "全部" : s === "github" ? "GitHub" : "HN"}
              </button>
            ))}
            <div className="flex-1" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-muted text-[10px]">
              <option value={7}>7天</option><option value={30}>30天</option><option value={90}>90天</option>
            </select>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {!query.trim() && (
              <div className="px-4 py-8 text-center text-sm text-muted">输入关键词搜索</div>
            )}
            {loading && <div className="px-4 py-8 text-center text-sm text-muted">搜索中...</div>}
            {!loading && query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted">未找到匹配内容，试试其他关键词</div>
            )}
            {!loading && results.map((item) => (
              <button key={item.id}
                onClick={() => { router.push(`/signals/${item.id}`); setOpen(false); setQuery(""); setResults([]) }}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted-bg transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                    <SourceBadge source={item.source} />
                  </div>
                  {item.summary && (
                    <div className="text-xs text-muted mt-0.5 line-clamp-1">{item.summary.aiSummary}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.score != null && (
                    <span className="text-[10px] font-medium text-accent tabular-nums">{item.score}%</span>
                  )}
                  {item.summary?.techTags?.slice(0, 2).map((t: string) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted-bg text-muted">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted">
            <span>⌘K 打开</span><span>↑↓ 导航</span><span>↵ 打开</span><span>esc 关闭</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/layout/search-bar.tsx
git commit -m "feat: semantic search UI with embedding, source filter, similarity score"
```

---

### Task 4: 移动端适配

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/signal-card.tsx`
- Modify: `src/components/source-tabs.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/history/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/skeleton.tsx`

**Key responsive changes:**

1. **Header** - `h-14` → `h-12 sm:h-14`，手机隐藏文字导航
2. **SignalCard** - `p-5 rounded-2xl` → `p-4 sm:p-5 rounded-xl sm:rounded-2xl`
3. **SourceTabs** - `px-3` → `px-2.5 sm:px-3`，`text-xs` → `text-[11px] sm:text-xs`
4. **Dashboard title** - `text-lg` → `text-base sm:text-lg`
5. **History page** - 运行日志容器 `max-h-56 sm:max-h-64`
6. **Settings page** - `max-w-2xl">` → `px-4 sm:px-6 max-w-2xl`
7. **Global** - Footer `hidden sm:block`，Input min-h-11 for touch
8. **Skeleton** - grid-cols-1 only on mobile

**Commit:**
```bash
git add src/
git commit -m "feat: full mobile responsive adaptation"
```

---

### Task 5: 验证

- `npx tsc --noEmit` 零错误
- `npx prisma db push` 成功
- 所有页面在手机宽度下正常显示
- 搜索返回语义匹配结果
