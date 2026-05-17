export function SignalCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 bg-muted-bg rounded relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        <div className="h-4 w-12 bg-muted-bg rounded relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted-bg rounded relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        <div className="h-3 w-3/4 bg-muted-bg rounded relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animationDelay: "0.2s" }} />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-muted-bg rounded-md relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animationDelay: "0.4s" }} />
        </div>
        <div className="h-5 w-14 bg-muted-bg rounded-md relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animationDelay: "0.5s" }} />
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SignalCardSkeleton key={i} />
      ))}
    </div>
  )
}
