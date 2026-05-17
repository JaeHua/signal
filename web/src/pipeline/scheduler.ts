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

  setTimeout(async () => {
    console.log("[Scheduler] Running initial pipeline on startup...")
    try {
      await runPipeline()
      console.log("[Scheduler] Initial pipeline complete")
    } catch (error) {
      console.error("[Scheduler] Initial pipeline failed:", error)
    }
  }, 5000)

  console.log("[Scheduler] Started (every hour)")
}
