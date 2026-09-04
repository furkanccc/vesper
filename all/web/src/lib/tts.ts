/** Text-to-speech via the browser SpeechSynthesis API. */

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady
  voicesReady = new Promise((resolve) => {
    const synth = window.speechSynthesis
    const now = synth.getVoices()
    if (now.length) return resolve(now)
    const handler = () => resolve(synth.getVoices())
    synth.addEventListener("voiceschanged", handler, { once: true })
    // Safety net if the event never fires.
    setTimeout(() => resolve(synth.getVoices()), 1000)
  })
  return voicesReady
}

let primed = false
/**
 * Unlock SpeechSynthesis inside a user gesture (some browsers stay silent until
 * the first interaction). Safe to call repeatedly.
 */
export function primeSpeech() {
  if (primed || !speechSupported()) return
  primed = true
  try {
    const synth = window.speechSynthesis
    synth.resume()
    const u = new SpeechSynthesisUtterance("")
    u.volume = 0
    synth.speak(u)
    synth.cancel()
  } catch {
    /* noop */
  }
}

export function cancelSpeech() {
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* noop */
  }
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

/** Speak `text`; resolves when playback finishes (or is cancelled). */
export async function speak(
  text: string,
  opts: { lang?: string; onStart?: () => void } = {},
): Promise<void> {
  if (!speechSupported() || !text.trim()) return
  const lang = opts.lang ?? "tr-TR"
  const synth = window.speechSynthesis
  synth.cancel()

  const voices = await getVoices()
  const pick =
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2)))

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    if (pick) u.voice = pick
    u.rate = 1.02
    u.pitch = 1
    u.onstart = () => opts.onStart?.()
    u.onend = () => resolve()
    u.onerror = () => resolve()
    synth.speak(u)
  })
}
