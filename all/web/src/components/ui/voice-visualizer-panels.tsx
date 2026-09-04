import { GlassPanel } from "@/components/ui/glass-panel"

const PANEL = "h-[clamp(320px,46vmin,600px)] p-[clamp(14px,2.2vmin,26px)]"
const LABEL =
  "text-[clamp(9px,1.15vmin,12px)] font-medium uppercase tracking-[0.28em] text-white/50"

const SPECTRUM_BARS = 14
const WAVE_BARS = 22

/** Left side: an animated liquid-glass equalizer column. */
export function EqualizerPanel({ active = true }: { active?: boolean }) {
  return (
    <GlassPanel
      className={`${PANEL} w-[clamp(104px,15vmin,210px)] flex-none`}
      style={{ animation: "glass-float 9s ease-in-out infinite" }}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <span className={LABEL}>Spectrum</span>

        <div className="flex min-h-0 flex-1 items-end justify-center gap-[clamp(3px,0.9vmin,7px)] overflow-hidden">
          {Array.from({ length: SPECTRUM_BARS }).map((_, i) => (
            <span
              key={i}
              className="w-[clamp(3px,0.9vmin,6px)] flex-none rounded-full bg-gradient-to-t from-cyan-300/70 via-violet-300/80 to-white/90"
              style={{
                height: `${34 + Math.abs(Math.sin(i * 1.3 + 0.6)) * 62}%`,
                transformOrigin: "bottom",
                animation: active
                  ? `eq-bounce ${0.9 + (i % 5) * 0.22}s ease-in-out ${i * 0.07}s infinite`
                  : "none",
                opacity: active ? 1 : 0.2,
              }}
            />
          ))}
        </div>

        <span className={`${LABEL} text-white/40`}>48 kHz</span>
      </div>
    </GlassPanel>
  )
}

/** Right side: liquid-glass status readout. */
export function StatusPanel({
  listening = true,
  state,
  model,
  effort,
}: {
  listening?: boolean
  state?: string
  model?: string
  effort?: string
}) {
  const label = state ?? (listening ? "Listening" : "Idle")
  const live = label === "Listening" || label === "Speaking" || label === "Thinking"
  const shortModel = model ? model.split("/").pop() ?? model : "—"
  const rows: [string, string][] = [
    ["Model", shortModel],
    ["Effort", effort ?? "—"],
    ["AEC", "active"],
    ["Noise gate", "10 dB"],
    ["Pitch lock", "on"],
    ["Band", "140–3.8k"],
  ]

  return (
    <GlassPanel
      className={`${PANEL} w-[clamp(150px,20vmin,260px)] flex-none`}
      style={{ animation: "glass-float 9s ease-in-out 1.2s infinite" }}
    >
      <div className="flex h-full flex-col gap-[clamp(14px,3vmin,28px)]">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 flex-none rounded-full ${live ? "bg-cyan-300" : "bg-white/25"}`}
            style={live ? { animation: "pulse-dot 1.8s ease-in-out infinite" } : undefined}
          />
          <span className="text-[clamp(10px,1.25vmin,13px)] font-semibold uppercase tracking-[0.22em] text-white/70">
            {label}
          </span>
        </div>

        <div className="h-px w-full flex-none bg-white/10" />

        <dl className="flex flex-col gap-[clamp(10px,2.2vmin,20px)]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-[clamp(9px,1.1vmin,12px)] uppercase tracking-[0.16em] text-white/40">
                {k}
              </dt>
              <dd className="text-[clamp(10px,1.25vmin,13px)] font-medium tabular-nums text-white/80">
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex h-[clamp(26px,7vmin,60px)] items-end gap-[clamp(2px,0.6vmin,4px)] overflow-hidden">
          {Array.from({ length: WAVE_BARS }).map((_, i) => (
            <span
              key={i}
              className="w-[clamp(2px,0.6vmin,4px)] flex-none rounded-full bg-white/60"
              style={{
                height: `${28 + Math.abs(Math.sin(i * 1.7)) * 72}%`,
                transformOrigin: "bottom",
                animation: `eq-bounce ${1.1 + (i % 4) * 0.3}s ease-in-out ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
