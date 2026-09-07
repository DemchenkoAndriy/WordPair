import { describe, expect, it } from 'vitest'
import { BOX_INTERVALS, MASTERED_BOX, createCardProgress, deckMastery, isMastered, schedule } from './scheduler'
import type { Attempt, Card } from './types'

const card: Card = { id: 'c1', prompt: 'a', answer: 'b' }
const NOW = 1_700_000_000_000

const attempt = (correct: boolean, extra: Partial<Attempt> = {}): Attempt => ({
  cardId: 'c1',
  deckId: 'd',
  mode: 'pair-match',
  correct,
  latencyMs: 1500,
  at: NOW,
  ...extra,
})

describe('scheduler', () => {
  it('нова картка стартує з боксу 0 і доступна одразу', () => {
    const p = createCardProgress(card, 'd', NOW)
    expect(p.box).toBe(0)
    expect(p.dueAt).toBe(NOW)
  })

  it('правильна відповідь просуває на бокс уперед', () => {
    const p = schedule(createCardProgress(card, 'd', NOW), attempt(true))
    expect(p.box).toBe(1)
    expect(p.reps).toBe(1)
    expect(p.dueAt).toBe(NOW + BOX_INTERVALS[1])
  })

  it('помилка відкидає на бокс назад, але не нижче першого', () => {
    let p = createCardProgress(card, 'd', NOW)
    for (let i = 0; i < 3; i++) p = schedule(p, attempt(true))
    expect(p.box).toBe(3)

    p = schedule(p, attempt(false))
    expect(p.box).toBe(2)
    expect(p.lapses).toBe(1)

    p = schedule(p, attempt(false))
    p = schedule(p, attempt(false))
    p = schedule(p, attempt(false))
    expect(p.box).toBe(1)
  })

  it('картка стає вивченою після п’яти правильних поспіль', () => {
    let p = createCardProgress(card, 'd', NOW)
    for (let i = 0; i < MASTERED_BOX; i++) p = schedule(p, attempt(true))
    expect(isMastered(p)).toBe(true)
    expect(p.box).toBe(MASTERED_BOX)
  })

  it('відповідь із підказкою не просуває бокс', () => {
    const p = schedule(createCardProgress(card, 'd', NOW), attempt(true, { usedHint: true }))
    expect(p.box).toBe(0)
    expect(p.reps).toBe(1)
  })

  it('засвоєння колоди рахує нові / у роботі / вивчені', () => {
    const progress = new Map([
      ['c1', schedule(createCardProgress(card, 'd', NOW), attempt(true))],
    ])
    const mastery = deckMastery(['c1', 'c2', 'c3'], progress)
    expect(mastery).toMatchObject({ total: 3, fresh: 2, learning: 1, mastered: 0 })
    expect(mastery.ratio).toBeCloseTo(0.2 / 3, 5)
  })
})
