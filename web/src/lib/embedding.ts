function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function textToVector(text: string, dims: number): number[] {
  const vec: number[] = []
  for (let i = 0; i < dims; i++) {
    let hash = 0
    for (let j = 0; j < text.length; j++) {
      hash = ((hash << 5) - hash + text.charCodeAt(j) * (i + 1)) | 0
    }
    vec.push(Math.tanh(hash / 1000000))
  }
  return vec
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"

  if (apiKey) {
    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "deepseek-chat", input: text }),
      })
      if (res.ok) {
        const data = await res.json()
        return (data.data?.[0]?.embedding ?? []).slice(0, 768)
      }
    } catch {}
  }

  return textToVector(text, 256)
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
  if (summaries.length === 0) return []

  const hasEmbeddings = summaries.some((s) => s.embedding)
  const queryEmb = await generateEmbedding(query)

  if (hasEmbeddings) {
    const results = summaries
      .filter((s) => s.embedding)
      .map((s) => {
        const emb = JSON.parse(s.embedding!)
        const smallEmb = emb.slice(0, queryEmb.length)
        const score = cosineSimilarity(queryEmb, smallEmb)
        return { ...s, score }
      })
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
    return results
  }

  const results = summaries.map((s) => {
    const combined = `${s.aiSummary} ${s.techTags}`.toLowerCase()
    const q = query.toLowerCase()
    let score = 0
    if (combined.includes(q)) score = 0.8
    for (const word of q.split(/\s+/)) {
      if (combined.includes(word)) score += 0.1
    }
    return { ...s, score: Math.min(score, 1) }
  })

  return results.filter((s) => s.score > 0.1).sort((a, b) => b.score - a.score)
}
