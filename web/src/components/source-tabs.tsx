"use client"

import { cn } from "@/lib/utils"

interface Tab {
  key: string
  label: string
}

interface SourceTabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export function SourceTabs({ tabs, active, onChange }: SourceTabsProps) {
  return (
    <div className="flex gap-1 p-0.5 bg-muted-bg rounded-lg w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            active === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
