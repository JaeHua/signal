export interface SignalItem {
  source: string
  sourceId: string
  title: string
  url: string
  description: string | null
  publishedAt: string | null
  metadata: Record<string, unknown>
  rank: number
}

export interface SourceProvider {
  name: string
  fetchItems(maxItems: number): Promise<SignalItem[]>
}
