import { RepoCard } from "./repo-card"

interface RepoItem {
  id: string
  name: string
  owner: string
  repo: string
  description?: string | null
  stars?: number | null
  trendingRank?: number | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

interface RepoGridProps {
  items: RepoItem[]
}

export function RepoGrid({ items }: RepoGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <RepoCard key={item.id} {...item} />
      ))}
    </div>
  )
}
