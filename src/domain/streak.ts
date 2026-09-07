import type { Profile } from './types'
import { dayKey, daysBetween } from '@/lib/time'

export interface StreakUpdate {
  profile: Profile
  /** true, якщо сьогодні стрік подовжився вперше — привід для окремого ефекту. */
  extended: boolean
  broken: boolean
}

/** Оновлення денного стріку. Викликається один раз — по завершенні сесії. */
export function touchStreak(profile: Profile, now: number): StreakUpdate {
  const today = dayKey(now)
  if (profile.lastActiveDay === today) {
    return { profile, extended: false, broken: false }
  }

  const gap = profile.lastActiveDay ? daysBetween(profile.lastActiveDay, today) : Infinity
  const streakDays = gap === 1 ? profile.streakDays + 1 : 1
  const broken = gap > 1 && profile.lastActiveDay !== null

  return {
    profile: {
      ...profile,
      streakDays,
      bestStreakDays: Math.max(profile.bestStreakDays, streakDays),
      lastActiveDay: today,
    },
    extended: true,
    broken,
  }
}
