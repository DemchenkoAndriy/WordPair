export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Локальний день у форматі YYYY-MM-DD — ключ для стріків і теплокарти. */
export function dayKey(at: number): string {
  const d = new Date(at)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Різниця в календарних днях між двома ключами дня. */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00`)
  const to = Date.parse(`${toKey}T00:00:00`)
  return Math.round((to - from) / DAY)
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
