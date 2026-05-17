import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface TrendingItem {
  id: string
  name: string
  owner: string
  repo: string
  description: string | null
  language: string | null
  stars: number | null
  forks: number | null
  trendingRank: number | null
  summary: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

interface TrendingResponse {
  count: number
  date: string
  items: TrendingItem[]
}

export function useTrending(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR<TrendingResponse>(
    `/api/trending?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  )

  return {
    items: data?.items ?? [],
    date: data?.date ?? null,
    isLoading,
    isError: error,
    mutate,
  }
}
