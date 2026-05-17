import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const repo = await prisma.repo.findUnique({
    where: { id },
    include: {
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!repo) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const summary = repo.summaries[0] ?? null

  return Response.json({
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
  })
}
