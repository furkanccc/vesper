export interface NvidiaModel {
  id: string
  owned_by?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export type Effort = "low" | "medium" | "high"

/**
 * One non-streaming chat completion against integrate.api.nvidia.com
 * (OpenAI-compatible) through the Vite proxy.
 */
export async function chatCompletion(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  effort?: Effort
  signal?: AbortSignal
}): Promise<string> {
  const base: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 1024,
    stream: false,
  }

  const send = (body: Record<string, unknown>) =>
    fetch("/nvidia-api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })

  // Reasoning models take `reasoning_effort`; plain models may 400 on it —
  // retry once without it in that case.
  let r = await send(
    opts.effort ? { ...base, reasoning_effort: opts.effort } : base,
  )
  if (!r.ok && (r.status === 400 || r.status === 422) && opts.effort) {
    r = await send(base)
  }

  if (r.status === 401 || r.status === 403) {
    throw new Error("API key geçersiz veya bu modele erişimin yok.")
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "")
    throw new Error(`NVIDIA hatası (${r.status}) ${txt.slice(0, 160)}`)
  }

  const j = (await r.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return j.choices?.[0]?.message?.content?.trim() ?? ""
}

/**
 * List the models this API key can reach, via the Vite proxy to
 * integrate.api.nvidia.com (OpenAI-compatible `/v1/models`).
 */
export async function listModels(apiKey: string): Promise<NvidiaModel[]> {
  const r = await fetch("/nvidia-api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  })
  if (r.status === 401 || r.status === 403) {
    throw new Error("API key geçersiz veya yetkisiz.")
  }
  if (!r.ok) {
    throw new Error(`Model listesi alınamadı (HTTP ${r.status}).`)
  }
  const j = (await r.json()) as { data?: NvidiaModel[] }
  const models = j.data ?? []
  return models
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id))
}
