import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const config = await prisma.appConfig.findUnique({ where: { id: "retention_days" } })
  return Response.json({ retentionDays: config ? parseInt(config.value, 10) : 7 })
}

export async function POST(request: NextRequest) {
  const { retentionDays } = await request.json()
  await prisma.appConfig.upsert({
    where: { id: "retention_days" },
    create: { id: "retention_days", value: String(retentionDays) },
    update: { value: String(retentionDays) },
  })
  return Response.json({ retentionDays })
}
