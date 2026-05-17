import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useSignals(source = "all", limit = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/signals?source=${source}&limit=${limit}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  )
  return {
    items: data?.items ?? [],
    date: data?.date ?? null,
    isLoading,
    isError: error,
    mutate,
  }
}
