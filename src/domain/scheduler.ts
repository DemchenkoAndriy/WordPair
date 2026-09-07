import type { Attempt, Card, CardId, CardProgress, DeckId } from './types'
import { DAY, MINUTE, clamp } from '@/lib/time'

/**
 * Планувальник повторень: Ляйтнер із 5 боксів + мʼякий SM-2-подібний ease.
 * Свідомо простий: мікро-сесії по 30–60 секунд не переживуть «важкого» FSRS,
 * а користувачу потрібне відчуття руху, а не аптечна точність інтервалів.
 */

/** Інтервал до наступного показу для кожного бокса. */
export const BOX_INTERVALS = [
  0, // 0: нова — показуємо в цій же сесії
  10 * MINUTE, // 1
  1 * DAY, // 2
  3 * DAY, // 3
  7 * DAY, // 4
  21 * DAY, // 5: вивчено
] as const

export const MASTERED_BOX = 5
export const MIN_EASE = 1.3
export const MAX_EASE = 2.8
export const DEFAULT_EASE = 2.0

export function createCardProgress(card: Card, deckId: DeckId, now: number): CardProgress {
  return {
    cardId: card.id,
    deckId,
    box: 0,
    ease: DEFAULT_EASE,
    reps: 0,
    lapses: 0,
    dueAt: now,
    lastSeenAt: 0,
    avgLatencyMs: 0,
  }
}

/** Чиста функція: попередній стан + спроба → новий стан. Ніяких сайд-ефектів. */
export function schedule(prev: CardProgress, attempt: Attempt): CardProgress {
  const reps = prev.reps + 1
  const avgLatencyMs =
    prev.reps === 0
      ? attempt.latencyMs
      : Math.round((prev.avgLatencyMs * prev.reps + attempt.latencyMs) / reps)

  if (!attempt.correct) {
    // Помилка відкидає на бокс назад (але не в 0 — щоб не знецінювати попередню роботу)
    // і звужує ease.
    const box = Math.max(1, prev.box - 1)
    return {
      ...prev,
      box,
      ease: clamp(prev.ease - 0.2, MIN_EASE, MAX_EASE),
      reps,
      lapses: prev.lapses + 1,
      dueAt: attempt.at + 5 * MINUTE, // повернемо в цю ж або наступну сесію
      lastSeenAt: attempt.at,
      avgLatencyMs,
    }
  }

  // Підказка = правильно, але без просування далі.
  const box = attempt.usedHint ? prev.box : Math.min(MASTERED_BOX, prev.box + 1)
  const easeDelta = attempt.usedHint ? 0 : attempt.latencyMs < 2000 ? 0.1 : 0
  const ease = clamp(prev.ease + easeDelta, MIN_EASE, MAX_EASE)
  const base = BOX_INTERVALS[box] ?? BOX_INTERVALS[MASTERED_BOX]
  const interval = box <= 1 ? base : Math.round(base * (ease / DEFAULT_EASE))

  return {
    ...prev,
    box,
    ease,
    reps,
    dueAt: attempt.at + interval,
    lastSeenAt: attempt.at,
    avgLatencyMs,
  }
}

export function isDue(progress: CardProgress, now: number): boolean {
  return progress.dueAt <= now
}

export function isMastered(progress: CardProgress): boolean {
  return progress.box >= MASTERED_BOX
}

/** 0..1 — наскільки картка «засвоєна». Використовується для кільця прогресу колоди. */
export function cardStrength(progress: CardProgress): number {
  return clamp(progress.box / MASTERED_BOX, 0, 1)
}

export interface DeckMastery {
  total: number
  fresh: number
  learning: number
  mastered: number
  /** 0..1, зважене за боксами — рухається щосесії, а не стрибками. */
  ratio: number
}

export function deckMastery(cardIds: readonly CardId[], progress: ReadonlyMap<CardId, CardProgress>): DeckMastery {
  let fresh = 0
  let learning = 0
  let mastered = 0
  let sum = 0
  for (const id of cardIds) {
    const p = progress.get(id)
    if (!p || p.box === 0) {
      fresh++
      continue
    }
    sum += cardStrength(p)
    if (isMastered(p)) mastered++
    else learning++
  }
  const total = cardIds.length
  return { total, fresh, learning, mastered, ratio: total === 0 ? 0 : sum / total }
}
