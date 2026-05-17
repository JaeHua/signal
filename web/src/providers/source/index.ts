import { SourceProvider } from "./types"
import { createGitHubTrendingProvider } from "./github-trending"

export function createSourceProvider(): SourceProvider {
  return createGitHubTrendingProvider()
}

export type { SourceProvider, TrendingItem } from "./types"
