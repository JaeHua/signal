"use client"

import Link from "next/link"
import { Zap } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"

const navLinks = [
  { href: "/history", label: "日志" },
  { href: "/settings", label: "设置" },
]

interface HeaderProps {
  searchItems?: Array<{ id: string; name: string; techTags?: string[]; aiSummary?: string }>
}

export function Header({ searchItems = [] }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-12 sm:h-14 max-w-7xl items-center gap-2 sm:gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-foreground font-bold text-base tracking-tight">
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
          Signal
        </Link>
        <div className="flex-1" />
        <SearchBar items={searchItems} />
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className="hidden sm:block text-sm font-medium text-muted hover:text-foreground transition-colors">
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
