import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const retention = await prisma.appConfig.findUnique({ where: { id: "retention_days" } })
  const schedule = await prisma.appConfig.findUnique({ where: { id: "schedule_interval" } })
  return Response.json({
    retentionDays: retention ? parseInt(retention.value, 10) : 7,
    scheduleInterval: schedule ? parseInt(schedule.value, 10) : 60,
  })
}

export async function POST(request: NextRequest) {
  const { retentionDays, scheduleInterval } = await request.json()
  if (retentionDays != null) {
    await prisma.appConfig.upsert({
      where: { id: "retention_days" },
      create: { id: "retention_days", value: String(retentionDays) },
      update: { value: String(retentionDays) },
    })
  }
  if (scheduleInterval != null) {
    await prisma.appConfig.upsert({
      where: { id: "schedule_interval" },
      create: { id: "schedule_interval", value: String(scheduleInterval) },
      update: { value: String(scheduleInterval) },
    })
    try {
      const { restartScheduler } = await import("@/pipeline/scheduler")
      await restartScheduler()
    } catch {}
  }
  return Response.json({ retentionDays, scheduleInterval })
}
