"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Star, GitFork, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function RepoDetail() {
  const params = useParams()
  const id = params.id as string
  const { data: session } = useSession()

  const { data, isLoading } = useSWR(`/api/repo/${id}`, fetcher)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!session?.user) {
      alert("请先登录")
      return
    }
    setSaving(true)
    const method = saved ? "DELETE" : "POST"
    await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: id }),
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
            <div className="h-20 bg-muted-bg rounded-xl" />
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
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "已收藏" : "收藏"}
            </Button>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
          {data.name}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted mb-8">
          {data.stars != null && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {data.stars.toLocaleString()}
            </span>
          )}
          {data.forks != null && (
            <span className="flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5" /> {data.forks.toLocaleString()}
            </span>
          )}
          {data.language && (
            <span>{data.language}</span>
          )}
        </div>

        {data.summary ? (
          <>
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">项目简介</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {data.summary.aiSummary}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">值得关注的原因</h2>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {data.summary.whyMatters}
              </p>
            </section>

            {data.summary.worthDeepDive && data.summary.deepDiveReason && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">是否值得深入研究</h2>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                    值得深入研究
                  </span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {data.summary.deepDiveReason}
                </p>
              </section>
            )}

            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">技术标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.summary.techTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-md bg-muted-bg text-muted font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">项目简介</h2>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {data.description ?? "暂无描述"}
            </p>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">GitHub 信息</h2>
          <div className="bg-muted-bg rounded-xl p-4 text-sm text-foreground/80">
            <p>AI 分析提供方：{data.summary?.provider ?? "N/A"}</p>
          </div>
        </section>
      </main>
    </div>
  )
}
