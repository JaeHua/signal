import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const days = parseInt(sp.get("days") ?? "7", 10)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const metrics = await prisma.dailyMetrics.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  })

  const recentRuns = await prisma.pipelineRun.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMetrics = metrics.filter((m) => new Date(m.date).getTime() >= today.getTime())

  const todayStats = {
    totalProcessed: todayMetrics.reduce((a, m) => a + m.totalProcessed, 0),
    totalScraped: todayMetrics.reduce((a, m) => a + m.totalScraped, 0),
    totalErrors: todayMetrics.reduce((a, m) => a + m.totalErrors, 0),
    totalTokens: todayMetrics.reduce((a, m) => a + m.totalTokens, 0),
    successRate: todayMetrics.length > 0
      ? Math.round((todayMetrics.reduce((a, m) => a + m.successRuns, 0) / todayMetrics.reduce((a, m) => a + m.totalRuns, 0)) * 100)
      : 100,
    estimatedCost: todayMetrics.reduce((a, m) => a + m.estimatedCost, 0),
    avgLatency: recentRuns.filter((r) => r.avgLatencyMs).length > 0
      ? Math.round(recentRuns.filter((r) => r.avgLatencyMs).reduce((a, r) => a + (r.avgLatencyMs ?? 0), 0) / recentRuns.filter((r) => r.avgLatencyMs).length)
      : 0,
  }

  return Response.json({
    today: todayStats,
    metrics,
    recentRuns: recentRuns.slice(0, 20),
  })
}
