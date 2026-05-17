import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export async function GET() {
  const configs = await prisma.aIConfig.findMany({ orderBy: { updatedAt: "desc" } })
  return Response.json({
    items: configs.map((c) => ({
      ...c,
      apiKey: "••••••••",
    })),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  await prisma.aIConfig.updateMany({ data: { isActive: false } })

  const config = await prisma.aIConfig.create({
    data: {
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey !== "••••••••" ? encrypt(body.apiKey) : "",
      baseUrl: body.baseUrl ?? null,
      isActive: true,
    },
  })

  return Response.json({ ...config, apiKey: "••••••••" })
}
