import { useEffect, useRef } from "react"
import { GlassPanel } from "@/components/ui/glass-panel"
import type { Turn } from "@/lib/use-conversation"

interface ChatLogProps {
  turns: Turn[]
  /** Live (not yet sent) user words. */
  interim?: string
  thinking?: boolean
  className?: string
}

export function ChatLog({ turns, interim = "", thinking, className }: ChatLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, interim, thinking])

  const empty = turns.length === 0 && !interim

  return (
    <GlassPanel
      className={`flex flex-col overflow-hidden rounded-3xl p-0 ${className ?? ""}`}
    >
      <div className="flex-none border-b border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
        Conversation
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed [scrollbar-width:thin]"
      >
        {empty && (
          <p className="text-white/30">Konuşmaya başla — burada yazışma görünecek.</p>
        )}

        {turns.map((t) => (
          <div key={t.id}>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                t.role === "user" ? "text-cyan-300/80" : "text-violet-300/80"
              }`}
            >
              {t.role === "user" ? "You" : "Vesper"} —
            </span>{" "}
            {t.pending ? (
              <span className="inline-flex gap-1 align-middle">
                <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
              </span>
            ) : (
              <span className="text-white/85">{t.text}</span>
            )}
          </div>
        ))}

        {interim && (
          <div className="opacity-60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
              You —
            </span>{" "}
            <span className="text-white/60">{interim}</span>
          </div>
        )}
      </div>
    </GlassPanel>
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-violet-300/80"
      style={{ animation: `eq-bounce 0.9s ease-in-out ${delay}s infinite` }}
    />
  )
}
