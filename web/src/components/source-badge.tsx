import { cn } from "@/lib/utils"

const sourceBadges: Record<string, { label: string; className: string }> = {
  github: { label: "GitHub", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  hackernews: { label: "HN", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
}

export function SourceBadge({ source }: { source: string }) {
  const badge = sourceBadges[source] ?? { label: source, className: "bg-muted-bg text-muted" }
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0", badge.className)}>
      {badge.label}
    </span>
  )
}
