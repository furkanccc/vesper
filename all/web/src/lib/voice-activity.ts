/**
 * Voice Activity Detection: reacts to a human voice, ignores steady background
 * noise AND impulsive sounds (keyboard clicks, mouse, taps, knocks).
 *
 * Design: ONE hard rule + a soft score.
 *
 *  Hard rule — transient reject: a key click is a spike in the time domain
 *  (crest factor = peak/RMS ~8–20); voiced speech is dense (crest ~3–6).
 *  Frames above `crestMax` are dropped and also reset the attack timer, so a
 *  burst of typing can never accumulate into the attack window.
 *
 *  Soft score — `voiceness` (0..1), a weighted blend of:
 *    • periodicity  – normalized autocorrelation over a 70–350 Hz pitch range.
 *                     A voice repeats at a pitch; clicks/claps/knocks do not.
 *    • tonality     – 1 − spectral flatness. Voice is tonal, noise is flat.
 *    • SNR          – dB above an adaptive noise floor (a louder room just
 *                     raises the floor; it does not trigger).
 *  The gate opens when voiceness clears `voicenessMin` and the band level is
 *  above the floor by `gateDb`. Attack/release hysteresis smooths the state.
 *
 * Browser-side `echoCancellation` handles speaker echo before this runs.
 */

export interface VoiceActivityOptions {
  minHz?: number
  maxHz?: number
  /** dB above the adaptive noise floor for the band level to count. */
  gateDb?: number
  /** Min blended voice score (0..1) to open the gate. Higher = stricter. */
  voicenessMin?: number
  /** Max time-domain crest factor; spikier frames are impulsive noise. */
  crestMax?: number
  /** Continuous voiced audio (ms) before `speaking` turns true. */
  attackMs?: number
  /** Continuous silence (ms) before `speaking` turns false. */
  releaseMs?: number
  /** Output level multiplier. */
  sensitivity?: number
}

export interface VoiceActivityFrame {
  level: number
  speaking: boolean
  snrDb: number
  floorDb: number
  flatness: number
  periodicity: number
  crest: number
  voiceness: number
}

const DEFAULTS: Required<VoiceActivityOptions> = {
  minHz: 140,
  maxHz: 3800,
  gateDb: 10,
  voicenessMin: 0.35,
  crestMax: 9,
  attackMs: 60,
  releaseMs: 320,
  sensitivity: 1,
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export class VoiceActivityDetector {
  private opts: Required<VoiceActivityOptions>
  private hp: BiquadFilterNode
  private lp: BiquadFilterNode
  private analyser: AnalyserNode
  private freq: Float32Array<ArrayBuffer>
  private time: Float32Array<ArrayBuffer>
  private loBin: number
  private hiBin: number
  private minLag: number
  private maxLag: number
  private acWin: number

  private floorDb = -100
  private level = 0
  private aboveMs = 0
  private belowMs = 0
  private speaking = false
  private lastT = 0

  constructor(
    ctx: AudioContext,
    source: AudioNode,
    options: VoiceActivityOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options }

    this.hp = ctx.createBiquadFilter()
    this.hp.type = "highpass"
    this.hp.frequency.value = this.opts.minHz
    this.hp.Q.value = 0.707

    this.lp = ctx.createBiquadFilter()
    this.lp.type = "lowpass"
    this.lp.frequency.value = this.opts.maxHz
    this.lp.Q.value = 0.707

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0.4
    this.analyser.minDecibels = -100
    this.analyser.maxDecibels = -10

    source.connect(this.hp)
    this.hp.connect(this.lp)
    this.lp.connect(this.analyser)

    this.freq = new Float32Array(new ArrayBuffer(this.analyser.frequencyBinCount * 4))
    this.time = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4))

    const hzPerBin = ctx.sampleRate / this.analyser.fftSize
    this.loBin = Math.max(1, Math.floor(this.opts.minHz / hzPerBin))
    this.hiBin = Math.min(
      this.analyser.frequencyBinCount - 1,
      Math.ceil(this.opts.maxHz / hzPerBin),
    )

    this.minLag = Math.max(2, Math.floor(ctx.sampleRate / 350))
    this.maxLag = Math.ceil(ctx.sampleRate / 70)
    this.acWin = Math.min(2048, this.analyser.fftSize - this.maxLag - 1)
  }

  /** Best normalized autocorrelation over the voice-pitch lag range (0..1). */
  private periodicity(t: Float32Array): number {
    const { minLag, maxLag, acWin } = this
    let e0 = 0
    for (let i = 0; i < acWin; i++) e0 += t[i] * t[i]
    if (e0 < 1e-7) return 0

    let best = 0
    // step 2 through the lags: ~half the work, negligible accuracy loss
    for (let lag = minLag; lag <= maxLag; lag += 2) {
      let s = 0
      let eL = 0
      for (let i = 0; i < acWin; i++) {
        const y = t[i + lag]
        s += t[i] * y
        eL += y * y
      }
      const r = s / (Math.sqrt(e0 * eL) + 1e-7)
      if (r > best) best = r
    }
    return clamp01(best)
  }

  /** Call once per animation frame. `now` = milliseconds (rAF timestamp). */
  frame(now: number): VoiceActivityFrame {
    const dt = this.lastT ? Math.min(now - this.lastT, 100) : 16
    this.lastT = now

    this.analyser.getFloatFrequencyData(this.freq)
    this.analyser.getFloatTimeDomainData(this.time)

    // spectral: band power + flatness
    let sumPow = 0
    let sumLogPow = 0
    let n = 0
    const EPS = 1e-10
    for (let i = this.loBin; i <= this.hiBin; i++) {
      const db = this.freq[i]
      const p = db === -Infinity ? EPS : Math.pow(10, db / 10) + EPS
      sumPow += p
      sumLogPow += Math.log(p)
      n++
    }
    const meanPow = sumPow / Math.max(n, 1)
    const geoMean = Math.exp(sumLogPow / Math.max(n, 1))
    const flatness = clamp01(geoMean / (meanPow + EPS))
    const curDb = 10 * Math.log10(meanPow + EPS)

    // time domain: crest factor (spike detector)
    let peak = 0
    let sumSq = 0
    for (let i = 0; i < this.time.length; i++) {
      const a = Math.abs(this.time[i])
      if (a > peak) peak = a
      sumSq += this.time[i] * this.time[i]
    }
    const rmsT = Math.sqrt(sumSq / this.time.length)
    const crest = peak / (rmsT + 1e-7)

    const periodicity = this.periodicity(this.time)
    const snrDb = curDb - this.floorDb

    // --- soft voice score ---
    const periodScore = clamp01((periodicity - 0.18) / 0.42) // 0.18→0, 0.60→1
    const tonalScore = clamp01((0.62 - flatness) / 0.42) //   flat→0, tonal→1
    const snrScore = clamp01((snrDb - this.opts.gateDb) / 16)
    const voiceness =
      0.45 * periodScore + 0.3 * tonalScore + 0.25 * snrScore

    const notSpike = crest <= this.opts.crestMax
    const loudEnough = snrDb > this.opts.gateDb
    const candidate = loudEnough && notSpike && voiceness >= this.opts.voicenessMin

    // adaptive noise floor — never train it on speech or on spikes
    if (!this.speaking && voiceness < 0.35 && crest <= this.opts.crestMax * 1.6) {
      const rate = curDb < this.floorDb ? 0.15 : 0.02
      this.floorDb += (curDb - this.floorDb) * rate
    }
    if (this.floorDb < -100) this.floorDb = -100
    if (this.floorDb > -25) this.floorDb = -25

    // hysteresis; a spike frame resets the attack accumulator
    if (candidate) {
      this.aboveMs += dt
      this.belowMs = 0
    } else {
      if (!notSpike) this.aboveMs = 0
      this.belowMs += dt
      if (this.belowMs > 90) this.aboveMs = 0
    }
    if (!this.speaking && this.aboveMs >= this.opts.attackMs) this.speaking = true
    if (this.speaking && this.belowMs >= this.opts.releaseMs) this.speaking = false

    // output level
    const target = this.speaking
      ? clamp01((snrDb - this.opts.gateDb) / 26) * this.opts.sensitivity
      : 0
    const smooth = target > this.level ? 0.35 : 0.12
    this.level = clamp01(this.level + (target - this.level) * smooth)

    return {
      level: this.level,
      speaking: this.speaking,
      snrDb,
      floorDb: this.floorDb,
      flatness,
      periodicity,
      crest,
      voiceness,
    }
  }

  setSensitivity(v: number) {
    this.opts.sensitivity = v
  }

  dispose() {
    try {
      this.hp.disconnect()
      this.lp.disconnect()
      this.analyser.disconnect()
    } catch {
      /* already torn down */
    }
  }
}
