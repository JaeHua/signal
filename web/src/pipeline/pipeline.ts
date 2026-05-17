import { prisma } from "@/lib/prisma"
import { createSourceProvider } from "@/providers/source"
import { createAIProvider, type AIProviderType } from "@/providers/ai"
import { seedDefaults } from "@/lib/seed"

let isRunning = false

export function isPipelineRunning(): boolean {
  return isRunning
}

async function getRetentionDays(): Promise<number> {
  const config = await prisma.appConfig.findUnique({ where: { id: "retention_days" } })
  return config ? parseInt(config.value, 10) || 7 : 7
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

async function upsertDailyMetrics(source: string, date: Date, stats: {
  scraped: number; processed: number; skipped: number; errors: number
  totalTokens: number; totalDurationMs: number; status: string
}) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const existing = await prisma.dailyMetrics.findUnique({
    where: { date_source: { date: day, source } },
  })

  const isSuccess = stats.status === "success" || stats.status === "partial"
  const data = {
    date: day,
    source,
    totalRuns: (existing?.totalRuns ?? 0) + 1,
    successRuns: (existing?.successRuns ?? 0) + (isSuccess ? 1 : 0),
    totalScraped: (existing?.totalScraped ?? 0) + stats.scraped,
    totalProcessed: (existing?.totalProcessed ?? 0) + stats.processed,
    totalErrors: (existing?.totalErrors ?? 0) + stats.errors,
    totalTokens: (existing?.totalTokens ?? 0) + stats.totalTokens,
    totalDurationMs: (existing?.totalDurationMs ?? 0) + stats.totalDurationMs,
    estimatedCost: ((existing?.totalTokens ?? 0) + stats.totalTokens) / 1_000_000 * 0.5,
  }

  await prisma.dailyMetrics.upsert({
    where: { date_source: { date: day, source } },
    create: data,
    update: data,
  })
}

async function runSourcePipeline(sourceKey: string): Promise<void> {
  const config = await prisma.sourceConfig.findUnique({ where: { key: sourceKey } })
  if (!config?.enabled) {
    console.log(`[Pipeline] Source "${sourceKey}" is disabled, skipping`)
    return
  }

  const runStartTime = Date.now()

  const run = await prisma.pipelineRun.create({
    data: { source: sourceKey, status: "running", startedAt: new Date() },
  })

  let scraped = 0
  let processed = 0
  let skipped = 0
  let errors = 0
  let totalTokens = 0
  const processingTimes: number[] = []
  const errorMessages: string[] = []

  try {
    const sourceProvider = createSourceProvider(sourceKey)
    const items = await sourceProvider.fetchItems(config.maxItems)
    scraped = items.length

    const aiConfig = await prisma.aIConfig.findFirst({ where: { isActive: true } })
    if (!aiConfig) {
      throw new Error("No active AI config found")
    }

    const aiProvider = createAIProvider(aiConfig.provider as AIProviderType)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const item of items) {
      const itemStart = Date.now()
      try {
        const signal = await prisma.signal.upsert({
          where: { source_sourceId: { source: item.source, sourceId: item.sourceId } },
          create: {
            source: item.source, sourceId: item.sourceId, title: item.title, url: item.url,
            description: item.description, metadata: JSON.stringify(item.metadata),
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            trendingDate: new Date(), trendingRank: item.rank,
          },
          update: {
            title: item.title, description: item.description,
            metadata: JSON.stringify(item.metadata), trendingDate: new Date(), trendingRank: item.rank,
          },
        })

        const existingSummary = await prisma.signalSummary.findFirst({
          where: { signalId: signal.id, summaryDate: { gte: today } },
        })

        if (existingSummary) {
          skipped++
          continue
        }

        const aiItem = {
          name: item.title,
          owner: (item.metadata.author as string) ?? (item.metadata.language as string) ?? "",
          repo: item.source === "github" ? item.sourceId : "",
          description: item.description,
          language: (item.metadata.language as string) ?? null,
          source: item.source,
        }

        const summary = await aiProvider.generateSummary(aiItem)
        const itemTokens = estimateTokens(JSON.stringify(aiItem) + JSON.stringify(summary))
        totalTokens += itemTokens

        processingTimes.push(Date.now() - itemStart)

        let embedding: number[] | null = null
        try {
          const embedText = `${item.title}. ${item.description ?? ""}`.trim()
          const { generateEmbedding } = await import("@/lib/embedding")
          embedding = await generateEmbedding(embedText)
        } catch (error) {
          console.error(`[Pipeline] Embedding failed for ${item.title}:`, error)
        }

        await prisma.signalSummary.create({
          data: {
            signalId: signal.id, summaryDate: new Date(),
            aiSummary: summary.summary, techTags: JSON.stringify(summary.techTags),
            whyMatters: summary.whyMatters, worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason, provider: aiProvider.name,
            embedding: embedding ? JSON.stringify(embedding) : null,
          },
        })

        processed++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[Pipeline] Failed to process ${item.title}:`, message)
        errorMessages.push(`${item.title}: ${message}`)
        errors++
      }
    }

    const retentionDays = await getRetentionDays()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)
    await prisma.signalSummary.deleteMany({ where: { summaryDate: { lt: cutoff } } })
    await prisma.pipelineRun.deleteMany({ where: { startedAt: { lt: cutoff } } })
    await prisma.dailyMetrics.deleteMany({ where: { date: { lt: cutoff } } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessages.push(message)
  }

  const totalDurationMs = Date.now() - runStartTime
  const avgLatencyMs = processingTimes.length > 0
    ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
    : 0

  const status = errors > 0 ? (scraped > 0 ? "partial" : "failed") : "success"

  await prisma.pipelineRun.update({
    where: { id: run.id },
    data: {
      status, scraped, processed, skipped, errors,
      totalDurationMs, totalTokens, avgLatencyMs,
      errorLog: errorMessages.length > 0 ? JSON.stringify(errorMessages) : null,
      finishedAt: new Date(),
    },
  })

  await upsertDailyMetrics(sourceKey, new Date(), {
    scraped, processed, skipped, errors, totalTokens, totalDurationMs, status,
  })
}

export async function runPipeline(): Promise<void> {
  if (isRunning) return
  isRunning = true
  try {
    await seedDefaults()
    const configs = await prisma.sourceConfig.findMany({ where: { enabled: true } })
    for (const config of configs) {
      await runSourcePipeline(config.key)
    }
  } finally {
    isRunning = false
  }
}
