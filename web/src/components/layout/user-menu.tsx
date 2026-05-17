"use client"

import { useState, useRef, useEffect } from "react"
import { LogIn, LogOut, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession, signIn, signOut } from "next-auth/react"
import Link from "next/link"

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted-bg animate-pulse" />
  }

  if (!session?.user) {
    return (
      <Button variant="ghost" size="sm" onClick={() => signIn("github")} className="gap-1.5">
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">登录</span>
      </Button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-full overflow-hidden border border-border hover:opacity-80 transition-opacity"
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted-bg flex items-center justify-center text-xs text-muted font-medium">
            {session.user.name?.charAt(0) ?? "?"}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm font-medium truncate">{session.user.name}</div>
            <div className="text-xs text-muted truncate">{session.user.email}</div>
          </div>
          <Link
            href="/saved"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted-bg transition-colors"
          >
            <Bookmark className="h-4 w-4" />
            我的收藏
          </Link>
          <button
            onClick={() => { signOut(); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted-bg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      )}
    </div>
  )
}
