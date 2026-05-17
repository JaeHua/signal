import cron, { ScheduledTask } from "node-cron"
import { runPipeline } from "./pipeline"
import { prisma } from "@/lib/prisma"

let currentTask: ScheduledTask | null = null

async function getIntervalMinutes(): Promise<number> {
  try {
    const config = await prisma.appConfig.findUnique({ where: { id: "schedule_interval" } })
    return config ? parseInt(config.value, 10) || 60 : 60
  } catch {
    return 60
  }
}

export async function restartScheduler(): Promise<void> {
  if (currentTask) currentTask.stop()

  const minutes = await getIntervalMinutes()
  const cronExpr = minutes < 60 ? `*/${minutes} * * * *` : `0 */${Math.floor(minutes / 60)} * * *`
  
  currentTask = cron.schedule(cronExpr, async () => {
    console.log("[Scheduler] Running pipeline...")
    try { await runPipeline() } catch (error) { console.error("[Scheduler] Pipeline failed:", error) }
  })

  console.log(`[Scheduler] Started (every ${minutes} minutes)`)
}

export function startScheduler(): void {
  restartScheduler()
}
