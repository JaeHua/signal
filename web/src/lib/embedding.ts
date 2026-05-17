function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY!
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "deepseek-chat", input: text }),
  })

  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`)
  const data = await res.json()
  return (data.data?.[0]?.embedding ?? []).slice(0, 768)
}

export async function searchByEmbedding(
  query: string,
  summaries: Array<{
    id: string
    signalId: string
    aiSummary: string
    techTags: string
    embedding: string | null
  }>
) {
  const queryEmb = await generateEmbedding(query)

  const results = summaries
    .filter((s) => s.embedding)
    .map((s) => {
      const emb = JSON.parse(s.embedding!)
      const score = cosineSimilarity(queryEmb, emb)
      return { ...s, score }
    })
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score)

  return results
}
