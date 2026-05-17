export interface TrendingItem {
  name: string
  owner: string
  repo: string
  url: string
  description: string | null
  language: string | null
  stars: number | null
  forks: number | null
  rank: number
}

export interface SourceProvider {
  name: string
  fetchTrending(): Promise<TrendingItem[]>
}
