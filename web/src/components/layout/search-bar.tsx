"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface RepoItem {
  id: string
  name: string
  techTags?: string[]
  aiSummary?: string
}

interface SearchBarProps {
  items: RepoItem[]
}

export function SearchBar({ items }: SearchBarProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-muted text-xs w-48 justify-start"
      >
        <Search className="h-3.5 w-3.5" />
        <span>搜索项目...</span>
        <kbd className="ml-auto text-[10px] text-muted bg-muted-bg px-1 rounded">⌘K</kbd>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目..."
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted"
            />
            <kbd className="text-[10px] text-muted bg-muted-bg px-1.5 py-0.5 rounded">esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 && query && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                未找到匹配的项目
              </div>
            )}
            {filtered.length === 0 && !query && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                输入项目名称搜索
              </div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  router.push(`/repo/${item.id}`)
                  setOpen(false)
                  setQuery("")
                }}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted-bg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                  {item.aiSummary && (
                    <div className="text-xs text-muted mt-0.5 line-clamp-1">{item.aiSummary}</div>
                  )}
                </div>
                {item.techTags && item.techTags.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    {item.techTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted-bg text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
