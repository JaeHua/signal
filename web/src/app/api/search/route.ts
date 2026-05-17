import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchByEmbedding } from "@/lib/embedding"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const q = sp.get("q") ?? ""
  const source = sp.get("source")
  const days = parseInt(sp.get("days") ?? "30", 10)
  const limit = parseInt(sp.get("limit") ?? "10", 10)

  if (!q.trim()) {
    return Response.json({ items: [] })
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)

  const whereClause: Record<string, unknown> = {
    createdAt: { gte: sinceDate },
  }

  if (source && source !== "all") {
    whereClause.signal = { source }
  }

  const summaries = await prisma.signalSummary.findMany({
    where: whereClause,
    include: { signal: true },
    orderBy: { createdAt: "desc" },
  })

  const results = await searchByEmbedding(
    q,
    summaries.map((s) => ({
      id: s.signal.id,
      signalId: s.signalId,
      title: s.signal.title,
      aiSummary: s.aiSummary,
      techTags: s.techTags,
      embedding: s.embedding,
    }))
  )

  return Response.json({
    items: results.slice(0, limit).map((r) => {
      const summary = summaries.find((s) => s.signalId === r.signalId)
      return {
        id: summary?.signal.id,
        source: summary?.signal.source,
        title: summary?.signal.title,
        summary: { aiSummary: r.aiSummary, techTags: JSON.parse(r.techTags) },
        score: Math.round(r.score * 100),
      }
    }),
  })
}
