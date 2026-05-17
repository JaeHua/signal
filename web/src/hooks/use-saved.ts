import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SavedItem {
  id: string
  name: string
  owner: string
  repo: string
  summary: {
    aiSummary: string
    techTags: string[]
    whyMatters: string
    worthDeepDive: boolean
    deepDiveReason: string | null
  } | null
}

export function useSaved() {
  const { data, error, isLoading, mutate } = useSWR<{ items: SavedItem[] }>(
    "/api/saved",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    items: data?.items ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}
