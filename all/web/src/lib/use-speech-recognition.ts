import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Live speech-to-text via the browser Web Speech API.
 *
 *  - Chrome / Edge / most Chromium browsers support this; Firefox and Opera do
 *    not (Opera exposes the object but it never connects).
 *  - Chrome streams audio to Google's servers for recognition. A fully local /
 *    NVIDIA-Riva pipeline would swap this hook for a WebSocket ASR client; the
 *    return shape stays the same.
 */

export type SpeechStatus = "unsupported" | "connecting" | "listening" | "error"

export interface SpeechRecognitionState {
  supported: boolean
  status: SpeechStatus
  listening: boolean
  finalText: string
  interimText: string
  error: string | null
}

interface Options {
  enabled: boolean
  lang?: string
  maxChars?: number
  /** Ignore everything the mic hears (e.g. while Vesper is speaking). */
  muted?: boolean
  /** Fired once per completed utterance, after a short end-of-speech pause. */
  onUtterance?: (text: string) => void
}

function getImpl(): any {
  if (typeof window === "undefined") return null
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  )
}

export function useSpeechRecognition({
  enabled,
  lang = "tr-TR",
  maxChars = 400,
  muted = false,
  onUtterance,
}: Options): SpeechRecognitionState & { reset: () => void } {
  const Impl = getImpl()
  const supported = !!Impl

  const [status, setStatus] = useState<SpeechStatus>(
    supported ? "connecting" : "unsupported",
  )
  const [finalText, setFinalText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<any>(null)
  const wantOnRef = useRef(false)
  const finalRef = useRef("")
  const restartTimer = useRef<number | undefined>(undefined)

  // live refs so the recognition callbacks don't need to be re-bound
  const mutedRef = useRef(muted)
  const onUtteranceRef = useRef(onUtterance)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])
  useEffect(() => {
    onUtteranceRef.current = onUtterance
  }, [onUtterance])

  // buffer of finalized phrases, flushed after a pause
  const uttBuf = useRef("")
  const uttTimer = useRef<number | undefined>(undefined)
  const flushUtterance = useCallback(() => {
    const t = uttBuf.current.trim()
    uttBuf.current = ""
    if (t && !mutedRef.current) onUtteranceRef.current?.(t)
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ""
    setFinalText("")
    setInterimText("")
  }, [])

  useEffect(() => {
    if (!supported) {
      setStatus("unsupported")
      return
    }
    if (!enabled) {
      wantOnRef.current = false
      recRef.current?.stop()
      setStatus("connecting")
      return
    }

    wantOnRef.current = true
    setStatus("connecting")
    setError(null)

    const rec = new Impl()
    recRef.current = rec
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setStatus("listening")
    rec.onaudiostart = () => setStatus("listening")

    rec.onresult = (event: any) => {
      if (mutedRef.current) return
      let interim = ""
      let appended = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const txt = res[0]?.transcript ?? ""
        if (res.isFinal) appended += txt
        else interim += txt
      }
      if (appended) {
        finalRef.current = (finalRef.current + " " + appended.trim())
          .trim()
          .slice(-maxChars)
        setFinalText(finalRef.current)

        uttBuf.current = (uttBuf.current + " " + appended.trim()).trim()
        window.clearTimeout(uttTimer.current)
        uttTimer.current = window.setTimeout(flushUtterance, 900)
      }
      setInterimText(interim.trim())
    }

    rec.onerror = (event: any) => {
      const e = event?.error
      if (e === "no-speech" || e === "aborted") return
      if (e === "not-allowed" || e === "service-not-allowed") {
        setError("Mikrofon izni reddedildi.")
        setStatus("error")
        wantOnRef.current = false
        return
      }
      if (e === "network") {
        setError("Konuşma tanıma sunucusuna ulaşılamadı (Chrome/Edge gerekli).")
        setStatus("error")
        return
      }
      setError(String(e || "bilinmeyen hata"))
      setStatus("error")
    }

    rec.onend = () => {
      setInterimText("")
      if (wantOnRef.current) {
        restartTimer.current = window.setTimeout(() => {
          try {
            rec.start()
          } catch {
            /* retry on next onend */
          }
        }, 250)
      } else {
        setStatus("connecting")
      }
    }

    try {
      rec.start()
    } catch {
      /* already starting */
    }

    return () => {
      wantOnRef.current = false
      window.clearTimeout(restartTimer.current)
      window.clearTimeout(uttTimer.current)
      rec.onstart = rec.onaudiostart = null
      rec.onresult = rec.onerror = rec.onend = null
      try {
        rec.stop()
      } catch {
        /* noop */
      }
      recRef.current = null
    }
  }, [supported, enabled, lang, maxChars, Impl, flushUtterance])

  return {
    supported,
    status,
    listening: status === "listening",
    finalText,
    interimText,
    error,
    reset,
  }
}
