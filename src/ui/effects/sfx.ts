/**
 * Звук синтезується WebAudio, а не вантажиться файлами.
 * Причини: нуль байтів у бандлі, нуль затримки на першому звуці
 * і можливість підвищувати висоту тону з ростом комбо — саме це дає
 * відчуття «розгону», знайоме з ігор і коротких відео.
 */
let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(value: boolean) {
  enabled = value
}

/** Викликати з обробника першого тапу: браузери не дають створити контекст раніше. */
export function primeAudio() {
  if (ctx || typeof window === 'undefined') return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (Ctor) ctx = new Ctor()
  void ctx?.resume()
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'triangle', gain = 0.06) {
  if (!enabled || !ctx) return
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  amp.gain.setValueAtTime(gain, ctx.currentTime)
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000)
  osc.connect(amp).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + durationMs / 1000)
}

/** Нота збігу: висота росте з комбо (пентатоніка — будь-яка послідовність звучить приємно). */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0]

export const sfx = {
  hit(combo: number) {
    const step = PENTATONIC[Math.min(combo - 1, PENTATONIC.length - 1)] ?? PENTATONIC[0]!
    const octave = Math.min(2, Math.floor((combo - 1) / PENTATONIC.length))
    tone(step * 2 ** octave, 140)
  },
  crit() {
    tone(1318.51, 90, 'square', 0.05)
    setTimeout(() => tone(1567.98, 160, 'square', 0.05), 70)
  },
  miss() {
    tone(146.83, 180, 'sawtooth', 0.04)
  },
  milestone() {
    ;[659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 180), i * 70))
  },
  levelUp() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 260, 'triangle', 0.07), i * 90))
  },
  clear() {
    ;[783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 220), i * 110))
  },
}
