"use client"

import { useCallback, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { Download, Copy, Share2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "@/components/source-badge"

interface ShareCardProps {
  source: string
  title: string
  metadata?: Record<string, unknown> | null
  summary?: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
  } | null
}

export function ShareCard({ source, title, metadata, summary }: ShareCardProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const getMetric = () => {
    const m = metadata
    if (m?.stars != null) return `⭐ ${(m.stars as number).toLocaleString()}`
    if (m?.score != null) return `▲ ${m.score} · 💬 ${m.comments ?? 0}`
    return ""
  }

  const handleCopyImage = useCallback(async () => {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      })
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: download
    }
  }, [])

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return
    const dataUrl = await toPng(cardRef.current, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    })
    const link = document.createElement("a")
    link.download = `signal-${title.replace(/[^a-zA-Z0-9]/g, "-")}.png`
    link.href = dataUrl
    link.click()
  }, [title])

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">分享</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl p-6 max-w-lg w-[calc(100vw-2rem)]">
            <h3 className="text-sm font-semibold text-foreground mb-4">分享卡片</h3>

            <div ref={cardRef} className="bg-white rounded-xl border border-zinc-200 p-5 mb-4" style={{ width: 600, maxWidth: "100%" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-black flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">S</span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">Signal</span>
                </div>
                <SourceBadge source={source} />
              </div>

              <h2 className="text-lg font-semibold text-zinc-900 mb-2 leading-tight">{title}</h2>

              {getMetric() && (
                <div className="text-sm text-zinc-500 mb-3">{getMetric()}</div>
              )}

              {summary && (
                <>
                  <p className="text-sm text-zinc-700 leading-relaxed mb-3">{summary.aiSummary}</p>
                  <p className="text-xs text-zinc-500 mb-3">{summary.whyMatters}</p>
                  {summary.techTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {summary.techTags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-medium">{t}</span>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="text-[10px] text-zinc-300 mt-3 pt-3 border-t border-zinc-100">
                Signal · {new Date().toLocaleDateString("zh-CN")}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyImage} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "已复制" : "复制图片"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                下载 PNG
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
