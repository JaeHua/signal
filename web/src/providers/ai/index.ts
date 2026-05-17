import { AIProvider } from "./types"
import { createOpenAIProvider } from "./openai"
import { createAnthropicProvider } from "./anthropic"
import { createGeminiProvider } from "./gemini"

export type AIProviderType = "openai" | "deepseek" | "anthropic" | "gemini"

export function createAIProvider(type: AIProviderType): AIProvider {
  switch (type) {
    case "deepseek":
      return createOpenAIProvider({
        baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      })
    case "openai":
      return createOpenAIProvider()
    case "anthropic":
      return createAnthropicProvider()
    case "gemini":
      return createGeminiProvider()
    default:
      throw new Error(`Unknown AI provider: ${type}`)
  }
}

export { type AIProvider, type AISummary, type TrendingItem } from "./types"
