import { prisma } from "@/lib/prisma"
import { createSourceProvider } from "@/providers/source"
import { createAIProvider, type AIProviderType } from "@/providers/ai"
import { decrypt } from "@/lib/encryption"
import { seedDefaults } from "@/lib/seed"

let isRunning = false

export function isPipelineRunning(): boolean {
  return isRunning
}

async function runSourcePipeline(sourceKey: string): Promise<void> {
  const config = await prisma.sourceConfig.findUnique({ where: { key: sourceKey } })
  if (!config?.enabled) {
    console.log(`[Pipeline] Source "${sourceKey}" is disabled, skipping`)
    return
  }

  const run = await prisma.pipelineRun.create({
    data: { source: sourceKey, status: "running", startedAt: new Date() },
  })

  let scraped = 0
  let processed = 0
  let skipped = 0
  let errors = 0
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
      try {
        const signal = await prisma.signal.upsert({
          where: { source_sourceId: { source: item.source, sourceId: item.sourceId } },
          create: {
            source: item.source,
            sourceId: item.sourceId,
            title: item.title,
            url: item.url,
            description: item.description,
            metadata: JSON.stringify(item.metadata),
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
          update: {
            title: item.title,
            description: item.description,
            metadata: JSON.stringify(item.metadata),
            trendingDate: new Date(),
            trendingRank: item.rank,
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
          repo: "",
          description: item.description,
          language: (item.metadata.language as string) ?? null,
        }

        const summary = await aiProvider.generateSummary(aiItem)

        await prisma.signalSummary.create({
          data: {
            signalId: signal.id,
            summaryDate: new Date(),
            aiSummary: summary.summary,
            techTags: JSON.stringify(summary.techTags),
            whyMatters: summary.whyMatters,
            worthDeepDive: summary.worthDeepDive,
            deepDiveReason: summary.deepDiveReason,
            provider: aiProvider.name,
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

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    await prisma.signalSummary.deleteMany({
      where: { summaryDate: { lt: sevenDaysAgo } },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessages.push(message)
  }

  await prisma.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: errors > 0 ? (scraped > 0 ? "partial" : "failed") : "success",
      scraped,
      processed,
      skipped,
      errors,
      errorLog: errorMessages.length > 0 ? JSON.stringify(errorMessages) : null,
      finishedAt: new Date(),
    },
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
