import { auth } from "@/lib/auth"
import { runPipeline, isPipelineRunning } from "@/pipeline/pipeline"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPipelineRunning()) {
    return Response.json({ status: "already_running" })
  }

  runPipeline().catch(console.error)

  return Response.json({ status: "processing", startedAt: new Date().toISOString() })
}
