import { useCallback, useRef, useState } from "react"
import { chatCompletion, type ChatMessage } from "@/lib/nvidia"
import { cancelSpeech, speak } from "@/lib/tts"
import type { VesperConfig } from "@/lib/config"

export interface Turn {
  id: number
  role: "user" | "assistant"
  text: string
  pending?: boolean
}

const SYSTEM_PROMPT =
  "Senin adın Vesper. Türkçe konuşan, yardımsever bir sesli asistansın. " +
  "Kısa, net ve sohbet havasında cevap ver. Cevapların sesle okunacağı için " +
  "madde işareti, başlık ve kod bloğu kullanma; düz cümlelerle konuş."

export interface ConversationState {
  turns: Turn[]
  thinking: boolean
  speaking: boolean
  error: string | null
  /** True while Vesper is thinking or speaking — mic should be ignored then. */
  busy: boolean
  ask: (text: string) => void
  clear: () => void
}

export function useConversation(config: VesperConfig): ConversationState {
  const [turns, setTurns] = useState<Turn[]>([])
  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idRef = useRef(0)
  const historyRef = useRef<ChatMessage[]>([{ role: "system", content: SYSTEM_PROMPT }])
  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    abortRef.current?.abort()
    cancelSpeech()
    historyRef.current = [{ role: "system", content: SYSTEM_PROMPT }]
    setTurns([])
    setError(null)
    setThinking(false)
    setSpeaking(false)
  }, [])

  const ask = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || thinking || speaking) return

      setError(null)
      const userId = ++idRef.current
      const botId = ++idRef.current
      setTurns((t) => [
        ...t,
        { id: userId, role: "user", text: clean },
        { id: botId, role: "assistant", text: "", pending: true },
      ])
      historyRef.current.push({ role: "user", content: clean })
      setThinking(true)

      const ac = new AbortController()
      abortRef.current = ac

      let reply = ""
      try {
        reply = await chatCompletion({
          apiKey: config.apiKey,
          model: config.model,
          effort: config.effort,
          messages: historyRef.current,
          signal: ac.signal,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setThinking(false)
        setTurns((t) =>
          t.map((x) =>
            x.id === botId
              ? { ...x, text: "(cevap alınamadı)", pending: false }
              : x,
          ),
        )
        return
      }

      setThinking(false)
      if (!reply) reply = "(boş cevap)"
      historyRef.current.push({ role: "assistant", content: reply })
      // keep history bounded: system + last 12 turns
      if (historyRef.current.length > 25) {
        historyRef.current = [
          historyRef.current[0],
          ...historyRef.current.slice(-24),
        ]
      }
      setTurns((t) =>
        t.map((x) => (x.id === botId ? { ...x, text: reply, pending: false } : x)),
      )

      setSpeaking(true)
      await speak(reply, { lang: "tr-TR" })
      setSpeaking(false)
    },
    [config, thinking, speaking],
  )

  return {
    turns,
    thinking,
    speaking,
    error,
    busy: thinking || speaking,
    ask,
    clear,
  }
}
