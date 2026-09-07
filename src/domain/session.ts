import type { Attempt, Card, CardId, CardProgress, DeckId, ExerciseMode, Profile, RewardEvent, SessionRecord } from './types'
import type { Rng } from '@/lib/rng'
import { createCardProgress, isMastered, schedule } from './scheduler'
import { isComboMilestone, levelFromXp, scoreHit } from './scoring'

/**
 * Пайплайн сесії — єдине місце, де спроби перетворюються на прогрес, XP і нагороди.
 * Спільний для ВСІХ режимів вправ: `Attempt` заходить, `RewardEvent[]` виходить.
 */

export interface SessionState {
  id: string
  deckId: DeckId
  mode: ExerciseMode
  startedAt: number
  combo: number
  maxCombo: number
  correct: number
  wrong: number
  xp: number
  attempts: Attempt[]
}

export function createSession(params: {
  id: string
  deckId: DeckId
  mode: ExerciseMode
  startedAt: number
}): SessionState {
  return { ...params, combo: 0, maxCombo: 0, correct: 0, wrong: 0, xp: 0, attempts: [] }
}

export interface ApplyAttemptInput {
  session: SessionState
  attempt: Attempt
  card?: Card
  cardProgress?: CardProgress
  profileXp: number
  rng: Rng
}

export interface ApplyAttemptResult {
  session: SessionState
  cardProgress: CardProgress
  events: RewardEvent[]
}

/** Чиста функція. Жодного IO — збереження робить шар data, і робить це асинхронно. */
export function applyAttempt({
  session,
  attempt,
  card,
  cardProgress,
  profileXp,
  rng,
}: ApplyAttemptInput): ApplyAttemptResult {
  const prev = cardProgress ?? createCardProgress({ id: attempt.cardId } as Card, attempt.deckId, attempt.at)
  const wasMastered = isMastered(prev)
  const next = schedule(prev, attempt)
  const events: RewardEvent[] = []

  if (!attempt.correct) {
    events.push({ type: 'miss' })
    return {
      session: { ...session, combo: 0, wrong: session.wrong + 1, attempts: [...session.attempts, attempt] },
      cardProgress: next,
      events,
    }
  }

  const combo = session.combo + 1
  const score = scoreHit({
    combo,
    latencyMs: attempt.latencyMs,
    ...(attempt.usedHint !== undefined ? { usedHint: attempt.usedHint } : {}),
    ...(card ? { card } : {}),
    rng,
  })

  events.push({ type: 'hit', combo, xp: score.xp, critical: score.critical })
  if (isComboMilestone(combo)) events.push({ type: 'combo-milestone', combo })
  if (!wasMastered && isMastered(next)) events.push({ type: 'card-mastered', cardId: attempt.cardId })

  const levelBefore = levelFromXp(profileXp)
  const levelAfter = levelFromXp(profileXp + score.xp)
  if (levelAfter > levelBefore) events.push({ type: 'level-up', level: levelAfter })

  return {
    session: {
      ...session,
      combo,
      maxCombo: Math.max(session.maxCombo, combo),
      correct: session.correct + 1,
      xp: session.xp + score.xp,
      attempts: [...session.attempts, attempt],
    },
    cardProgress: next,
    events,
  }
}

export function finishSession(session: SessionState, endedAt: number): SessionRecord {
  const total = session.correct + session.wrong
  return {
    id: session.id,
    deckId: session.deckId,
    mode: session.mode,
    startedAt: session.startedAt,
    durationMs: Math.max(0, endedAt - session.startedAt),
    correct: session.correct,
    wrong: session.wrong,
    xp: session.xp,
    maxCombo: session.maxCombo,
    accuracy: total === 0 ? 0 : session.correct / total,
  }
}

export function applyRecordToProfile(profile: Profile, record: SessionRecord): Profile {
  const xp = profile.xp + record.xp
  return {
    ...profile,
    xp,
    level: levelFromXp(xp),
    totalSessions: profile.totalSessions + 1,
    totalAttempts: profile.totalAttempts + record.correct + record.wrong,
    bestCombo: Math.max(profile.bestCombo, record.maxCombo),
  }
}

/** Чи закрито всю колоду — привід для великого святкування. */
export function isDeckMastered(cardIds: readonly CardId[], progress: ReadonlyMap<CardId, CardProgress>): boolean {
  if (cardIds.length === 0) return false
  return cardIds.every((id) => {
    const p = progress.get(id)
    return p ? isMastered(p) : false
  })
}
