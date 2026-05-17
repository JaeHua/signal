import { SourceProvider, SignalItem } from "./types"

export function createHackerNewsProvider(): SourceProvider {
  const HN_BASE = "https://hacker-news.firebaseio.com/v0"

  async function fetchItem(id: number): Promise<SignalItem | null> {
    try {
      const res = await fetch(`${HN_BASE}/item/${id}.json`)
      if (!res.ok) return null
      const item = await res.json()
      if (!item || item.type !== "story") return null
      if (item.dead || item.deleted) return null

      return {
        source: "hackernews",
        sourceId: String(item.id),
        title: item.title ?? "Untitled",
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        description: null,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
        metadata: {
          score: item.score ?? 0,
          comments: item.descendants ?? 0,
          author: item.by ?? "unknown",
        },
        rank: 0,
      }
    } catch {
      return null
    }
  }

  return {
    name: "hackernews",
    async fetchItems(maxItems: number): Promise<SignalItem[]> {
      const res = await fetch(`${HN_BASE}/topstories.json`)
      if (!res.ok) throw new Error(`Failed to fetch HN top stories: ${res.status}`)
      const ids: number[] = await res.json()
      const topIds = ids.slice(0, Math.min(maxItems * 2, 50))

      const results = await Promise.all(topIds.map(fetchItem))
      const items = results.filter(Boolean) as SignalItem[]
      return items.slice(0, maxItems).map((item, i) => ({ ...item, rank: i + 1 }))
    },
  }
}
