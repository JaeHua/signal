import { prisma } from "@/lib/prisma"

export async function GET() {
  const runs = await prisma.pipelineRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  })

  return Response.json({ items: runs })
}
