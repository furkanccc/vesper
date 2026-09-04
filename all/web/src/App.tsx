import { useEffect, useState } from "react"
import { ConfigScreen } from "@/components/ConfigScreen"
import { VoiceScene } from "@/components/VoiceScene"
import {
  isConfigReady,
  loadConfig,
  type VesperConfig,
} from "@/lib/config"

type State =
  | { phase: "loading" }
  | { phase: "config"; initial: Partial<VesperConfig> }
  | { phase: "ready"; config: VesperConfig }

function App() {
  const [state, setState] = useState<State>({ phase: "loading" })

  useEffect(() => {
    loadConfig().then((c) => {
      setState(
        isConfigReady(c)
          ? { phase: "ready", config: c }
          : { phase: "config", initial: c },
      )
    })
  }, [])

  if (state.phase === "loading") {
    return <div className="min-h-screen bg-black" />
  }

  if (state.phase === "config") {
    return (
      <ConfigScreen
        initial={state.initial}
        onSaved={(config) => setState({ phase: "ready", config })}
      />
    )
  }

  return (
    <VoiceScene
      config={state.config}
      onReconfigure={() =>
        setState({ phase: "config", initial: state.config })
      }
    />
  )
}

export default App
