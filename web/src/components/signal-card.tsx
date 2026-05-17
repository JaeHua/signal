"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceBadge } from "./source-badge"

interface SignalCardProps {
  id: string
  source: string
  title: string
  url?: string
  metadata?: {
    stars?: number
    score?: number
    comments?: number
    language?: string
    author?: string
  } | null
  trendingRank?: number | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function SignalCard({
  id,
  source,
  title,
  metadata,
  summary,
  trendingRank,
}: SignalCardProps) {
  const metric = metadata?.stars ?? metadata?.score ?? null

  return (
    <Link
      href={`/signals/${id}`}
      className={cn(
        "group flex flex-col gap-2.5 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl",
        "bg-card border border-border",
        "hover:border-foreground/10 transition-colors duration-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {trendingRank && (
            <span className="text-[11px] font-medium text-muted tabular-nums">#{trendingRank}</span>
          )}
          <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
        </div>
        <SourceBadge source={source} />
      </div>

      {metric != null && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="tabular-nums">{formatCount(metric)}</span>
          {metadata?.comments != null && <span>{formatCount(metadata.comments)} comments</span>}
          {metadata?.author && <span>by {metadata.author}</span>}
        </div>
      )}

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
        <span className="text-xs text-muted line-clamp-1">{summary?.whyMatters}</span>
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
