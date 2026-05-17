import { cn } from "@/lib/utils"

export function RepoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-card border border-border animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-6 bg-muted-bg rounded" />
        <div className="h-4 w-40 bg-muted-bg rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted-bg rounded" />
        <div className="h-3 w-3/4 bg-muted-bg rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-muted-bg rounded-md" />
        <div className="h-5 w-14 bg-muted-bg rounded-md" />
        <div className="h-5 w-10 bg-muted-bg rounded-md" />
      </div>
      <div className="flex justify-between mt-auto pt-1">
        <div className="h-3 w-32 bg-muted-bg rounded" />
        <div className="h-3 w-16 bg-muted-bg rounded" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <RepoCardSkeleton key={i} />
      ))}
    </div>
  )
}
