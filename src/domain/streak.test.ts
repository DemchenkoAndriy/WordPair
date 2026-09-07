import { describe, expect, it } from 'vitest'
import { touchStreak } from './streak'
import { createProfile } from '@/data/repository'
import { DAY } from '@/lib/time'

const day = (offset: number) => new Date(2026, 0, 10 + offset, 12, 0, 0).getTime()

describe('streak', () => {
  it('перша сесія починає стрік з одного дня', () => {
    const { profile, extended } = touchStreak(createProfile(day(0)), day(0))
    expect(profile.streakDays).toBe(1)
    expect(profile.bestStreakDays).toBe(1)
    expect(extended).toBe(true)
  })

  it('друга сесія в той самий день нічого не змінює', () => {
    const first = touchStreak(createProfile(day(0)), day(0))
    const second = touchStreak(first.profile, day(0) + 3600_000)
    expect(second.profile.streakDays).toBe(1)
    expect(second.extended).toBe(false)
    expect(second.profile).toBe(first.profile)
  })

  it('наступний день подовжує стрік', () => {
    let state = touchStreak(createProfile(day(0)), day(0))
    state = touchStreak(state.profile, day(1))
    expect(state.profile.streakDays).toBe(2)
    expect(state.extended).toBe(true)
    expect(state.broken).toBe(false)
  })

  it('пропущений день скидає стрік, але зберігає рекорд', () => {
    let state = touchStreak(createProfile(day(0)), day(0))
    state = touchStreak(state.profile, day(1))
    state = touchStreak(state.profile, day(2))
    expect(state.profile.streakDays).toBe(3)

    state = touchStreak(state.profile, day(4))
    expect(state.profile.streakDays).toBe(1)
    expect(state.profile.bestStreakDays).toBe(3)
    expect(state.broken).toBe(true)
  })

  it('перехід через межу доби рахується за календарними днями, а не за 24 годинами', () => {
    const lateNight = new Date(2026, 0, 10, 23, 50).getTime()
    const first = touchStreak(createProfile(lateNight), lateNight)
    const second = touchStreak(first.profile, lateNight + 20 * 60_000) // +20 хв, вже наступна доба
    expect(second.profile.streakDays).toBe(2)
    expect(lateNight + 20 * 60_000 - lateNight).toBeLessThan(DAY)
  })
})
