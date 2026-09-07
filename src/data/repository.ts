import type { CardId, CardProgress, DeckId, Profile, SessionRecord, Settings } from '@/domain/types'

/**
 * Контракти сховища. Верхні шари знають лише про ці інтерфейси,
 * тому IndexedDB згодом можна замінити на серверне API або на синхронізацію
 * без правок у домені та UI.
 */
export interface ProgressRepository {
  loadDeckProgress(deckId: DeckId): Promise<Map<CardId, CardProgress>>
  saveCardProgress(items: readonly CardProgress[]): Promise<void>
  loadProfile(): Promise<Profile | null>
  saveProfile(profile: Profile): Promise<void>
  loadSettings(): Promise<Settings | null>
  saveSettings(settings: Settings): Promise<void>
  appendSession(record: SessionRecord): Promise<void>
  recentSessions(limit: number): Promise<SessionRecord[]>
  /** Ключ дня → кількість завершених сесій. Для теплокарти активності. */
  activityByDay(sinceDayKey: string): Promise<Record<string, number>>
}

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  speechEnabled: true,
  boardPairs: 5,
  roundPairs: 20,
  endless: false,
  dailyGoalSessions: 3,
  lastDeckId: null,
  lastMode: 'pair-match',
}

export function createProfile(now: number): Profile {
  return {
    xp: 0,
    level: 1,
    streakDays: 0,
    bestStreakDays: 0,
    lastActiveDay: null,
    totalSessions: 0,
    totalAttempts: 0,
    bestCombo: 0,
    createdAt: now,
  }
}
