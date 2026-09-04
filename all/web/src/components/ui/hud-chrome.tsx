import { useEffect, useRef, useState } from "react"
import { GlassPanel } from "@/components/ui/glass-panel"

/** Thin HUD brackets in the four screen corners. */
export function HudCorners() {
  const base = "absolute h-8 w-8 border-white/20"
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-6">
      <span className={`${base} left-0 top-0 border-l-2 border-t-2 rounded-tl-md`} />
      <span className={`${base} right-0 top-0 border-r-2 border-t-2 rounded-tr-md`} />
      <span className={`${base} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md`} />
      <span className={`${base} bottom-0 right-0 border-b-2 border-r-2 rounded-br-md`} />
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  )
}

/** Top-of-screen brand + connection readout. */
export function TopBar() {
  return (
    <header className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between sm:inset-x-8 sm:top-8">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-400/80 to-cyan-300/80 blur-[6px]" />
          <div className="absolute inset-0 grid place-items-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-md">
            <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.7)]" />
          </div>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold uppercase tracking-[0.42em] text-white/90">
            Vesper
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            voice interface
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/60 backdrop-blur-md">
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
        />
        Online
        <span className="mx-1 h-3 w-px bg-white/15" />
        <Clock />
      </div>
    </header>
  )
}

type SpeechStatus = "unsupported" | "connecting" | "listening" | "error"

interface BottomBarProps {
  finalText?: string
  interimText?: string
  status?: SpeechStatus
  error?: string | null
}

/** Bottom strip showing the live speech transcript. */
export function BottomBar({
  finalText = "",
  interimText = "",
  status = "connecting",
  error = null,
}: BottomBarProps) {
  const hasText = Boolean(finalText || interimText)
  const listening = status === "listening"
  const scrollerRef = useRef<HTMLDivElement>(null)

  // keep the newest words in view
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [finalText, interimText])

  const placeholder =
    status === "unsupported"
      ? "Bu tarayıcı konuşma tanımayı desteklemiyor (Chrome / Edge kullan)"
      : status === "error"
        ? error ?? "Konuşma tanıma hatası"
        : status === "listening"
          ? "Dinliyorum… konuşmaya başla"
          : "Bağlanıyor…"

  return (
    <footer className="absolute inset-x-4 bottom-4 flex justify-center sm:inset-x-8 sm:bottom-8">
      <GlassPanel className="flex w-full max-w-5xl items-center gap-4 rounded-2xl px-5 py-3">
        <span className="flex flex-none items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              listening ? "bg-cyan-300" : status === "error" ? "bg-red-400" : "bg-white/25"
            }`}
            style={listening ? { animation: "pulse-dot 1.6s ease-in-out infinite" } : undefined}
          />
          Transcript
        </span>

        <div
          ref={scrollerRef}
          className="relative h-5 flex-1 overflow-x-hidden whitespace-nowrap text-sm [mask-image:linear-gradient(to_right,transparent,black_24px)]"
        >
          {hasText ? (
            <span className="text-white/85">
              {finalText}
              {interimText && (
                <span className="text-white/45"> {interimText}</span>
              )}
              <span
                className="ml-1 inline-block h-4 w-[2px] translate-y-[3px] bg-cyan-200"
                style={{ animation: "caret-blink 1s step-end infinite" }}
              />
            </span>
          ) : (
            <span className="text-white/35">{placeholder}</span>
          )}
        </div>

        <kbd className="flex-none rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-white/55">
          tr-TR
        </kbd>
      </GlassPanel>
    </footer>
  )
}
