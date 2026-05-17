"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "@/components/source-badge"
import { ShareCard } from "@/components/share-card"
import { useSession } from "next-auth/react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function SignalDetail() {
  const params = useParams()
  const id = params.id as string
  const { data: session } = useSession()
  const { data, isLoading } = useSWR(`/api/signals/${id}`, fetcher)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!session?.user) { alert("请先登录"); return }
    setSaving(true)
    const method = saved ? "DELETE" : "POST"
    await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalId: id }),
    })
    setSaved(!saved)
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-muted-bg rounded" />
            <div className="h-8 w-64 bg-muted-bg rounded" />
            <div className="h-4 w-full bg-muted-bg rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 text-center">
          <p className="text-muted">项目未找到</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />返回
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "已收藏" : "收藏"}
            </Button>
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
            <ShareCard
              source={data.source}
              title={data.title}
              metadata={data.metadata}
              summary={data.summary}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <SourceBadge source={data.source} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-4">{data.title}</h1>

        {data.metadata && (
          <div className="flex items-center gap-4 text-sm text-muted mb-8">
            {data.metadata.stars != null && <span>⭐ {data.metadata.stars.toLocaleString()}</span>}
            {data.metadata.score != null && <span>▲ {data.metadata.score}</span>}
            {data.metadata.comments != null && <span>💬 {data.metadata.comments}</span>}
            {data.metadata.author && <span>by {data.metadata.author}</span>}
          </div>
        )}

        {data.summary ? (
          <>
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">项目简介</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">{data.summary.aiSummary}</p>
            </section>
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">值得关注的原因</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">{data.summary.whyMatters}</p>
            </section>
            {data.summary.worthDeepDive && data.summary.deepDiveReason && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">是否值得深入研究</h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent mb-2">值得深入研究</span>
                <p className="text-sm text-foreground/80 leading-relaxed">{data.summary.deepDiveReason}</p>
              </section>
            )}
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">技术标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.summary.techTags.map((tag: string) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-md bg-muted-bg text-muted font-medium">{tag}</span>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-muted">暂无 AI 分析</p>
        )}
      </main>
    </div>
  )
}
