export interface TrendingItem {
  name: string
  owner: string
  repo: string
  description: string | null
  language: string | null
}

export interface AISummary {
  summary: string
  techTags: string[]
  whyMatters: string
  worthDeepDive: boolean
  deepDiveReason: string | null
}

export interface AIProvider {
  name: string
  generateSummary(item: TrendingItem): Promise<AISummary>
}
