/**
 * Full-bleed atmosphere behind the orb: drifting aurora blobs, a faint
 * perspective grid, film grain and a vignette. Purely decorative.
 */
export function SceneBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* drifting aurora */}
      <div
        className="absolute left-[8%] top-[6%] h-[46vmax] w-[46vmax] rounded-full opacity-50 blur-[120px] bg-[radial-gradient(circle,rgba(156,67,254,0.55),transparent_60%)]"
        style={{ animation: "aurora-a 26s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[4%] top-[28%] h-[40vmax] w-[40vmax] rounded-full opacity-45 blur-[120px] bg-[radial-gradient(circle,rgba(76,194,233,0.5),transparent_60%)]"
        style={{ animation: "aurora-b 32s ease-in-out infinite" }}
      />
      <div
        className="absolute bottom-[2%] left-[34%] h-[38vmax] w-[38vmax] rounded-full opacity-40 blur-[130px] bg-[radial-gradient(circle,rgba(37,44,180,0.6),transparent_60%)]"
        style={{ animation: "aurora-c 38s ease-in-out infinite" }}
      />

      {/* perspective grid on the floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42%] opacity-[0.12] [mask-image:linear-gradient(to_top,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          transform: "perspective(520px) rotateX(62deg)",
          transformOrigin: "bottom",
        }}
      />

      {/* centered radar: concentric rings + slow sweep, spans ultrawide */}
      <div className="absolute left-1/2 top-1/2 h-[135vmin] w-[135vmin] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(circle_at_center,transparent_16%,black_34%,black_66%,transparent_82%)]">
        <svg viewBox="0 0 200 200" className="h-full w-full text-white/[0.07]">
          {[24, 44, 66, 88].map((r) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.4"
            />
          ))}
          <line x1="100" y1="4" x2="100" y2="196" stroke="currentColor" strokeWidth="0.3" />
          <line x1="4" y1="100" x2="196" y2="100" stroke="currentColor" strokeWidth="0.3" />
        </svg>
        <div
          className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(120,200,255,0.12)_38deg,transparent_64deg)]"
          style={{ animation: "spin-slow 16s linear infinite" }}
        />
      </div>

      {/* horizontal data rails linking the panels to the orb (wide screens) */}
      <div className="absolute inset-x-0 top-1/2 hidden -translate-y-1/2 md:block">
        <svg
          className="mx-auto block h-6 w-full max-w-[1700px] text-white/30 [mask-image:radial-gradient(circle_at_center,transparent_13%,black_25%,black_75%,transparent_92%)]"
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="12"
            x2="1000"
            y2="12"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 12"
            style={{ animation: "dash-flow 30s linear infinite" }}
          />
        </svg>
      </div>

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
