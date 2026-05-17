import OpenAI from "openai"
import { AIProvider, AISummary, TrendingItem } from "./types"

export function createOpenAIProvider(config?: {
  baseURL?: string
  apiKey?: string
  model?: string
}): AIProvider {
  const client = new OpenAI({
    baseURL: config?.baseURL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
  })

  const model = config?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini"

  const prompt = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return a JSON object with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`

  return {
    name: `openai:${model}`,
    async generateSummary(item: TrendingItem): Promise<AISummary> {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: prompt
              .replace("{name}", `${item.owner}/${item.repo}`)
              .replace("{description}", item.description ?? "No description")
              .replace("{language}", item.language ?? "Unknown"),
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      })

      const text = response.choices[0]?.message?.content ?? ""
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
