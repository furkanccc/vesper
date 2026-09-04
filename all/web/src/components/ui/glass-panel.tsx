import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GlassPanelProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Liquid-glass surface: frosted blur, refracted edge light, specular top sheen.
 */
export function GlassPanel({ children, className, style }: GlassPanelProps) {
  return (
    <div
      style={style}
      className={cn(
        "relative isolate overflow-hidden rounded-[28px]",
        "border border-white/15 bg-white/[0.06]",
        "backdrop-blur-2xl backdrop-saturate-150",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),inset_0_-1px_1px_0_rgba(255,255,255,0.08),inset_0_0_20px_0_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      {/* diagonal specular highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,rgba(255,255,255,0.10)_100%)]"
      />
      {/* colored refraction bloom that echoes the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 opacity-70 blur-2xl bg-[radial-gradient(120px_180px_at_20%_15%,rgba(156,67,254,0.35),transparent_70%),radial-gradient(140px_200px_at_85%_90%,rgba(76,194,233,0.30),transparent_70%)]"
      />
      {children}
    </div>
  )
}
