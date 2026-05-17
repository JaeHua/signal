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
