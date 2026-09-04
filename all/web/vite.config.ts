import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(dirname, "vesper.config.json")

/**
 * Dev/preview endpoint that persists the Vesper settings to a JSON file in the
 * project directory, so the page can read it on startup.
 *   GET  /api/config  -> current settings (or {})
 *   POST /api/config  -> overwrite settings
 */
function vesperConfigApi(): Plugin {
  const handle = (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith("/api/config")) return next()

    if (req.method === "GET") {
      let data = "{}"
      try {
        data = fs.readFileSync(CONFIG_PATH, "utf8")
      } catch {
        /* no file yet */
      }
      res.setHeader("content-type", "application/json")
      res.end(data)
      return
    }

    if (req.method === "POST") {
      let body = ""
      req.on("data", (c: Buffer) => (body += c))
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}")
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2) + "\n")
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: String(e) }))
        }
      })
      return
    }

    res.statusCode = 405
    res.end()
  }

  return {
    name: "vesper-config-api",
    configureServer(s) {
      s.middlewares.use(handle)
    },
    configurePreviewServer(s) {
      s.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vesperConfigApi()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Browser -> Vite -> NVIDIA (avoids CORS; key travels in the header).
      "/nvidia-api": {
        target: "https://integrate.api.nvidia.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nvidia-api/, ""),
      },
    },
  },
})
