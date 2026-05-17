"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from "swr"
import { CheckCircle, XCircle } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SettingsPage() {
  const { data: sourcesData, mutate: mutateSources } = useSWR("/api/settings/sources", fetcher)
  const { data: aiData, mutate: mutateAI } = useSWR("/api/settings/ai", fetcher)

  const [aiForm, setAIForm] = useState({
    provider: "deepseek", model: "deepseek-chat", apiKey: "", baseUrl: "",
  })
  const [sources, setSources] = useState<Array<{ key: string; enabled: boolean; maxItems: number }>>([])
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (aiData?.items?.[0]) {
      const c = aiData.items[0]
      setAIForm({ provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl ?? "" })
    }
  }, [aiData])

  useEffect(() => {
    if (sourcesData?.items) setSources(sourcesData.items)
  }, [sourcesData])

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  const saveAI = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      })
      if (res.ok) {
        setStatus({ type: "success", message: "AI 配置已保存" })
        mutateAI()
      } else {
        const err = await res.json()
        setStatus({ type: "error", message: err.error ?? "保存失败" })
      }
    } catch {
      setStatus({ type: "error", message: "网络错误，请重试" })
    }
  }, [aiForm, mutateAI])

  const toggleSource = useCallback(async (key: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/settings/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...updates }),
      })
      if (res.ok) {
        setStatus({ type: "success", message: `${key} 配置已更新` })
        mutateSources()
      } else {
        setStatus({ type: "error", message: "更新失败" })
      }
    } catch {
      setStatus({ type: "error", message: "网络错误，请重试" })
    }
  }, [mutateSources])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-lg font-semibold text-foreground tracking-tight mb-8">设置</h1>

        {status && (
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
            status.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}>
            {status.type === "success"
              ? <CheckCircle className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />
            }
            {status.message}
          </div>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-foreground mb-4">AI 模型</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1">提供商</label>
              <select value={aiForm.provider}
                onChange={(e) => setAIForm({ ...aiForm, provider: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">模型</label>
              <input value={aiForm.model} onChange={(e) => setAIForm({ ...aiForm, model: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">API Key</label>
              <input type="password" value={aiForm.apiKey}
                onChange={(e) => setAIForm({ ...aiForm, apiKey: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Base URL</label>
              <input value={aiForm.baseUrl} onChange={(e) => setAIForm({ ...aiForm, baseUrl: e.target.value })}
                className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <Button size="sm" onClick={saveAI}>保存 AI 配置</Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">信息源</h2>
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.key} className="flex items-center justify-between py-2 border-b border-border">
                <div className="text-sm font-medium text-foreground">{s.key}</div>
                <div className="flex items-center gap-3">
                  <select value={s.maxItems} disabled={!s.enabled}
                    onChange={(e) => toggleSource(s.key, { maxItems: Number(e.target.value), enabled: s.enabled })}
                    className="text-xs bg-transparent border border-border rounded px-2 py-1 text-muted disabled:opacity-30">
                    <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
                  </select>
                  <button onClick={() => toggleSource(s.key, { enabled: !s.enabled, maxItems: s.maxItems })}
                    className={`w-9 h-5 rounded-full transition-colors relative ${s.enabled ? "bg-accent" : "bg-muted-bg"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
