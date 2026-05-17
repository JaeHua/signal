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
        className="hidden sm:flex items-center gap-2 text-muted text-xs justify-start min-w-[120px] sm:w-48">
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">搜索项目...</span>
        <kbd className="ml-auto text-[10px] text-muted bg-muted-bg px-1 rounded flex-shrink-0">⌘K</kbd>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted flex-shrink-0" />
            <input ref={inputRef} value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="语义搜索..."
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base text-foreground placeholder:text-muted" />
            {loading && <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            <kbd className="hidden sm:block text-[10px] text-muted bg-muted-bg px-1.5 py-0.5 rounded flex-shrink-0">esc</kbd>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b border-border text-[11px]">
            {["all", "github", "hackernews"].map((s) => (
              <button key={s} onClick={() => setSource(s)}
                className={`px-2 py-0.5 rounded-md transition-colors ${source === s ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground"}`}>
                {s === "all" ? "全部" : s === "github" ? "GitHub" : "HN"}
              </button>
            ))}
            <div className="flex-1" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-muted text-[10px] min-h-[28px]">
              <option value={7}>最近一周</option>
              <option value={30}>最近一月</option>
              <option value={90}>最近三月</option>
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
                    <span key={t} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md bg-muted-bg text-muted">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted">
            <span>⌘K 打开</span>
            <span>↑↓ 导航</span>
            <span>↵ 打开</span>
            <span>esc 关闭</span>
          </div>
        </div>
      </div>
    </div>
  )
}
