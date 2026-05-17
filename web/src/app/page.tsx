"use client"

import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { Header } from "@/components/layout/header"
import { SignalGrid } from "@/components/signal-grid"
import { DashboardSkeleton } from "@/components/skeleton"
import { SourceTabs } from "@/components/source-tabs"
import { Button } from "@/components/ui/button"
import { WelcomeEmpty } from "@/components/welcome"
import { useShortcutHelp, ShortcutHelp } from "@/components/shortcut-help"
import { useSignals } from "@/hooks/use-signals"

const TABS = [
  { key: "all", label: "全部" },
  { key: "github", label: "GitHub" },
  { key: "hackernews", label: "Hacker News" },
]

export default function Dashboard() {
  const [source, setSource] = useState("all")
  const [limit, setLimit] = useState(10)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const { items, isLoading, mutate } = useSignals(source, limit)
  const [refreshing, setRefreshing] = useState(false)
  const [firstVisit, setFirstVisit] = useState(false)
  const { open: shortcutOpen, setOpen: setShortcutOpen } = useShortcutHelp()

  useEffect(() => {
    const visited = localStorage.getItem("signal_visited")
    if (!visited) {
      setFirstVisit(true)
      if (items.length === 0) localStorage.setItem("signal_visited", "1")
    }
  }, [items.length])

  const filtered = tagFilter
    ? items.filter((item: { summary?: { techTags?: string[] } }) =>
        item.summary?.techTags?.some((t: string) =>
          t.toLowerCase().includes(tagFilter.toLowerCase())
        )
      )
    : items

  const allTags = items.reduce((acc: string[], item: { summary?: { techTags?: string[] } }) => {
    item.summary?.techTags?.forEach((t: string) => {
      if (!acc.includes(t)) acc.push(t)
    })
    return acc
  }, []).slice(0, 12)

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch("/api/signals/refresh", { method: "POST" })
    setTimeout(() => { mutate(); setRefreshing(false) }, 5000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header searchItems={filtered.map(
        (item: { id: string; title: string; summary?: { techTags?: string[]; aiSummary?: string } }) => ({
          id: item.id, name: item.title, techTags: item.summary?.techTags, aiSummary: item.summary?.aiSummary,
        })
      )} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
              今日信息流
              {tagFilter && <span className="text-sm font-normal text-muted ml-2">· {tagFilter} <button onClick={() => setTagFilter(null)} className="text-accent hover:underline">✕</button></span>}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs bg-transparent border border-border rounded-lg px-2.5 py-1.5 text-muted focus:outline-none focus:border-accent">
              <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={25}>25</option>
            </select>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}
              className="gap-1.5 text-muted hover:text-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "刷新中..." : "刷新"}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <SourceTabs tabs={TABS} active={source} onChange={setSource} />
          {allTags.length > 0 && !tagFilter && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag: string) => (
                <button key={tag} onClick={() => setTagFilter(tag)}
                  className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-muted-bg text-muted hover:text-foreground hover:bg-border/50 transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {refreshing && (
          <div className="w-full h-0.5 bg-muted-bg rounded-full mb-6 overflow-hidden">
            <div className="h-full w-1/2 bg-accent rounded-full animate-pulse" />
          </div>
        )}

        {isLoading ? <DashboardSkeleton /> :
          items.length === 0 && firstVisit ? <WelcomeEmpty /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-muted text-sm mb-4">暂无数据</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />手动刷新
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-muted text-sm">没有匹配「{tagFilter}」标签的项目</p>
              <button onClick={() => setTagFilter(null)} className="text-accent text-sm mt-2 hover:underline">清除筛选</button>
            </div>
          ) : <SignalGrid items={filtered} onTagClick={setTagFilter} />
        }
      </main>
      <footer className="hidden sm:block border-t border-border py-6 text-center text-xs text-muted">Signal &copy; 2026</footer>
      <ShortcutHelp open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </div>
  )
}
