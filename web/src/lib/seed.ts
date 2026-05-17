import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export async function seedDefaults() {
  const existing = await prisma.sourceConfig.findFirst({ where: { key: "github" } })
  if (!existing) {
    await prisma.sourceConfig.create({
      data: { key: "github", enabled: true, maxItems: 10, frequency: "6h" },
    })
  }

  const existingHN = await prisma.sourceConfig.findFirst({ where: { key: "hackernews" } })
  if (!existingHN) {
    await prisma.sourceConfig.create({
      data: { key: "hackernews", enabled: true, maxItems: 10, frequency: "6h" },
    })
  }

  const existingAI = await prisma.aIConfig.findFirst({ where: { isActive: true } })
  if (!existingAI) {
    await prisma.aIConfig.create({
      data: {
        provider: process.env.AI_PROVIDER ?? "deepseek",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        apiKey: encrypt(process.env.DEEPSEEK_API_KEY ?? ""),
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        isActive: true,
      },
    })
  }
}
