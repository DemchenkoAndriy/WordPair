import type { Card, CardId, CardProgress } from './types'
import type { Rng } from '@/lib/rng'
import { MASTERED_BOX } from './scheduler'

/**
 * Підбір карток на раунд. Правило суміші (interleaving):
 * приблизно 60% — прострочені повторення, 40% — нові.
 * Якщо прострочених мало — добираємо новими, і навпаки; сесія НІКОЛИ не буває порожньою.
 */
export const REVIEW_SHARE = 0.6

export interface SelectionInput {
  cards: readonly Card[]
  progress: ReadonlyMap<CardId, CardProgress>
  size: number
  now: number
  rng: Rng
}

export function selectRoundCards({ cards, progress, size, now, rng }: SelectionInput): Card[] {
  if (cards.length === 0) return []
  const limit = Math.min(size, cards.length)

  const due: Card[] = []
  const fresh: Card[] = []
  const rest: Card[] = []

  for (const card of cards) {
    const p = progress.get(card.id)
    if (!p || p.box === 0) fresh.push(card)
    else if (p.dueAt <= now) due.push(card)
    else rest.push(card)
  }

  // Найбільш прострочені — першими; серед нових зберігаємо порядок автора колоди
  // (колоди складені за зростанням складності).
  due.sort((a, b) => (progress.get(a.id)?.dueAt ?? 0) - (progress.get(b.id)?.dueAt ?? 0))

  const wantReview = Math.round(limit * REVIEW_SHARE)
  const picked: Card[] = [...due.slice(0, wantReview)]
  picked.push(...fresh.slice(0, limit - picked.length))
  if (picked.length < limit) picked.push(...due.slice(picked.length))
  if (picked.length < limit) {
    // Ще не «дозріли», але треба чимось наповнити раунд — беремо найслабші.
    const filler = rest
      .slice()
      .sort((a, b) => (progress.get(a.id)?.box ?? MASTERED_BOX) - (progress.get(b.id)?.box ?? MASTERED_BOX))
    picked.push(...filler.slice(0, limit - picked.length))
  }

  return rng.shuffle(picked.slice(0, limit))
}
