export type Effort = "low" | "medium" | "high"

export interface VesperConfig {
  apiKey: string
  model: string
  effort: Effort
}

const ENDPOINT = "/api/config"

/** Read the saved settings from the project file. Returns {} if none/unreachable. */
export async function loadConfig(): Promise<Partial<VesperConfig>> {
  try {
    const r = await fetch(ENDPOINT, { cache: "no-store" })
    if (!r.ok) return {}
    return (await r.json()) as Partial<VesperConfig>
  } catch {
    return {}
  }
}

/** True once the settings are complete enough to start the app. */
export function isConfigReady(c: Partial<VesperConfig>): c is VesperConfig {
  return Boolean(c.apiKey && c.model && c.effort)
}

/** Persist the settings to the project file. */
export async function saveConfig(c: VesperConfig): Promise<boolean> {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(c),
    })
    return r.ok
  } catch {
    return false
  }
}
