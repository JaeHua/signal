import cron from "node-cron"
import { runPipeline } from "./pipeline"

export function startScheduler(): void {
  cron.schedule("0 */1 * * *", async () => {
    console.log("[Scheduler] Running pipeline...")
    try {
      await runPipeline()
      console.log("[Scheduler] Pipeline complete")
    } catch (error) {
      console.error("[Scheduler] Pipeline failed:", error)
    }
  })

  console.log("[Scheduler] Started (every hour)")
}
