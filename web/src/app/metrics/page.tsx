"use client"

import useSWR from "swr"
import { Zap, CheckCircle2, Coins, DollarSign, Boxes } from "lucide-react"
import { Header } from "@/components/layout/header"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function MetricsPage() {
  const { data } = useSWR("/api/metrics?days=14", fetcher)

  const today = data?.today
  const metrics = data?.metrics ?? []
  const recentRuns = data?.recentRuns ?? []

  const chartData = metrics.reduce((acc: Array<Record<string, unknown>>, m: { date: string; source: string; totalProcessed: number; totalErrors: number }) => {
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

  const StatCard = ({ icon: Icon, label, value, unit, color }: {
    icon: React.ComponentType<{ className?: string }>
    label: string; value: string | number; unit?: string; color: string
  }) => (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex items-start gap-3">
      <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted mb-0.5">{label}</div>
        <div className="text-lg sm:text-xl font-semibold text-foreground tabular-nums truncate">
          {value}{unit && <span className="text-sm font-normal text-muted ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  )

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !payload) return null
    const items = payload as Array<{ name: string; value: number; color: string }>
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <div className="text-muted mb-1">{label as string}</div>
        {items.map((item: { name: string; value: number; color: string }) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
            <span className="text-foreground font-medium">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight mb-6">指标仪表盘</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard icon={Boxes} label="今日处理" value={today?.totalProcessed ?? "-"} unit="个"
            color="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
          <StatCard icon={CheckCircle2} label="成功率" value={today?.successRate ?? "-"} unit="%"
            color="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400" />
          <StatCard icon={Coins} label="Token 消耗"
            value={today?.totalTokens ? `${(today.totalTokens / 1000).toFixed(1)}K` : "-"}
            color="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400" />
          <StatCard icon={DollarSign} label="估算成本"
            value={today?.estimatedCost ? `$${today.estimatedCost.toFixed(4)}` : "-"}
            color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">每日处理量</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="githubGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0071e3" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="hnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6600" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ff6600" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="github" stroke="#0071e3" strokeWidth={2} fill="url(#githubGrad)" name="GitHub" />
                <Area type="monotone" dataKey="hackernews" stroke="#ff6600" strokeWidth={2} fill="url(#hnGrad)" name="Hacker News" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">错误趋势</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="errors" stroke="#ff3b30" strokeWidth={2} dot={{ r: 3, fill: "#ff3b30" }} name="Errors" />
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
