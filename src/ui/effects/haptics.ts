/** Тактильний відгук. Vibration API є не всюди — усі виклики безпечні за замовчуванням. */
type Pattern = number | number[]

const PATTERNS = {
  hit: 12,
  miss: [24, 40, 24],
  milestone: [12, 30, 12, 30, 24],
  levelUp: [20, 40, 20, 40, 60],
  clear: [16, 24, 16],
} satisfies Record<string, Pattern>

export type HapticKind = keyof typeof PATTERNS

let enabled = true

export function setHapticsEnabled(value: boolean) {
  enabled = value
}

export function haptic(kind: HapticKind) {
  if (!enabled) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // деякі браузери кидають без user gesture — ігноруємо
  }
}
