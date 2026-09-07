import { create } from 'zustand'
import type {
  CardId,
  CardProgress,
  Deck,
  DeckId,
  ExerciseMode,
  Profile,
  RewardEvent,
  SessionRecord,
  Settings,
} from '@/domain/types'
import { createRng } from '@/lib/rng'
import { selectRoundCards } from '@/domain/selection'
import { pairMatchEngine, type PairInput, type PairRoundState } from '@/domain/engine/pairMatch'
import type { Feedback } from '@/domain/engine/types'
import {
  applyAttempt,
  applyRecordToProfile,
  createSession,
  finishSession,
  isDeckMastered,
  type SessionState,
} from '@/domain/session'
import { touchStreak } from '@/domain/streak'
import { levelFromXp } from '@/domain/scoring'
import { DEFAULT_DECK_ID, loadDeck } from '@/data/decks'
import { idbRepository } from '@/data/idbRepository'
import { createProfile, DEFAULT_SETTINGS, type ProgressRepository } from '@/data/repository'
import { readBootSnapshot, writeBootSnapshot } from '@/data/bootSnapshot'

export type Screen = 'session' | 'result' | 'decks' | 'stats' | 'settings'

interface AppState {
  ready: boolean
  screen: Screen
  settings: Settings
  profile: Profile
  deck: Deck | null
  progress: Map<CardId, CardProgress>
  round: PairRoundState | null
  session: SessionState | null
  lastRecord: SessionRecord | null
  /** Останній фідбек від рушія — UI підписується на нього для анімацій. */
  feedback: Feedback
  /** Черга подій нагород; шар ефектів вичитує і чистить її. */
  rewards: RewardEvent[]

  boot(): Promise<void>
  startRound(deckId?: DeckId, mode?: ExerciseMode): Promise<void>
  tap(tokenId: string): void
  finish(): Promise<void>
  /** Прибирає зійшлі пари й підтягує нові. Викликає UI після анімації згасання. */
  sweep(): void
  goTo(screen: Screen): void
  consumeRewards(): RewardEvent[]
  updateSettings(patch: Partial<Settings>): void
}

const repo: ProgressRepository = idbRepository
/** Записи в IDB не блокують кадр — накопичуємо і скидаємо пачкою. */
const pendingWrites = new Map<string, CardProgress>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    const batch = [...pendingWrites.values()]
    pendingWrites.clear()
    void repo.saveCardProgress(batch)
  }, 400)
}

const snapshot = readBootSnapshot()

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  screen: 'session',
  settings: {
    ...DEFAULT_SETTINGS,
    lastDeckId: snapshot?.deckId ?? null,
    ...(snapshot?.mode ? { lastMode: snapshot.mode } : {}),
  },
  profile: { ...createProfile(Date.now()), xp: snapshot?.xp ?? 0, level: snapshot?.level ?? 1, streakDays: snapshot?.streakDays ?? 0 },
  deck: null,
  progress: new Map(),
  round: null,
  session: null,
  lastRecord: null,
  feedback: { kind: 'none' },
  rewards: [],

  async boot() {
    const now = Date.now()
    const [storedSettings, storedProfile] = await Promise.all([repo.loadSettings(), repo.loadProfile()])
    const settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) }
    const profile = storedProfile ?? createProfile(now)
    set({ settings, profile })
    // Нульовий клік: запуск застосунку = початок тренування.
    await get().startRound(settings.lastDeckId ?? DEFAULT_DECK_ID, settings.lastMode)
    set({ ready: true })
  },

  async startRound(deckId, mode = 'pair-match') {
    const state = get()
    const id = deckId ?? state.deck?.id ?? state.settings.lastDeckId ?? DEFAULT_DECK_ID
    const deck = state.deck?.id === id ? state.deck : await loadDeck(id)
    const progress = state.deck?.id === id ? state.progress : await repo.loadDeckProgress(id)
    const now = Date.now()
    const rng = createRng(now)

    const { boardPairs, roundPairs, endless } = state.settings
    // У безкінечному режимі беремо стартову порцію й доливаємо по ходу;
    // у скінченному — одразу всі картки раунду.
    const size = endless ? boardPairs * 3 : Math.max(roundPairs, boardPairs)
    const cards = selectRoundCards({ cards: deck.cards, progress, size, now, rng })

    set({
      deck,
      progress,
      screen: 'session',
      feedback: { kind: 'none' },
      rewards: [],
      round: pairMatchEngine.init({
        deck,
        cards,
        boardPairs,
        target: endless ? null : Math.min(roundPairs, deck.cards.length),
        rng,
        startedAt: now,
      }),
      session: createSession({ id: `s-${now}`, deckId: id, mode, startedAt: now }),
      settings: { ...state.settings, lastDeckId: id, lastMode: mode },
    })
    void repo.saveSettings(get().settings)
  },

  tap(tokenId) {
    const state = get()
    if (!state.round || !state.session || !state.deck) return

    const input: PairInput = { type: 'tap', tokenId }
    const step = pairMatchEngine.submit(state.round, input, Date.now())
    if (step.attempts.length === 0) {
      set({ round: step.state, feedback: step.feedback })
      return
    }

    let session = state.session
    let profile = state.profile
    const progress = new Map(state.progress)
    const rewards: RewardEvent[] = []
    const rng = createRng(Date.now())

    for (const attempt of step.attempts) {
      const card = state.deck.cards.find((c) => c.id === attempt.cardId)
      const result = applyAttempt({
        session,
        attempt,
        ...(card ? { card } : {}),
        ...(progress.get(attempt.cardId) ? { cardProgress: progress.get(attempt.cardId)! } : {}),
        profileXp: profile.xp + session.xp,
        rng,
      })
      session = result.session
      progress.set(attempt.cardId, result.cardProgress)
      pendingWrites.set(`${attempt.deckId}:${attempt.cardId}`, result.cardProgress)
      rewards.push(...result.events)
    }
    scheduleFlush()

    if (pairMatchEngine.isComplete(step.state)) {
      const perfect = session.wrong === 0
      rewards.push({ type: 'round-cleared', perfect })
      if (isDeckMastered(state.deck.cards.map((c) => c.id), progress)) {
        rewards.push({ type: 'deck-mastered', deckId: state.deck.id })
      }
    }

    // Профіль оновлюємо оптимістично, щоб смужка XP рухалася в реальному часі.
    profile = { ...profile, level: levelFromXp(profile.xp + session.xp) }

    set({
      round: step.state,
      session,
      progress,
      profile,
      feedback: step.feedback,
      rewards: [...state.rewards, ...rewards],
    })
  },

  sweep() {
    const state = get()
    const { round, deck } = state
    if (!round || !deck || !pairMatchEngine.canSweep(round)) return

    const now = Date.now()
    let next = pairMatchEngine.sweep(round, createRng(now))

    // Безкінечний режим: доливаємо чергу картками, яких зараз немає на полі,
    // щоб одне й те саме слово не з'явилося двічі одночасно.
    if (round.target === null && pairMatchEngine.queued(next) < state.settings.boardPairs) {
      const busy = new Set([...next.tokens.map((t) => t.cardId), ...next.queue.map((c) => c.id)])
      const pool = deck.cards.filter((c) => !busy.has(c.id))
      next = pairMatchEngine.refill(
        next,
        selectRoundCards({
          cards: pool,
          progress: state.progress,
          size: state.settings.boardPairs * 2,
          now,
          rng: createRng(now + 1),
        }),
      )
    }

    set({ round: next })
  },

  async finish() {
    const state = get()
    if (!state.session) return
    const now = Date.now()
    const record = finishSession(state.session, now)

    const withXp = applyRecordToProfile(state.profile, record)
    const streak = touchStreak(withXp, now)
    const profile = streak.profile

    set({
      profile,
      lastRecord: record,
      screen: 'result',
      rewards: streak.extended ? [...state.rewards, { type: 'streak-extended', days: profile.streakDays }] : state.rewards,
    })

    writeBootSnapshot({
      deckId: record.deckId,
      mode: record.mode,
      level: profile.level,
      xp: profile.xp,
      streakDays: profile.streakDays,
      savedAt: now,
    })
    await Promise.all([repo.saveProfile(profile), repo.appendSession(record)])
  },

  goTo(screen) {
    set({ screen })
  },

  consumeRewards() {
    const events = get().rewards
    if (events.length > 0) set({ rewards: [] })
    return events
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    void repo.saveSettings(settings)
  },
}))
