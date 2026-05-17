import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const sources = await prisma.sourceConfig.findMany()
  return Response.json({ items: sources })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const config = await prisma.sourceConfig.upsert({
    where: { key: body.key },
    create: {
      key: body.key,
      enabled: body.enabled ?? true,
      maxItems: body.maxItems ?? 10,
      frequency: body.frequency ?? "6h",
    },
    update: {
      enabled: body.enabled,
      maxItems: body.maxItems,
      frequency: body.frequency,
    },
  })
  return Response.json(config)
}
