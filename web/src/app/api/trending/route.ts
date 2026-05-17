import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") ?? "10", 10)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const repos = await prisma.repo.findMany({
    where: {
      trendingDate: { gte: today },
    },
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

  const items = repos.map((repo) => {
    const summary = repo.summaries[0] ?? null
    return {
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      repo: repo.repo,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      forks: repo.forks,
      trendingRank: repo.trendingRank,
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

  return Response.json({
    count: items.length,
    date: today.toISOString(),
    items,
  })
}
