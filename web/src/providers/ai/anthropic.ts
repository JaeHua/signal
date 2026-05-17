import Anthropic from "@anthropic-ai/sdk"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createAnthropicProvider(config?: {
  apiKey?: string
  model?: string
}): AIProvider {
  const client = new Anthropic({
    apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
  })

  const model = config?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest"

  const prompt = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return ONLY a JSON object (no markdown, no backticks) with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `anthropic:${model}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const response = await client.messages.create({
        model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
              .replace("{name}", `${item.owner}/${item.repo}`)
              .replace("{description}", item.description ?? "No description")
              .replace("{language}", item.language ?? "Unknown"),
          },
        ],
      })

      const block = response.content[0]
      const text = block?.type === "text" ? block.text : ""
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
