"use client"

import Link from "next/link"
import { Zap } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"

interface HeaderProps {
  searchItems?: Array<{ id: string; name: string; techTags?: string[]; aiSummary?: string }>
}

export function Header({ searchItems = [] }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-foreground font-semibold text-sm tracking-tight">
          <Zap className="h-4 w-4 text-accent" />
          Signal
        </Link>
        <div className="flex-1" />
        <SearchBar items={searchItems} />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
