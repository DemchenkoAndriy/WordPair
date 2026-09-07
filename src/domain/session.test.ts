import { describe, expect, it } from 'vitest'
import { applyAttempt, applyRecordToProfile, createSession, finishSession, isDeckMastered } from './session'
import { createCardProgress, MASTERED_BOX, schedule } from './scheduler'
import { xpForLevel } from './scoring'
import { createProfile } from '@/data/repository'
import { createRng } from '@/lib/rng'
import type { Attempt, Card, CardProgress } from './types'

const NOW = 1_700_000_000_000
const card: Card = { id: 'c1', prompt: 'a', answer: 'b', difficulty: 3 }
const rng = () => ({ ...createRng(1), next: () => 0.99 }) // без критів

const attempt = (correct: boolean, extra: Partial<Attempt> = {}): Attempt => ({
  cardId: 'c1',
  deckId: 'd',
  mode: 'pair-match',
  correct,
  latencyMs: 1000,
  at: NOW,
  ...extra,
})

const session = () => createSession({ id: 's1', deckId: 'd', mode: 'pair-match', startedAt: NOW })

describe('session pipeline', () => {
  it('влучання нарощує комбо, XP і породжує подію hit', () => {
    const result = applyAttempt({ session: session(), attempt: attempt(true), card, profileXp: 0, rng: rng() })
    expect(result.session.combo).toBe(1)
    expect(result.session.correct).toBe(1)
    expect(result.session.xp).toBeGreaterThan(0)
    expect(result.events[0]).toMatchObject({ type: 'hit', combo: 1, critical: false })
  })

  it('помилка обнуляє комбо і не додає XP', () => {
    const first = applyAttempt({ session: session(), attempt: attempt(true), card, profileXp: 0, rng: rng() })
    const second = applyAttempt({ session: first.session, attempt: attempt(false), card, profileXp: 0, rng: rng() })
    expect(second.session.combo).toBe(0)
    expect(second.session.wrong).toBe(1)
    expect(second.session.xp).toBe(first.session.xp)
    expect(second.events).toEqual([{ type: 'miss' }])
  })

  it('максимальне комбо не втрачається після помилки', () => {
    let state = session()
    for (let i = 0; i < 3; i++) {
      state = applyAttempt({ session: state, attempt: attempt(true), card, profileXp: 0, rng: rng() }).session
    }
    state = applyAttempt({ session: state, attempt: attempt(false), card, profileXp: 0, rng: rng() }).session
    expect(state.maxCombo).toBe(3)
    expect(state.combo).toBe(0)
  })

  it('повідомляє про віху комбо на пʼятому влучанні', () => {
    let state = session()
    let events: string[] = []
    for (let i = 0; i < 5; i++) {
      const r = applyAttempt({ session: state, attempt: attempt(true), card, profileXp: 0, rng: rng() })
      state = r.session
      events = r.events.map((e) => e.type)
    }
    expect(events).toContain('combo-milestone')
  })

  it('видає level-up, коли XP перетинає поріг рівня', () => {
    const result = applyAttempt({
      session: session(),
      attempt: attempt(true),
      card,
      profileXp: xpForLevel(2) - 1,
      rng: rng(),
    })
    expect(result.events.some((e) => e.type === 'level-up')).toBe(true)
  })

  it('видає card-mastered рівно один раз — на переході в останній бокс', () => {
    let progress = createCardProgress(card, 'd', NOW)
    for (let i = 0; i < MASTERED_BOX - 1; i++) progress = schedule(progress, attempt(true))

    const first = applyAttempt({ session: session(), attempt: attempt(true), card, cardProgress: progress, profileXp: 0, rng: rng() })
    expect(first.events.some((e) => e.type === 'card-mastered')).toBe(true)

    const second = applyAttempt({ session: session(), attempt: attempt(true), card, cardProgress: first.cardProgress, profileXp: 0, rng: rng() })
    expect(second.events.some((e) => e.type === 'card-mastered')).toBe(false)
  })

  it('підсумок сесії рахує точність і тривалість', () => {
    let state = session()
    state = applyAttempt({ session: state, attempt: attempt(true), card, profileXp: 0, rng: rng() }).session
    state = applyAttempt({ session: state, attempt: attempt(false), card, profileXp: 0, rng: rng() }).session
    const record = finishSession(state, NOW + 30_000)
    expect(record.accuracy).toBe(0.5)
    expect(record.durationMs).toBe(30_000)
  })

  it('підсумок переноситься в профіль', () => {
    const record = finishSession({ ...session(), correct: 4, wrong: 1, xp: 120, maxCombo: 4 }, NOW + 1000)
    const profile = applyRecordToProfile(createProfile(NOW), record)
    expect(profile.xp).toBe(120)
    expect(profile.level).toBe(2)
    expect(profile.totalSessions).toBe(1)
    expect(profile.totalAttempts).toBe(5)
    expect(profile.bestCombo).toBe(4)
  })

  it('колода вважається закритою лише коли всі картки вивчені', () => {
    const mastered = (id: string): CardProgress => {
      let p = createCardProgress({ id } as Card, 'd', NOW)
      for (let i = 0; i < MASTERED_BOX; i++) p = schedule(p, { ...attempt(true), cardId: id })
      return p
    }
    expect(isDeckMastered(['c1', 'c2'], new Map([['c1', mastered('c1')]]))).toBe(false)
    expect(isDeckMastered(['c1', 'c2'], new Map([['c1', mastered('c1')], ['c2', mastered('c2')]]))).toBe(true)
    expect(isDeckMastered([], new Map())).toBe(false)
  })
})
