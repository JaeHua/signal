"use client"

import { signIn, useSession } from "next-auth/react"
import { Header } from "@/components/layout/header"
import { RepoGrid } from "@/components/repo-grid"
import { RepoCardSkeleton } from "@/components/skeleton"
import { Button } from "@/components/ui/button"
import { Bookmark } from "lucide-react"
import Link from "next/link"
import { useSaved } from "@/hooks/use-saved"

export default function SavedPage() {
  const { data: session, status } = useSession()
  const { items, isLoading } = useSaved()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="h-8 w-8 text-muted mb-4" />
            <p className="text-muted text-sm mb-4">请先登录以查看收藏</p>
            <Button variant="outline" size="sm" onClick={() => signIn("github")}>
              使用 GitHub 登录
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">我的收藏</h1>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="h-8 w-8 text-muted mb-4" />
            <p className="text-muted text-sm mb-4">还没有收藏项目</p>
            <Link href="/">
              <Button variant="outline" size="sm">
                去 Dashboard 看看吧
              </Button>
            </Link>
          </div>
        ) : (
          <RepoGrid items={items} />
        )}
      </main>
    </div>
  )
}
