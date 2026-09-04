import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import { StatusPanel } from "@/components/ui/voice-visualizer-panels"
import { SceneBackground } from "@/components/ui/scene-background"
import { OrbReticle } from "@/components/ui/orb-reticle"
import { HudCorners, TopBar, BottomBar } from "@/components/ui/hud-chrome"
import { ChatLog } from "@/components/ChatLog"
import { useEffect } from "react"
import { useSpeechRecognition } from "@/lib/use-speech-recognition"
import { useConversation } from "@/lib/use-conversation"
import { primeSpeech } from "@/lib/tts"
import type { VesperConfig } from "@/lib/config"

export function VoiceScene({
  config,
  onReconfigure,
}: {
  config: VesperConfig
  onReconfigure: () => void
}) {
  const convo = useConversation(config)
  const speech = useSpeechRecognition({
    enabled: true,
    lang: "tr-TR",
    muted: convo.busy, // don't let Vesper hear itself think / speak
    onUtterance: convo.ask,
  })

  useEffect(() => {
    const unlock = () => primeSpeech()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const sceneState = convo.speaking
    ? "Speaking"
    : convo.thinking
      ? "Thinking"
      : speech.listening
        ? "Listening"
        : "Idle"

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <SceneBackground />
      <HudCorners />
      <TopBar />

      <button
        type="button"
        onClick={onReconfigure}
        className="absolute right-4 top-20 z-20 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50 backdrop-blur-md transition-colors hover:text-white/90 sm:right-8 sm:top-24"
      >
        ⚙ config
      </button>

      {/* Orb — dead centre of the viewport */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
        <div className="aspect-square w-[clamp(200px,32vmin,500px)]">
          <OrbReticle>
            <div className="relative aspect-square w-full">
              <VoicePoweredOrb
                enableVoiceControl
                voiceStrictness={0.32}
                className="overflow-hidden rounded-full"
              />
            </div>
          </OrbReticle>
        </div>
      </div>

      {/* Left — conversation log */}
      <div className="absolute left-4 top-24 bottom-24 hidden w-[clamp(260px,24vw,380px)] lg:block sm:left-8">
        <ChatLog
          turns={convo.turns}
          interim={speech.interimText}
          thinking={convo.thinking}
          className="h-full"
        />
      </div>

      {/* Right — status */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 lg:block sm:right-8">
        <StatusPanel
          state={sceneState}
          model={config.model}
          effort={config.effort}
        />
      </div>

      <BottomBar
        finalText={speech.finalText}
        interimText={speech.interimText}
        status={speech.status}
        error={speech.error ?? convo.error}
      />
    </div>
  )
}
