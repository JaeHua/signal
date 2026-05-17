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

  const where: Record<string, unknown> = {
    trendingDate: { gte: dayStart, lte: dayEnd },
  }
  if (source && source !== "all") where.source = source

  const signals = await prisma.signal.findMany({
    where,
    include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { trendingRank: "asc" },
  })

  const items = signals.map((s) => {
    const summary = s.summaries[0] ?? null
    return {
      id: s.id, source: s.source, title: s.title, url: s.url,
      metadata: s.metadata ? JSON.parse(s.metadata) : null,
      trendingRank: s.trendingRank,
      summary: summary ? {
        aiSummary: summary.aiSummary,
        techTags: JSON.parse(summary.techTags),
        whyMatters: summary.whyMatters,
        worthDeepDive: summary.worthDeepDive,
        deepDiveReason: summary.deepDiveReason,
      } : null,
    }
  })

  return Response.json({ date, count: items.length, items })
}
