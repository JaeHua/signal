import * as cheerio from "cheerio"
import { SourceProvider, TrendingItem } from "./types"

export function createGitHubTrendingProvider(config?: {
  language?: string
  since?: "daily" | "weekly" | "monthly"
}): SourceProvider {
  const language = config?.language ?? ""
  const since = config?.since ?? "daily"

  return {
    name: "github-trending",
    async fetchTrending(): Promise<TrendingItem[]> {
      const langPath = language ? `/${language}` : ""
      const url = `https://github.com/trending${langPath}?since=${since}`

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SignalBot/1.0)",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const items: TrendingItem[] = []

      try {
        $("article.Box-row").each((index, element) => {
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
            items.push({
              name: fullName,
              owner,
              repo,
              url: `https://github.com${urlPath}`,
              description,
              language,
              stars,
              forks,
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
