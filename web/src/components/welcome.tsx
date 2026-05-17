import { Zap, Sparkles, Globe, Newspaper } from "lucide-react"

export function WelcomeEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-muted-bg flex items-center justify-center mb-6">
        <Zap className="h-8 w-8 text-accent" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">欢迎使用 Signal</h2>
      <p className="text-sm text-muted mb-8 max-w-sm">AI 驱动的信息筛选与理解工具</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mb-8">
        {[
          { icon: Globe, title: "GitHub Trending", desc: "热门开源项目，AI 摘要+深度分析" },
          { icon: Newspaper, title: "Hacker News", desc: "技术讨论精选，自动筛选值得关注的" },
          { icon: Sparkles, title: "搜索与收藏", desc: "语义搜索找到你要的任何信息" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-card border border-border rounded-xl p-4 text-left">
            <Icon className="h-5 w-5 text-accent mb-2" />
            <div className="text-xs font-medium text-foreground mb-0.5">{title}</div>
            <div className="text-[11px] text-muted leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">等待首次数据抓取完成，或点击右上角刷新手动触发</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted mb-3" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
