"use client"

import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function MetricsPage() {
  const { data } = useSWR("/api/metrics?days=14", fetcher)

  const today = data?.today
  const metrics = data?.metrics ?? []
  const recentRuns = data?.recentRuns ?? []

  const chartData = metrics.reduce((acc: Array<Record<string, unknown>>, m: { date: string; source: string; totalProcessed: number; totalErrors: number; totalRuns: number; successRuns: number; totalDurationMs: number; avgLatencyMs?: number }) => {
    const date = new Date(m.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
    let entry = acc.find((e) => e.date === date)
    if (!entry) {
      entry = { date, github: 0, hackernews: 0, errors: 0 }
      acc.push(entry)
    }
    if (m.source === "github") entry.github = (entry.github as number) + m.totalProcessed
    if (m.source === "hackernews") entry.hackernews = (entry.hackernews as number) + m.totalProcessed
    entry.errors = (entry.errors as number) + m.totalErrors
    return acc
  }, [])

  const StatCard = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">
        {value}{unit && <span className="text-sm text-muted ml-1">{unit}</span>}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight mb-6">指标仪表盘</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard label="今日处理" value={today?.totalProcessed ?? "-"} unit="个" />
          <StatCard label="成功率" value={today?.successRate ?? "-"} unit="%" />
          <StatCard label="Token 消耗" value={today?.totalTokens ? `${(today.totalTokens / 1000).toFixed(1)}K` : "-"} />
          <StatCard label="估算成本" value={today?.estimatedCost ? `$${today.estimatedCost.toFixed(4)}` : "-"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">每日处理量</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip />
                <Bar dataKey="github" stackId="a" fill="#0071e3" name="GitHub" />
                <Bar dataKey="hackernews" stackId="a" fill="#ff6600" name="HN" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">成功率趋势</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip />
                <Line type="monotone" dataKey="errors" stroke="#ff3b30" name="Errors" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">最近运行</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentRuns.map((run: { id: string; source: string; status: string; totalDurationMs?: number; avgLatencyMs?: number; totalTokens?: number; scraped: number; processed: number; errors: number }) => (
              <div key={run.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border last:border-0">
                <span className={run.status === "success" ? "text-green-600" : run.status === "partial" ? "text-yellow-600" : "text-red-600"}>●</span>
                <span className="font-medium w-20">{run.source}</span>
                <span className="text-muted">
                  {run.scraped}s / {run.processed}p{run.errors > 0 ? ` / ${run.errors}e` : ""}
                </span>
                <span className="text-muted ml-auto tabular-nums">
                  {run.totalDurationMs != null ? `${(run.totalDurationMs / 1000).toFixed(1)}s` : ""}
                  {run.avgLatencyMs != null ? ` · ${run.avgLatencyMs}ms/item` : ""}
                  {run.totalTokens != null ? ` · ${run.totalTokens}t` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
