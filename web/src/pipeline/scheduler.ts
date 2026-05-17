import cron from "node-cron"
import { runPipeline } from "./pipeline"

export function startScheduler(): void {
  cron.schedule("0 */6 * * *", async () => {
    console.log("[Scheduler] Running pipeline...")

    try {
      const result = await runPipeline()
      console.log(`[Scheduler] Pipeline complete: ${result.scraped} scraped, ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors`)
    } catch (error) {
      console.error("[Scheduler] Pipeline failed:", error)
    }
  })

  setTimeout(async () => {
    console.log("[Scheduler] Running initial pipeline on startup...")

    try {
      const result = await runPipeline()
      console.log(`[Scheduler] Initial pipeline complete: ${result.scraped} scraped, ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors`)
    } catch (error) {
      console.error("[Scheduler] Initial pipeline failed:", error)
    }
  }, 5000)

  console.log("[Scheduler] Started (every 6 hours)")
}
