/**
 * PIXELVERSE procedural retro sound engine.
 *
 * Zero-dependency arcade sound effects synthesized live with the Web Audio API.
 * The AudioContext is created lazily and only after the user has interacted
 * with the page, so browser autoplay policies never emit console warnings.
 */

const STORAGE_KEY = 'pixelverse_muted'

// ── Mute state (persisted in localStorage, defaults to unmuted) ──────────────
function readStoredMute(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

let muted = typeof window !== 'undefined' ? readStoredMute() : false

export function isMuted(): boolean {
  return muted
}

/** Flip the mute state, persist it, and chirp when re-enabled. */
export function toggleMute(): boolean {
  muted = !muted
  try {
    window.localStorage.setItem(STORAGE_KEY, String(muted))
  } catch {
    /* storage unavailable — keep the in-memory state only */
  }
  if (!muted) playClick()
  return muted
}

// ── Gesture gate ─────────────────────────────────────────────────────────────
// The AudioContext may only start after the user interacts with the page.
let hasInteracted = false

if (typeof window !== 'undefined') {
  const markInteracted = () => {
    hasInteracted = true
  }
  // capture:true → fires before the element's own click handler runs
  window.addEventListener('pointerdown', markInteracted, { once: true, capture: true })
  window.addEventListener('keydown', markInteracted, { once: true, capture: true })
}

// ── Audio graph ──────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null

function getContext(): AudioContext | null {
  if (!hasInteracted || typeof window === 'undefined') return null

  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    try {
      audioCtx = new AudioCtx()
    } catch {
      return null
    }
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.85
    masterGain.connect(audioCtx.destination)
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

interface ToneSpec {
  type?: OscillatorType
  from: number
  to?: number
  duration: number
  volume?: number
  delay?: number
}

/** Fire a single shaped oscillator blip. */
function playTone({ type = 'square', from, to, duration, volume = 0.2, delay = 0 }: ToneSpec) {
  if (muted) return
  const ctx = getContext()
  if (!ctx || !masterGain) return

  const startAt = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(from, startAt)
  if (to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), startAt + duration)
  }

  // Fast attack / exponential decay keeps tones crisp and click-free
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.03)
}

// ── Public triggers ──────────────────────────────────────────────────────────
let lastHoverAt = 0

/** Ultra-subtle high-tech tick (throttled so fast hovers don't chatter). */
export function playHover() {
  if (muted) return
  const now = performance.now()
  if (now - lastHoverAt < 45) return
  lastHoverAt = now
  playTone({ type: 'sine', from: 1400, to: 1900, duration: 0.035, volume: 0.05 })
}

/** Crisp mechanical terminal click. */
export function playClick() {
  playTone({ type: 'square', from: 780, to: 320, duration: 0.05, volume: 0.16 })
}

/** Rising synth chirp; `pitchStep` raises the pitch for streak/multiplier jumps. */
export function playBoost(pitchStep = 0) {
  const base = 300 + Math.max(0, pitchStep) * 90
  playTone({ type: 'sawtooth', from: base, to: base * 2.6, duration: 0.16, volume: 0.22 })
}

/** Two-tone arcade coin / bank chime. */
export function playSuccess() {
  playTone({ type: 'square', from: 988, to: 988, duration: 0.09, volume: 0.16 })
  playTone({ type: 'square', from: 1319, to: 1319, duration: 0.16, volume: 0.18, delay: 0.08 })
}

/** Low buzz / meltdown alarm. */
export function playError() {
  playTone({ type: 'sawtooth', from: 200, to: 45, duration: 0.4, volume: 0.3 })
  playTone({ type: 'square', from: 90, to: 40, duration: 0.4, volume: 0.12, delay: 0.02 })
}
