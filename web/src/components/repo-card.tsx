"use client"

import Link from "next/link"
import { Star, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RepoCardProps {
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
  savedAt?: string | null
  onUnsave?: () => void
}

export function RepoCard({
  id,
  name,
  owner,
  stars,
  summary,
  trendingRank,
}: RepoCardProps) {
  return (
    <Link
      href={`/repo/${id}`}
      className={cn(
        "group flex flex-col gap-3 p-5 rounded-2xl",
        "bg-card border border-border",
        "hover:border-foreground/10 transition-colors duration-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {trendingRank && (
              <span className="text-[11px] font-medium text-muted tabular-nums">
                #{trendingRank}
              </span>
            )}
            <h3 className="text-sm font-medium text-foreground truncate">{name}</h3>
          </div>
        </div>
        {stars != null && (
          <div className="flex items-center gap-1 text-xs text-muted flex-shrink-0">
            <Star className="h-3 w-3" />
            <span className="tabular-nums">
              {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
            </span>
          </div>
        )}
      </div>

      {summary && (
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
          {summary.aiSummary}
        </p>
      )}

      {summary?.techTags && summary.techTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.techTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-md bg-muted-bg text-muted font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-muted">
          {summary?.whyMatters}
        </span>
        {summary?.worthDeepDive && (
          <span className="flex items-center gap-1 text-[11px] text-accent font-medium flex-shrink-0">
            深入研究
            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </span>
        )}
      </div>
    </Link>
  )
}
