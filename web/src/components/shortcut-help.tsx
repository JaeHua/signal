"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, Home, Bookmark, History, TrendingUp, RefreshCcw } from "lucide-react"

const shortcuts = [
  { keys: ["⌘", "K"], label: "搜索", icon: Search },
  { keys: ["G", "H"], label: "回到首页", icon: Home },
  { keys: ["?", ""], label: "显示快捷键", icon: null },
  { keys: ["⌘", "↵"], label: "刷新", icon: RefreshCcw },
]

export function useShortcutHelp() {
  const [open, setOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "?" && !(e.metaKey || e.ctrlKey) && !(e.target as HTMLElement).matches("input,textarea")) {
      e.preventDefault()
      setOpen((p) => !p)
    }
    if (e.key === "Escape") setOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return { open, setOpen }
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl p-5 w-80">
        <h3 className="text-sm font-semibold text-foreground mb-4">快捷键</h3>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted">
                {s.icon && <s.icon className="h-3.5 w-3.5" />}
                <span>{s.label}</span>
              </div>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted-bg text-muted font-mono">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[10px] text-muted">按 ? 或 esc 关闭</div>
      </div>
    </div>
  )
}
