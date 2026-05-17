"use client"

import { useState } from "react"
import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { SignalGrid } from "@/components/signal-grid"
import { DashboardSkeleton } from "@/components/skeleton"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function HistoryPage() {
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const { data: runs } = useSWR("/api/pipeline-runs", fetcher)
  const { data: history, isLoading } = useSWR(`/api/history?date=${date}`, fetcher)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight mb-6 sm:mb-8">日志与归档</h1>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-sm font-semibold text-foreground mb-3 sm:mb-4">运行日志</h2>
          <div className="space-y-1 max-h-56 sm:max-h-64 overflow-y-auto rounded-xl border border-border p-2">
            {runs?.items?.length > 0 ? (
              runs.items.map((run: { id: string; source: string; status: string; scraped: number; processed: number; skipped: number; errors: number; startedAt: string }) => (
                <div key={run.id} className="flex items-center gap-3 text-sm py-1.5 px-1 border-b border-border last:border-0">
                  <span className={
                    run.status === "success" ? "text-green-600" :
                    run.status === "partial" ? "text-yellow-600" : "text-red-600"
                  }>{run.status === "success" ? "●" : run.status === "partial" ? "◐" : "✕"}</span>
                  <span className="text-xs text-muted w-16 tabular-nums">{formatTime(run.startedAt)}</span>
                  <span className="text-xs font-medium w-24">{run.source}</span>
                  <span className="text-xs text-muted flex-1">
                    {run.scraped} scraped, {run.processed} processed{run.skipped > 0 ? `, ${run.skipped} skipped` : ""}{run.errors > 0 ? `, ${run.errors} errors` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted px-1 py-3">暂无运行记录</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">每日归档</h2>
          <div className="mb-6">
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
