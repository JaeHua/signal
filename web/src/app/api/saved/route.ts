import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const saved = await prisma.savedSignal.findMany({
    where: { userId: session.user.id },
    include: {
      signal: {
        include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = saved.map((s) => {
    const summary = s.signal.summaries[0] ?? null
    return {
      id: s.signal.id,
      source: s.signal.source,
      title: s.signal.title,
      url: s.signal.url,
      metadata: s.signal.metadata ? JSON.parse(s.signal.metadata) : null,
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

  const { signalId } = await request.json()

  if (!signalId) {
    return Response.json({ error: "signalId is required" }, { status: 400 })
  }

  await prisma.savedSignal.upsert({
    where: {
      userId_signalId: {
        userId: session.user.id,
        signalId,
      },
    },
    create: { userId: session.user.id, signalId },
    update: {},
  })

  return Response.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { signalId } = await request.json()

  if (!signalId) {
    return Response.json({ error: "signalId is required" }, { status: 400 })
  }

  await prisma.savedSignal.deleteMany({
    where: { userId: session.user.id, signalId },
  })

  return Response.json({ saved: false })
}
