import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Signal",
  description: "AI-powered GitHub trending insights",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
