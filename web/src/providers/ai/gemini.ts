import { GoogleGenerativeAI } from "@google/generative-ai"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createGeminiProvider(config?: {
  apiKey?: string
  model?: string
}): AIProvider {
  const apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY ?? ""
  const genAI = new GoogleGenerativeAI(apiKey)

  const modelName = config?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash"

  const prompt = `You are a technical analyst. Analyze this content.

Source: {source}
Title: {title}
Author: {owner}
Description: {description}
Language/Tags: {language}

Return ONLY a valid JSON object (no markdown, no backticks) with exactly these fields:
- summary: A one-sentence Chinese summary of what this is about (string)
- techTags: 2-4 topic or technical tags (array of strings)
- whyMatters: One sentence in Chinese explaining why this content deserves attention (string)
- worthDeepDive: Whether it's worth reading/investigating deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `gemini:${modelName}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const model = genAI.getGenerativeModel({ model: modelName })

      const result = await model.generateContent(
        prompt
          .replace("{source}", item.source ?? "unknown")
          .replace("{title}", item.name)
          .replace("{owner}", item.owner || "unknown")
          .replace("{description}", item.description ?? "No description")
          .replace("{language}", item.language ?? "Unknown")
      )

      const text = result.response.text()
      const parsed = JSON.parse(text)

      return {
        summary: parsed.summary,
        techTags: parsed.techTags,
        whyMatters: parsed.whyMatters,
        worthDeepDive: parsed.worthDeepDive,
        deepDiveReason: parsed.deepDiveReason ?? null,
      }
    },
  }
}
