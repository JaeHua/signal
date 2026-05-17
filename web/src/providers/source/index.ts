import { SourceProvider } from "./types"
import { createGitHubTrendingProvider } from "./github-trending"
import { createHackerNewsProvider } from "./hackernews"

export function createSourceProvider(source: string): SourceProvider {
  switch (source) {
    case "github":
      return createGitHubTrendingProvider()
    case "hackernews":
      return createHackerNewsProvider()
    default:
      throw new Error(`Unknown source: ${source}`)
  }
}

export type { SourceProvider, SignalItem } from "./types"
