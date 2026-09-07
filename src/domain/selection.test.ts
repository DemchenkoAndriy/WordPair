import { describe, expect, it } from 'vitest'
import { selectRoundCards } from './selection'
import { createCardProgress } from './scheduler'
import { createRng } from '@/lib/rng'
import type { Card, CardId, CardProgress } from './types'

const NOW = 1_700_000_000_000
const cards: Card[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  prompt: `p${i}`,
  answer: `a${i}`,
}))

function progressFor(entries: Array<[CardId, Partial<CardProgress>]>): Map<CardId, CardProgress> {
  return new Map(
    entries.map(([id, patch]) => [id, { ...createCardProgress({ id } as Card, 'd', NOW), ...patch }]),
  )
}

describe('selection', () => {
  it('повертає рівно потрібну кількість карток', () => {
    const picked = selectRoundCards({ cards, progress: new Map(), size: 5, now: NOW, rng: createRng(1) })
    expect(picked).toHaveLength(5)
    expect(new Set(picked.map((c) => c.id)).size).toBe(5)
  })

  it('не падає і не дублює, коли карток менше за розмір раунду', () => {
    const picked = selectRoundCards({ cards: cards.slice(0, 3), progress: new Map(), size: 5, now: NOW, rng: createRng(1) })
    expect(picked).toHaveLength(3)
  })

  it('прострочені повторення мають пріоритет над картками з майбутнім dueAt', () => {
    const progress = progressFor([
      ['c0', { box: 2, dueAt: NOW - 10_000 }],
      ['c1', { box: 2, dueAt: NOW - 5_000 }],
      ['c2', { box: 3, dueAt: NOW + 86_400_000 }],
    ])
    const ids = selectRoundCards({ cards: cards.slice(0, 3), progress, size: 2, now: NOW, rng: createRng(1) }).map((c) => c.id)
    expect(ids.sort()).toEqual(['c0', 'c1'])
  })

  it('змішує повторення з новими картками', () => {
    const progress = progressFor(
      Array.from({ length: 6 }, (_, i) => [`c${i}`, { box: 2, dueAt: NOW - 1000 }] as [CardId, Partial<CardProgress>]),
    )
    const picked = selectRoundCards({ cards, progress, size: 5, now: NOW, rng: createRng(7) })
    const reviews = picked.filter((c) => progress.has(c.id)).length
    expect(reviews).toBe(3) // 60% від 5
    expect(picked.length - reviews).toBe(2)
  })

  it('добирає ще «не дозрілими» картками, коли інших немає', () => {
    const progress = progressFor(
      cards.map((c) => [c.id, { box: 3, dueAt: NOW + 86_400_000 }] as [CardId, Partial<CardProgress>]),
    )
    const picked = selectRoundCards({ cards, progress, size: 4, now: NOW, rng: createRng(3) })
    expect(picked).toHaveLength(4)
  })

  it('порожня колода дає порожній раунд, а не помилку', () => {
    expect(selectRoundCards({ cards: [], progress: new Map(), size: 5, now: NOW, rng: createRng(1) })).toEqual([])
  })
})
