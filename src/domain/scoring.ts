import type { Card } from './types'
import type { Rng } from '@/lib/rng'
import { clamp } from '@/lib/time'

/**
 * Нарахування XP. Формула навмисно містить елемент випадковості («критичний удар»):
 * змінний коефіцієнт підкріплення — це саме те, на чому тримається стрічка тіктоку.
 */

export const BASE_XP = 10
export const CRIT_CHANCE = 0.12
export const CRIT_MULTIPLIER = 2
/** Комбо перестає множити після цього значення, щоб числа не летіли в космос. */
export const COMBO_CAP = 10
/** Пороги, на яких спрацьовує окремий візуальний/звуковий сплеск. */
export const COMBO_MILESTONES = [5, 10, 20, 50] as const

export interface HitScore {
  xp: number
  critical: boolean
  /** Множник, який показуємо в UI (×1.4 тощо). */
  multiplier: number
}

/** Бонус за швидкість: до 2000 мс — повний, після 6000 мс — нульовий. */
export function speedBonus(latencyMs: number): number {
  if (latencyMs <= 2000) return 0.5
  if (latencyMs >= 6000) return 0
  return 0.5 * (1 - (latencyMs - 2000) / 4000)
}

export function comboMultiplier(combo: number): number {
  return 1 + clamp(combo, 0, COMBO_CAP) * 0.1
}

export function scoreHit(params: {
  combo: number
  latencyMs: number
  usedHint?: boolean
  card?: Pick<Card, 'difficulty'>
  rng: Rng
}): HitScore {
  const { combo, latencyMs, usedHint, card, rng } = params
  const difficulty = card?.difficulty ?? 3
  const difficultyFactor = 0.8 + difficulty * 0.1 // 0.9 .. 1.3
  const multiplier = comboMultiplier(combo) * (1 + speedBonus(latencyMs)) * difficultyFactor
  const critical = !usedHint && rng.next() < CRIT_CHANCE
  const raw = BASE_XP * multiplier * (usedHint ? 0.4 : 1) * (critical ? CRIT_MULTIPLIER : 1)
  return { xp: Math.round(raw), critical, multiplier: Number(multiplier.toFixed(2)) }
}

export function isComboMilestone(combo: number): boolean {
  return (COMBO_MILESTONES as readonly number[]).includes(combo)
}

// ────────────────────────────── Рівні ──────────────────────────────

/**
 * Рівень зростає квадратично: перші рівні беруться за одну-дві сесії
 * (щоб новачок побачив level-up у перші 60 секунд), далі — повільніше.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return 50 * (level - 1) * level // L2=100, L3=300, L4=600, L5=1000…
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export interface LevelProgress {
  level: number
  xpInLevel: number
  xpForNext: number
  /** 0..1 — заповнення смужки рівня. */
  ratio: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const floor = xpForLevel(level)
  const ceil = xpForLevel(level + 1)
  const span = ceil - floor
  return {
    level,
    xpInLevel: xp - floor,
    xpForNext: ceil - xp,
    ratio: span === 0 ? 0 : (xp - floor) / span,
  }
}
