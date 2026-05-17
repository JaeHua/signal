import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const saved = await prisma.savedRepo.findMany({
    where: { userId: session.user.id },
    include: {
      repo: {
        include: {
          summaries: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = saved.map((s) => {
    const summary = s.repo.summaries[0] ?? null
    return {
      id: s.repo.id,
      name: s.repo.name,
      owner: s.repo.owner,
      repo: s.repo.repo,
      url: s.repo.url,
      description: s.repo.description,
      language: s.repo.language,
      stars: s.repo.stars,
      forks: s.repo.forks,
      savedAt: s.createdAt,
      summary: summary
        ? {
            aiSummary: summary.aiSummary,
            techTags: JSON.parse(summary.techTags),
            whyMatters: summary.whyMatters,
            worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason,
          }
        : null,
    }
  })

  return Response.json({ items })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { repoId } = await request.json()

  if (!repoId) {
    return Response.json({ error: "repoId is required" }, { status: 400 })
  }

  const repo = await prisma.repo.findUnique({ where: { id: repoId } })
  if (!repo) {
    return Response.json({ error: "Repo not found" }, { status: 404 })
  }

  const saved = await prisma.savedRepo.upsert({
    where: {
      userId_repoId: {
        userId: session.user.id,
        repoId,
      },
    },
    create: {
      userId: session.user.id,
      repoId,
    },
    update: {},
  })

  return Response.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { repoId } = await request.json()

  if (!repoId) {
    return Response.json({ error: "repoId is required" }, { status: 400 })
  }

  await prisma.savedRepo.deleteMany({
    where: {
      userId: session.user.id,
      repoId,
    },
  })

  return Response.json({ saved: false })
}
