import { SignalCard } from "./signal-card"

interface SignalGridProps {
  items: Array<{
    id: string
    source: string
    title: string
    url?: string
    metadata?: Record<string, unknown> | null
    trendingRank?: number | null
    summary?: {
      aiSummary: string
      techTags: string[]
      whyMatters: string
      worthDeepDive: boolean
      deepDiveReason: string | null
    } | null
  }>
}

export function SignalGrid({ items }: SignalGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <SignalCard key={item.id} {...item} metadata={item.metadata as Record<string, unknown> | null} />
      ))}
    </div>
  )
}
