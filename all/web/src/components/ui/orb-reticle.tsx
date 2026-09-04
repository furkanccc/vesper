import type { ReactNode } from "react"

const TICKS = 60

/**
 * HUD reticle that frames the orb: two counter-rotating dashed rings and a
 * ticked outer scale. Scales with its parent (size the parent, not this).
 */
export function OrbReticle({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid place-items-center">
      {/* outer ticked scale */}
      <svg
        className="pointer-events-none absolute -z-0 h-[152%] w-[152%] text-white/25"
        viewBox="0 0 200 200"
        style={{ animation: "spin-slow 120s linear infinite" }}
      >
        {Array.from({ length: TICKS }).map((_, i) => {
          const major = i % 5 === 0
          return (
            <line
              key={i}
              x1="100"
              y1={major ? 6 : 9}
              x2="100"
              y2={major ? 15 : 12}
              stroke="currentColor"
              strokeWidth={major ? 1.1 : 0.6}
              transform={`rotate(${(360 / TICKS) * i} 100 100)`}
            />
          )
        })}
      </svg>

      {/* mid dashed ring */}
      <svg
        className="pointer-events-none absolute -z-0 h-[128%] w-[128%] text-cyan-200/30"
        viewBox="0 0 200 200"
        style={{ animation: "spin-reverse-slow 48s linear infinite" }}
      >
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="2 10"
        />
      </svg>

      {/* inner arc ring */}
      <svg
        className="pointer-events-none absolute -z-0 h-[116%] w-[116%] text-violet-200/40"
        viewBox="0 0 200 200"
        style={{ animation: "spin-slow 30s linear infinite" }}
      >
        <path
          d="M100 8 A92 92 0 0 1 192 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M100 192 A92 92 0 0 1 8 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>

      {children}
    </div>
  )
}
