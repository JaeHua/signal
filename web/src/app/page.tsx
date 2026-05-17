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
