import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const signal = await prisma.signal.findUnique({
    where: { id },
    include: {
      summaries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!signal) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const summary = signal.summaries[0] ?? null

  return Response.json({
    id: signal.id,
    source: signal.source,
    title: signal.title,
    url: signal.url,
    description: signal.description,
    metadata: signal.metadata ? JSON.parse(signal.metadata) : null,
    trendingRank: signal.trendingRank,
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
  })
}
