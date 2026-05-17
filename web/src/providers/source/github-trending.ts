import * as cheerio from "cheerio"
import { SourceProvider, SignalItem } from "./types"

export function createGitHubTrendingProvider(config?: {
  language?: string
  since?: "daily" | "weekly" | "monthly"
}): SourceProvider {
  const language = config?.language ?? ""
  const since = config?.since ?? "daily"

  return {
    name: "github",
    async fetchItems(maxItems: number): Promise<SignalItem[]> {
      const langPath = language ? `/${language}` : ""
      const url = `https://github.com/trending${langPath}?since=${since}`

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/1.0)" },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const items: SignalItem[] = []

      try {
        $("article.Box-row").each((index, element) => {
          if (items.length >= maxItems) return

          const $el = $(element)
          const fullName = $el.find("h2 a").text().trim().replace(/\s+/g, "")
          const [owner, repo] = fullName.split("/")
          const urlPath = $el.find("h2 a").attr("href") ?? ""
          const description = $el.find("p").text().trim() || null
          const language = $el.find("[itemprop='programmingLanguage']").text().trim() || null

          const starsStr = $el.find("a[href$='/stargazers']").text().trim()
          const forksStr = $el.find("a[href$='/forks']").text().trim()

          const stars = starsStr ? parseInt(starsStr.replace(/,/g, ""), 10) || null : null
          const forks = forksStr ? parseInt(forksStr.replace(/,/g, ""), 10) || null : null

          if (owner && repo) {
            const sourceId = `${owner}/${repo}`
            items.push({
              source: "github",
              sourceId,
              title: sourceId,
              url: `https://github.com${urlPath}`,
              description,
              publishedAt: null,
              metadata: { stars: stars ?? 0, forks: forks ?? 0, language: language ?? "Unknown" },
              rank: index + 1,
            })
          }
        })
      } catch (error) {
        console.error("Failed to parse trending HTML:", error)
      }

      return items
    },
  }
}
