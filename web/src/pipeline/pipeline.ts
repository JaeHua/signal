import { prisma } from "@/lib/prisma"
import { createSourceProvider } from "@/providers/source"
import { createAIProvider, type AIProviderType } from "@/providers/ai"

let isRunning = false

export function isPipelineRunning(): boolean {
  return isRunning
}

export async function runPipeline(): Promise<{
  scraped: number
  processed: number
  skipped: number
  errors: number
}> {
  if (isRunning) {
    return { scraped: 0, processed: 0, skipped: 0, errors: 0 }
  }

  isRunning = true
  let scraped = 0
  let processed = 0
  let skipped = 0
  let errors = 0

  try {
    const providerType = (process.env.AI_PROVIDER ?? "deepseek") as AIProviderType
    const maxItems = parseInt(process.env.TRENDING_COUNT ?? "10", 10)
    const aiProvider = createAIProvider(providerType)

    const sourceProvider = createSourceProvider()

    const items = await sourceProvider.fetchTrending()
    const toProcess = items.slice(0, maxItems)
    scraped = toProcess.length

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const item of toProcess) {
      try {
        const repo = await prisma.repo.upsert({
          where: { name: item.name },
          create: {
            name: item.name,
            owner: item.owner,
            repo: item.repo,
            url: item.url,
            description: item.description,
            language: item.language,
            stars: item.stars,
            forks: item.forks,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
          update: {
            description: item.description,
            language: item.language,
            stars: item.stars,
            forks: item.forks,
            trendingDate: new Date(),
            trendingRank: item.rank,
          },
        })

        const existingSummary = await prisma.repoSummary.findFirst({
          where: {
            repoId: repo.id,
            summaryDate: { gte: today },
          },
        })

        if (existingSummary) {
          skipped++
          continue
        }

        const summary = await aiProvider.generateSummary(item)

        await prisma.repoSummary.create({
          data: {
            repoId: repo.id,
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
        console.error(`Failed to process ${item.name}:`, error)
        errors++
      }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    await prisma.repoSummary.deleteMany({
      where: { summaryDate: { lt: sevenDaysAgo } },
    })

    return { scraped, processed, skipped, errors }
  } finally {
    isRunning = false
  }
}
