import { useEffect, useMemo, useRef, useState } from "react"
import { GlassPanel } from "@/components/ui/glass-panel"
import { listModels, type NvidiaModel } from "@/lib/nvidia"
import { saveConfig, type Effort, type VesperConfig } from "@/lib/config"

const EFFORTS: Effort[] = ["low", "medium", "high"]

const fieldLabel =
  "block text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50"
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/60 focus:bg-white/[0.07]"

export function ConfigScreen({
  initial,
  onSaved,
}: {
  initial?: Partial<VesperConfig>
  onSaved: (c: VesperConfig) => void
}) {
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "")
  const [models, setModels] = useState<NvidiaModel[]>([])
  const [loading, setLoading] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [model, setModel] = useState(initial?.model ?? "")
  const [effort, setEffort] = useState<Effort>(initial?.effort ?? "medium")
  const [saving, setSaving] = useState(false)
  const keyRef = useRef<HTMLInputElement>(null)

  const fetchModels = async () => {
    const key = apiKey.trim()
    if (!key) return
    setLoading(true)
    setModelError(null)
    try {
      const list = await listModels(key)
      setModels(list)
      if (list.length && !list.some((m) => m.id === model)) {
        setModel(list[0].id)
      }
    } catch (e) {
      setModels([])
      setModelError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // If we opened with a saved key, load its models straight away.
  useEffect(() => {
    if (initial?.apiKey) void fetchModels()
    else keyRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? models.filter((m) => m.id.toLowerCase().includes(q)) : models
  }, [models, search])

  // Keep the selection valid: if filtering hides the current model, adopt the
  // first visible one (a native <select> shows it but wouldn't fire onChange).
  useEffect(() => {
    if (filtered.length && !filtered.some((m) => m.id === model)) {
      setModel(filtered[0].id)
    }
  }, [filtered, model])

  const canSave = Boolean(apiKey.trim() && model && !saving)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const cfg: VesperConfig = { apiKey: apiKey.trim(), model, effort }
    const ok = await saveConfig(cfg)
    setSaving(false)
    if (ok) onSaved(cfg)
    else setModelError("Kaydedilemedi (dev sunucusu çalışıyor mu?).")
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(70vmin,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[120px] bg-[radial-gradient(circle,rgba(156,67,254,0.35),rgba(76,194,233,0.22)_45%,transparent_70%)]"
      />

      <GlassPanel className="relative w-full max-w-md rounded-3xl p-7">
        <p className="mb-6 text-sm font-semibold uppercase tracking-[0.42em] text-white/90">
          Vesper
        </p>

        {/* API KEY */}
        <label className={fieldLabel} htmlFor="apikey">
          API Key
        </label>
        <input
          id="apikey"
          ref={keyRef}
          type="password"
          autoComplete="off"
          spellCheck={false}
          className={`${inputCls} mt-2`}
          placeholder="nvapi-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void fetchModels()
            }
          }}
        />
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-white/35">
          {loading
            ? "modeller yükleniyor…"
            : models.length
              ? `${models.length} model bulundu`
              : "press enter"}
        </p>

        {/* SELECT MODEL */}
        <div className="mt-6">
          <label className={fieldLabel} htmlFor="model-search">
            Select Model
          </label>
          <input
            id="model-search"
            type="text"
            className={`${inputCls} mt-2`}
            placeholder="model ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!models.length}
          />
          <div className="relative mt-2">
            <select
              className={`${inputCls} appearance-none pr-9 disabled:opacity-40`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!filtered.length}
              size={1}
            >
              {filtered.length === 0 && <option value="">—</option>}
              {filtered.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900">
                  {m.id}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
              ▾
            </span>
          </div>
          {modelError && (
            <p className="mt-1.5 text-[11px] text-red-300/80">{modelError}</p>
          )}
        </div>

        {/* EFFORT */}
        <div className="mt-6">
          <span className={fieldLabel}>Effort</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEffort(e)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium uppercase tracking-widest transition-colors ${
                  effort === e
                    ? "border-cyan-300/60 bg-cyan-300/15 text-white"
                    : "border-white/15 bg-white/[0.03] text-white/50 hover:text-white/80"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* SAVE */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="mt-7 w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {saving ? "kaydediliyor…" : "Save"}
        </button>
      </GlassPanel>
    </div>
  )
}
